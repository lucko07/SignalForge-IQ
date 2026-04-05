import { adminDb, FieldValue } from "../lib/firebaseAdmin.js";

const RELAY_EVENTS_COLLECTION = "tradingviewRelayEvents";
const TRADES_COLLECTION = "trades";
const SIGNALS_COLLECTION = "signals";
const MAX_BODY_BYTES = 32 * 1024;
const RELAY_SOURCE = "tradingview-relay";
const FIREBASE_CLOSE_TRADE_URL = process.env.FIREBASE_CLOSE_TRADE_URL ?? "";
const FIREBASE_CLOSE_TRADE_SECRET = process.env.FIREBASE_CLOSE_TRADE_SECRET ?? "";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  logInfo("request received", {
    method: req.method,
    contentType: req.headers["content-type"] ?? null,
  });

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      ok: false,
      error: "Method not allowed. Use POST.",
    });
  }

  const contentLength = toFiniteNumber(req.headers["content-length"]);

  if (contentLength !== null && contentLength > MAX_BODY_BYTES) {
    logWarn("validation failure", {
      reason: "body too large",
      contentLength,
    });
    return res.status(400).json({
      ok: false,
      error: "Request body too large.",
    });
  }

  const payload = parseJsonBody(req.body);

  if (!payload) {
    logWarn("validation failure", {
      reason: "invalid json",
      bodyType: typeof req.body,
    });
    return res.status(400).json({
      ok: false,
      error: "Invalid JSON payload.",
    });
  }

  let normalizedEvent;

  try {
    normalizedEvent = validateAndNormalizeTradingViewPayload(payload);
  } catch (error) {
    logWarn("validation failure", {
      reason: getErrorMessage(error),
      payload,
    });
    return res.status(400).json({
      ok: false,
      error: getErrorMessage(error),
    });
  }

  const relayEventReference = adminDb.collection(RELAY_EVENTS_COLLECTION).doc(normalizedEvent.eventId);
  const existingRelayEventSnapshot = await relayEventReference.get();

  if (existingRelayEventSnapshot.exists) {
    const existingRelayEvent = existingRelayEventSnapshot.data() ?? {};
    logInfo("duplicate event", {
      eventId: normalizedEvent.eventId,
      event: normalizedEvent.event,
      status: existingRelayEvent.status ?? null,
    });
    return res.status(200).json({
      ok: true,
      duplicate: true,
      event: normalizedEvent.event,
      eventId: normalizedEvent.eventId,
      status: existingRelayEvent.status ?? "duplicate",
      tradeId: existingRelayEvent.tradeId ?? null,
      signalId: existingRelayEvent.signalId ?? null,
    });
  }

  try {
    if (normalizedEvent.event === "entry") {
      const result = await routeEntryEvent(normalizedEvent, relayEventReference);

      logInfo("entry routed", {
        eventId: normalizedEvent.eventId,
        signalId: result.signalId,
        tradeId: result.tradeId,
        symbol: normalizedEvent.symbol,
        side: normalizedEvent.side,
      });

      return res.status(200).json({
        ok: true,
        event: normalizedEvent.event,
        eventId: normalizedEvent.eventId,
        duplicate: false,
        signalId: result.signalId,
        tradeId: result.tradeId,
        status: "entry-routed",
      });
    }

    const result = await routeExitEvent(normalizedEvent, relayEventReference);

    logInfo("exit routed", {
      eventId: normalizedEvent.eventId,
      symbol: normalizedEvent.symbol,
      side: normalizedEvent.side,
      tradeId: result.tradeId ?? null,
      signalId: result.signalId ?? null,
      duplicate: result.duplicate ?? false,
    });

    return res.status(200).json({
      ok: true,
      event: normalizedEvent.event,
      eventId: normalizedEvent.eventId,
      duplicate: Boolean(result.duplicate),
      tradeId: result.tradeId ?? null,
      signalId: result.signalId ?? null,
      backend: sanitizeBackendResponse(result.backend),
      status: "exit-routed",
    });
  } catch (error) {
    logError("backend failure", {
      eventId: normalizedEvent.eventId,
      event: normalizedEvent.event,
      symbol: normalizedEvent.symbol,
      side: normalizedEvent.side,
      error: getErrorMessage(error),
    });

    const statusCode = isRelayHttpError(error) ? error.statusCode : 500;

    return res.status(statusCode).json({
      ok: false,
      event: normalizedEvent.event,
      eventId: normalizedEvent.eventId,
      error: getErrorMessage(error),
    });
  }
}

async function routeEntryEvent(normalizedEvent, relayEventReference) {
  const signalReference = adminDb.collection(SIGNALS_COLLECTION).doc(normalizedEvent.eventId);

  const transactionResult = await adminDb.runTransaction(async (transaction) => {
    const [relayEventSnapshot, signalSnapshot] = await Promise.all([
      transaction.get(relayEventReference),
      transaction.get(signalReference),
    ]);

    if (relayEventSnapshot.exists || signalSnapshot.exists) {
      return {
        duplicate: true,
        signalId: signalReference.id,
        tradeId: signalReference.id,
      };
    }

    transaction.set(signalReference, buildSignalDocument(normalizedEvent));
    transaction.set(relayEventReference, buildRelayEventDocument({
      normalizedEvent,
      status: "entry-routed",
      signalId: signalReference.id,
      tradeId: signalReference.id,
      metadata: {
        collection: SIGNALS_COLLECTION,
      },
    }));

    return {
      duplicate: false,
      signalId: signalReference.id,
      tradeId: signalReference.id,
    };
  });

  if (transactionResult.duplicate) {
    return transactionResult;
  }

  return transactionResult;
}

async function routeExitEvent(normalizedEvent, relayEventReference) {
  const matchingTrade = await findLatestOpenTrade({
    symbol: normalizedEvent.symbol,
    side: normalizedEvent.side,
  });

  const backendPayload = {
    event: "exit",
    source: RELAY_SOURCE,
    eventId: normalizedEvent.eventId,
    automationTag: normalizedEvent.automationTag,
    symbol: normalizedEvent.symbol,
    tickerId: normalizedEvent.tickerId,
    timeframe: normalizedEvent.timeframe,
    barTime: normalizedEvent.barTime,
    exitTime: new Date(normalizedEvent.barTime).toISOString(),
    side: normalizedEvent.side,
    stopPrice: normalizedEvent.stopPrice,
    targetPrice: normalizedEvent.targetPrice,
    ...(normalizedEvent.exitPrice !== undefined ? { exitPrice: normalizedEvent.exitPrice } : {}),
    ...(matchingTrade?.tradeId ? { tradeId: matchingTrade.tradeId } : {}),
    ...(matchingTrade?.signalId ? { signalId: matchingTrade.signalId } : {}),
  };

  const backend = await callFirebaseCloseTradeWebhook(backendPayload);

  await relayEventReference.set(buildRelayEventDocument({
    normalizedEvent,
    status: "exit-routed",
    signalId: matchingTrade?.signalId ?? backend.signalId ?? null,
    tradeId: matchingTrade?.tradeId ?? backend.tradeId ?? null,
    metadata: {
      matchedBy: matchingTrade?.matchedBy ?? null,
      backendStatus: backend.result?.status ?? null,
      backendDuplicate: Boolean(backend.result?.duplicate),
    },
  }));

  return {
    tradeId: matchingTrade?.tradeId ?? backend.tradeId ?? null,
    signalId: matchingTrade?.signalId ?? backend.signalId ?? null,
    duplicate: Boolean(backend.result?.duplicate),
    backend: backend.result,
  };
}

async function callFirebaseCloseTradeWebhook(payload) {
  if (!FIREBASE_CLOSE_TRADE_URL.trim()) {
    throw createRelayHttpError(500, "Missing FIREBASE_CLOSE_TRADE_URL environment variable.");
  }

  if (!FIREBASE_CLOSE_TRADE_SECRET.trim()) {
    throw createRelayHttpError(500, "Missing FIREBASE_CLOSE_TRADE_SECRET environment variable.");
  }

  const response = await fetch(FIREBASE_CLOSE_TRADE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-secret": FIREBASE_CLOSE_TRADE_SECRET,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });

  const responseText = await response.text();
  const responseBody = parseJsonBody(responseText);

  if (!response.ok) {
    throw createRelayHttpError(
      response.status,
      responseBody?.error || `Firebase closeTradeFromWebhook failed with status ${response.status}.`
    );
  }

  return {
    tradeId: typeof responseBody?.tradeId === "string" ? responseBody.tradeId : null,
    signalId: typeof responseBody?.signalId === "string" ? responseBody.signalId : null,
    result: isPlainObject(responseBody) ? responseBody : null,
  };
}

async function findLatestOpenTrade({ symbol, side }) {
  const snapshot = await adminDb
    .collection(TRADES_COLLECTION)
    .where("result", "==", "open")
    .get();

  const matchingTrades = snapshot.docs
    .map((documentSnapshot) => ({
      tradeId: documentSnapshot.id,
      ...documentSnapshot.data(),
    }))
    .filter((trade) => {
      const tradeSymbol = normalizeSymbol(trade.symbol);
      const tradeSide = normalizeSide(trade.side);
      return tradeSymbol === symbol && tradeSide === side;
    })
    .sort((left, right) => getComparableTradeTime(right) - getComparableTradeTime(left));

  if (matchingTrades.length === 0) {
    return null;
  }

  return {
    tradeId: matchingTrades[0].tradeId,
    signalId: typeof matchingTrades[0].signalId === "string" ? matchingTrades[0].signalId : null,
    matchedBy: "symbol-side-latest-open-trade",
  };
}

function validateAndNormalizeTradingViewPayload(payload) {
  const allowedKeys = new Set([
    "event",
    "automationTag",
    "symbol",
    "tickerId",
    "timeframe",
    "barTime",
    "side",
    "entryPrice",
    "stopPrice",
    "targetPrice",
    "rrTarget",
    "eventId",
    "exitPrice",
  ]);

  const unknownKeys = Object.keys(payload).filter((key) => !allowedKeys.has(key));

  if (unknownKeys.length > 0) {
    throw new Error(`Unsupported field(s): ${unknownKeys.join(", ")}`);
  }

  const event = normalizeEvent(payload.event);
  const automationTag = requireNonEmptyString(payload.automationTag, "automationTag");
  const symbol = normalizeSymbol(payload.symbol);
  const tickerId = requireNonEmptyString(payload.tickerId, "tickerId");
  const timeframe = requireNonEmptyString(payload.timeframe, "timeframe");
  const barTime = requirePositiveInteger(payload.barTime, "barTime");
  const side = normalizeSide(payload.side);
  const stopPrice = requirePositiveNumber(payload.stopPrice, "stopPrice");
  const targetPrice = requirePositiveNumber(payload.targetPrice, "targetPrice");
  const eventId = requireNonEmptyString(payload.eventId, "eventId");

  if (!symbol) {
    throw new Error("symbol is required and must be a non-empty string.");
  }

  if (!side) {
    throw new Error('side must be exactly "long" or "short".');
  }

  if (event === "entry") {
    return {
      event,
      automationTag,
      symbol,
      tickerId,
      timeframe,
      barTime,
      side,
      entryPrice: requirePositiveNumber(payload.entryPrice, "entryPrice"),
      stopPrice,
      targetPrice,
      rrTarget: requirePositiveNumber(payload.rrTarget, "rrTarget"),
      eventId,
    };
  }

  if (payload.entryPrice !== undefined) {
    throw new Error("entryPrice is not allowed for exit events.");
  }

  if (payload.rrTarget !== undefined) {
    throw new Error("rrTarget is not allowed for exit events.");
  }

  const exitPrice = payload.exitPrice === undefined
    ? undefined
    : requirePositiveNumber(payload.exitPrice, "exitPrice");

  return {
    event,
    automationTag,
    symbol,
    tickerId,
    timeframe,
    barTime,
    side,
    stopPrice,
    targetPrice,
    eventId,
    ...(exitPrice !== undefined ? { exitPrice } : {}),
  };
}

function buildSignalDocument(normalizedEvent) {
  const signalTimestamp = new Date(normalizedEvent.barTime).toISOString();
  const direction = normalizedEvent.side.toUpperCase();
  const assetType = inferAssetType(normalizedEvent.tickerId, normalizedEvent.symbol);

  return {
    symbol: normalizedEvent.symbol,
    assetType,
    direction,
    side: normalizedEvent.side,
    entry: toPriceText(normalizedEvent.entryPrice),
    entryPrice: normalizedEvent.entryPrice,
    stopLoss: toPriceText(normalizedEvent.stopPrice),
    stopPrice: normalizedEvent.stopPrice,
    target: toPriceText(normalizedEvent.targetPrice),
    targetPrice: normalizedEvent.targetPrice,
    thesis: `TradingView ${normalizedEvent.automationTag} ${normalizedEvent.side} entry`,
    status: "ACTIVE",
    source: RELAY_SOURCE,
    timeframe: normalizedEvent.timeframe,
    confidence: "AUTOMATED",
    strategyName: normalizedEvent.automationTag,
    strategyVersion: normalizedEvent.automationTag,
    tickerId: normalizedEvent.tickerId,
    automationTag: normalizedEvent.automationTag,
    eventId: normalizedEvent.eventId,
    rrPlanned: normalizedEvent.rrTarget,
    rrTarget: normalizedEvent.rrTarget,
    signalTime: signalTimestamp,
    entryTime: signalTimestamp,
    reviewStatus: "APPROVED",
    ingestedBy: RELAY_SOURCE,
    ingestionTimestamp: FieldValue.serverTimestamp(),
    approvedAt: FieldValue.serverTimestamp(),
    approvedBy: RELAY_SOURCE,
    statusUpdatedAt: FieldValue.serverTimestamp(),
    statusUpdatedBy: RELAY_SOURCE,
    isArchived: false,
    isTest: false,
    isValid: true,
    rawPayload: normalizedEvent,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function buildRelayEventDocument({ normalizedEvent, status, signalId, tradeId, metadata }) {
  return {
    eventId: normalizedEvent.eventId,
    event: normalizedEvent.event,
    automationTag: normalizedEvent.automationTag,
    symbol: normalizedEvent.symbol,
    tickerId: normalizedEvent.tickerId,
    timeframe: normalizedEvent.timeframe,
    barTime: normalizedEvent.barTime,
    side: normalizedEvent.side,
    signalId: signalId ?? null,
    tradeId: tradeId ?? null,
    status,
    source: RELAY_SOURCE,
    metadata: metadata ?? null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function sanitizeBackendResponse(value) {
  if (!isPlainObject(value)) {
    return null;
  }

  return {
    ok: Boolean(value.ok),
    tradeId: typeof value.tradeId === "string" ? value.tradeId : null,
    signalId: typeof value.signalId === "string" ? value.signalId : null,
    duplicate: Boolean(value.duplicate),
    alreadyClosed: Boolean(value.alreadyClosed),
    result: typeof value.result === "string" ? value.result : null,
    error: typeof value.error === "string" ? value.error : null,
  };
}

function inferAssetType(tickerId, symbol) {
  const normalizedTickerId = tickerId.trim().toUpperCase();
  const normalizedSymbol = symbol.trim().toUpperCase();

  if (
    normalizedTickerId.startsWith("BINANCE:")
    || normalizedTickerId.startsWith("COINBASE:")
    || normalizedTickerId.startsWith("BYBIT:")
    || normalizedTickerId.startsWith("BITSTAMP:")
    || normalizedTickerId.startsWith("KRAKEN:")
    || normalizedTickerId.startsWith("CRYPTOCAP:")
  ) {
    return "crypto";
  }

  if (
    normalizedTickerId.startsWith("NASDAQ:")
    || normalizedTickerId.startsWith("NYSE:")
    || normalizedTickerId.startsWith("AMEX:")
    || normalizedTickerId.startsWith("ARCA:")
  ) {
    return "stocks";
  }

  if (/USD$/.test(normalizedSymbol) || /^XBT/.test(normalizedSymbol) || /^BTC/.test(normalizedSymbol)) {
    return "crypto";
  }

  return "stocks";
}

function getComparableTradeTime(trade) {
  return Math.max(
    getComparableTimestamp(trade.entryTime),
    getComparableTimestamp(trade.createdAt),
    getComparableTimestamp(trade.updatedAt)
  );
}

function getComparableTimestamp(value) {
  if (!value) {
    return 0;
  }

  if (typeof value === "object" && typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value === "object" && typeof value.toDate === "function") {
    const dateValue = value.toDate();
    return dateValue instanceof Date ? dateValue.getTime() : 0;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "string" || typeof value === "number") {
    const dateValue = new Date(value);
    return Number.isNaN(dateValue.getTime()) ? 0 : dateValue.getTime();
  }

  return 0;
}

function parseJsonBody(body) {
  if (!body) {
    return null;
  }

  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      return isPlainObject(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return isPlainObject(body) ? body : null;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeEvent(value) {
  const normalizedValue = requireNonEmptyString(value, "event").toLowerCase();

  if (normalizedValue !== "entry" && normalizedValue !== "exit") {
    throw new Error('event must be exactly "entry" or "exit".');
  }

  return normalizedValue;
}

function normalizeSymbol(value) {
  const normalizedValue = typeof value === "string" ? value.trim().toUpperCase() : "";
  return normalizedValue || null;
}

function normalizeSide(value) {
  const normalizedValue = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (normalizedValue === "long" || normalizedValue === "short") {
    return normalizedValue;
  }

  return null;
}

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} is required and must be a non-empty string.`);
  }

  return value.trim();
}

function requirePositiveNumber(value, fieldName) {
  const normalizedValue = toFiniteNumber(value);

  if (normalizedValue === null || normalizedValue <= 0) {
    throw new Error(`${fieldName} is required and must be a finite number greater than 0.`);
  }

  return normalizedValue;
}

function requirePositiveInteger(value, fieldName) {
  const normalizedValue = toFiniteNumber(value);

  if (normalizedValue === null || !Number.isInteger(normalizedValue) || normalizedValue <= 0) {
    throw new Error(`${fieldName} is required and must be a positive integer.`);
  }

  return normalizedValue;
}

function toFiniteNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsedValue = Number(value.trim());
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  return null;
}

function toPriceText(value) {
  return Number(value).toString();
}

function createRelayHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isRelayHttpError(value) {
  return Boolean(value) && typeof value === "object" && typeof value.statusCode === "number";
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function logInfo(message, metadata) {
  console.log("[tradingview-webhook]", message, metadata);
}

function logWarn(message, metadata) {
  console.warn("[tradingview-webhook]", message, metadata);
}

function logError(message, metadata) {
  console.error("[tradingview-webhook]", message, metadata);
}
