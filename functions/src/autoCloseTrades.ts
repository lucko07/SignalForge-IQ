import { type DocumentData, type Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { closeTrade } from "./tradeClose.js";
import { TRADES_COLLECTION_NAME } from "./tradeSync.js";

type TradeSide = "long" | "short";

const DEFAULT_ALPACA_DATA_PATH = "/v2";

const toTrimmedText = (value: unknown) => {
  if (typeof value === "string") {
    let cleaned = value.trim();

    while (cleaned.length >= 2 && cleaned.startsWith("\"") && cleaned.endsWith("\"")) {
      cleaned = cleaned.slice(1, -1).trim();
    }

    while (cleaned.length >= 2 && cleaned.startsWith("'") && cleaned.endsWith("'")) {
      cleaned = cleaned.slice(1, -1).trim();
    }

    return cleaned || null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
};

const toNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const textValue = toTrimmedText(value);

  if (!textValue) {
    return null;
  }

  const parsedValue = Number(textValue.replace(/,/g, ""));
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const buildAlpacaDataBaseUrl = () => {
  const configuredBaseUrl = toTrimmedText(process.env.ALPACA_BASE_URL);

  if (!configuredBaseUrl) {
    throw new Error("Missing ALPACA_BASE_URL environment variable.");
  }

  const url = new URL(configuredBaseUrl);

  if (url.hostname === "paper-api.alpaca.markets" || url.hostname === "api.alpaca.markets") {
    url.hostname = "data.alpaca.markets";
  }

  if (!url.pathname || url.pathname === "/") {
    url.pathname = DEFAULT_ALPACA_DATA_PATH;
  }

  return url.toString().replace(/\/$/, "");
};

const getAlpacaCredentials = () => {
  const apiKey = toTrimmedText(process.env.ALPACA_API_KEY);
  const secretKey = toTrimmedText(process.env.ALPACA_SECRET_KEY);
  const dataBaseUrl = buildAlpacaDataBaseUrl();

  if (!apiKey || !secretKey) {
    throw new Error("Missing Alpaca API credentials in environment variables.");
  }

  return {
    apiKey,
    secretKey,
    dataBaseUrl,
  };
};

const fetchLatestPriceFromAlpaca = async (symbol: string) => {
  const { apiKey, secretKey, dataBaseUrl } = getAlpacaCredentials();
  const latestTradeUrl = new URL(`${dataBaseUrl}/stocks/${encodeURIComponent(symbol)}/trades/latest`);
  latestTradeUrl.searchParams.set("feed", "iex");

  const response = await fetch(latestTradeUrl, {
    method: "GET",
    headers: {
      "APCA-API-KEY-ID": apiKey,
      "APCA-API-SECRET-KEY": secretKey,
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Alpaca latest trade request failed (${response.status}): ${errorBody}`);
  }

  const payload = await response.json() as { trade?: { p?: number } };
  const latestPrice = toNumber(payload.trade?.p);

  if (latestPrice === null) {
    throw new Error(`Alpaca latest trade response did not include a valid price for ${symbol}.`);
  }

  return latestPrice;
};

const getAutoCloseReason = (
  side: TradeSide,
  latestPrice: number,
  stopPrice: number,
  targetPrice: number
) => {
  if (side === "long") {
    if (latestPrice >= targetPrice) {
      return "auto target hit";
    }

    if (latestPrice <= stopPrice) {
      return "auto stop hit";
    }

    return null;
  }

  if (latestPrice <= targetPrice) {
    return "auto target hit";
  }

  if (latestPrice >= stopPrice) {
    return "auto stop hit";
  }

  return null;
};

const processOpenTrade = async (db: Firestore, tradeId: string, tradeData: DocumentData) => {
  const symbol = toTrimmedText(tradeData.symbol)?.toUpperCase() ?? null;
  const side = toTrimmedText(tradeData.side)?.toLowerCase() as TradeSide | null;
  const stopPrice = toNumber(tradeData.stopPrice);
  const targetPrice = toNumber(tradeData.targetPrice);

  if (!symbol || (side !== "long" && side !== "short") || stopPrice === null || targetPrice === null) {
    logger.warn("Auto close skipped because trade is missing required fields.", {
      tradeId,
      signalId: tradeData.signalId ?? null,
      symbol,
      side,
      hasStopPrice: stopPrice !== null,
      hasTargetPrice: targetPrice !== null,
    });
    return { status: "skipped-invalid-trade" as const };
  }

  logger.info("Auto close checking open trade.", {
    tradeId,
    signalId: tradeData.signalId ?? null,
    symbol,
    side,
    stopPrice,
    targetPrice,
  });

  let latestPrice: number;

  try {
    latestPrice = await fetchLatestPriceFromAlpaca(symbol);
  } catch (error) {
    logger.error("Auto close failed to fetch latest Alpaca price.", {
      tradeId,
      signalId: tradeData.signalId ?? null,
      symbol,
      error: error instanceof Error ? error.message : String(error),
    });
    return { status: "skipped-price-fetch-failed" as const };
  }

  logger.info("Auto close fetched latest Alpaca price.", {
    tradeId,
    signalId: tradeData.signalId ?? null,
    symbol,
    latestPrice,
  });

  const closeReason = getAutoCloseReason(side, latestPrice, stopPrice, targetPrice);

  if (!closeReason) {
    logger.info("Auto close skipped because no stop or target was hit.", {
      tradeId,
      signalId: tradeData.signalId ?? null,
      symbol,
      side,
      latestPrice,
      stopPrice,
      targetPrice,
    });
    return { status: "skipped-no-trigger-hit" as const };
  }

  try {
    const result = await closeTrade({
      db,
      tradeId,
      signalId: tradeData.signalId,
      exitPrice: latestPrice,
      exitTime: new Date(),
      closeReason,
    });

    if (result.status === "closed") {
      logger.info("Auto close closed trade successfully.", {
        tradeId,
        signalId: tradeData.signalId ?? null,
        symbol,
        latestPrice,
        closeReason,
        result: result.result,
      });
    } else {
      logger.info("Auto close skipped trade during close attempt.", {
        tradeId,
        signalId: tradeData.signalId ?? null,
        symbol,
        latestPrice,
        closeReason,
        status: result.status,
      });
    }

    return result;
  } catch (error) {
    logger.error("Auto close failed while closing trade.", {
      tradeId,
      signalId: tradeData.signalId ?? null,
      symbol,
      latestPrice,
      closeReason,
      error: error instanceof Error ? error.message : String(error),
    });
    return { status: "skipped-close-failed" as const };
  }
};

export const runAutoCloseTrades = async (db: Firestore) => {
  const openTradesSnapshot = await db
    .collection(TRADES_COLLECTION_NAME)
    .where("result", "==", "open")
    .get();

  logger.info("Auto close found open trades.", {
    openTradeCount: openTradesSnapshot.size,
  });

  const results = await Promise.allSettled(
    openTradesSnapshot.docs.map(async (tradeSnapshot) => processOpenTrade(db, tradeSnapshot.id, tradeSnapshot.data()))
  );

  const summary = {
    closed: 0,
    alreadyClosed: 0,
    skippedInvalidTrade: 0,
    skippedNoTriggerHit: 0,
    skippedPriceFetchFailed: 0,
    skippedCloseFailed: 0,
    notFound: 0,
    unknown: 0,
  };

  for (const result of results) {
    if (result.status === "rejected") {
      logger.error("Auto close encountered an unexpected processing failure.", {
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
      summary.unknown += 1;
      continue;
    }

    switch (result.value.status) {
    case "closed":
      summary.closed += 1;
      break;
    case "already-closed":
      summary.alreadyClosed += 1;
      break;
    case "skipped-invalid-trade":
      summary.skippedInvalidTrade += 1;
      break;
    case "skipped-no-trigger-hit":
      summary.skippedNoTriggerHit += 1;
      break;
    case "skipped-price-fetch-failed":
      summary.skippedPriceFetchFailed += 1;
      break;
    case "skipped-close-failed":
      summary.skippedCloseFailed += 1;
      break;
    case "not-found":
      summary.notFound += 1;
      break;
    default:
      summary.unknown += 1;
      break;
    }
  }

  logger.info("Auto close run completed.", summary);
  return summary;
};
