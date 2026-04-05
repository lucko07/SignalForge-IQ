import { FieldValue, type DocumentData, type Firestore, type Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";

export const TRADES_COLLECTION_NAME = "trades";

type TradeSide = "long" | "short";
type TradeResult = "open" | "win" | "loss" | "breakeven";

type NormalizedTrade = {
  signalId: string;
  tradeId: string;
  strategyVersion: string;
  symbol: string;
  timeframe: string;
  side: TradeSide;
  entryTime: Timestamp | Date | string | null;
  entryPrice: number;
  exitTime: Timestamp | null;
  exitPrice: number | null;
  stopPrice: number;
  targetPrice: number;
  riskPerShare: number;
  rewardPerShare: number | null;
  rrPlanned: number | null;
  rrActual: number | null;
  pnlDollar: number | null;
  pnlPercent: number | null;
  result: TradeResult;
  fees: number;
  slippage: number;
  marketSession: string;
  dayOfWeek: string;
  entryHourNY: number | null;
  setupType: string;
  emaFilterPassed: boolean;
  antiChasePassed: boolean;
  isManualReview: boolean;
  notes: string;
  isArchived: boolean;
  isTest: boolean;
  isValid: boolean;
  createdAt: FieldValue;
  updatedAt: FieldValue;
};

const DEFAULT_MARKET_SESSION = "NY AM";
const DEFAULT_SETUP_TYPE = "General";
const DEFAULT_TIMEFRAME = "Unknown";
const DEFAULT_STRATEGY_VERSION = "legacy";
const NEW_YORK_TIME_ZONE = "America/New_York";

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

const toBoolean = (value: unknown, fallback: boolean) => (
  typeof value === "boolean" ? value : fallback
);

const pickFirstTextValue = (
  data: DocumentData,
  keys: string[]
) => {
  for (const key of keys) {
    const normalized = toTrimmedText(data[key]);

    if (normalized) {
      return normalized;
    }
  }

  return null;
};

const normalizeSignalDataKeys = (data: DocumentData): DocumentData => {
  const cleanedData: DocumentData = {};

  for (const [rawKey, value] of Object.entries(data)) {
    const trimmedKey = rawKey.trim();
    const existingValue = cleanedData[trimmedKey];
    const incomingText = toTrimmedText(value);
    const existingText = toTrimmedText(existingValue);
    const shouldReplace = existingValue === undefined
      || (existingText === null && incomingText !== null)
      || incomingText !== null;

    if (shouldReplace) {
      cleanedData[trimmedKey] = value;
    }
  }

  return cleanedData;
};

const normalizeSide = (value: unknown): TradeSide | null => {
  const normalizedValue = toTrimmedText(value)?.toLowerCase();

  if (!normalizedValue) {
    return null;
  }

  if (normalizedValue === "short" || normalizedValue === "sell") {
    return "short";
  }

  if (normalizedValue === "long" || normalizedValue === "buy") {
    return "long";
  }

  return null;
};

const buildRiskPerShare = (entryPrice: number, stopPrice: number) => {
  const riskPerShare = Math.abs(entryPrice - stopPrice);
  return Number(riskPerShare.toFixed(4));
};

const buildPlannedRR = (
  side: TradeSide,
  entryPrice: number,
  stopPrice: number,
  targetPrice: number
) => {
  const risk = Math.abs(entryPrice - stopPrice);
  const reward = side === "short"
    ? entryPrice - targetPrice
    : targetPrice - entryPrice;

  if (risk <= 0 || reward <= 0) {
    return null;
  }

  return Number((reward / risk).toFixed(2));
};

const toDate = (value: unknown): Date | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (
    typeof value === "object"
    && value !== null
    && "toDate" in value
    && typeof value.toDate === "function"
  ) {
    const converted = value.toDate();
    return converted instanceof Date && !Number.isNaN(converted.getTime()) ? converted : null;
  }

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildNyCalendarFields = (value: unknown) => {
  const date = toDate(value);

  if (!date) {
    return {
      dayOfWeek: "Unknown",
      entryHourNY: null,
    };
  }

  const dayOfWeek = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: NEW_YORK_TIME_ZONE,
  }).format(date);
  const hourParts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hourCycle: "h23",
    timeZone: NEW_YORK_TIME_ZONE,
  }).formatToParts(date);
  const hourPart = hourParts.find((part) => part.type === "hour")?.value;
  const entryHourNY = hourPart ? Number(hourPart) : null;

  return {
    dayOfWeek,
    entryHourNY: Number.isFinite(entryHourNY) ? entryHourNY : null,
  };
};

const isSignalArchivedOrInvalid = (data: DocumentData) => (
  toBoolean(data.isArchived, false) || !toBoolean(data.isValid, true)
);

const pickEntryTime = (data: DocumentData) => (
  (data.entryTime as Timestamp | Date | string | null | undefined)
  ?? (data.signalTime as Timestamp | Date | string | null | undefined)
  ?? (data.approvedAt as Timestamp | Date | string | null | undefined)
  ?? (data.createdAt as Timestamp | Date | string | null | undefined)
  ?? (data.ingestionTimestamp as Timestamp | Date | string | null | undefined)
  ?? null
);

const normalizeSignalForTrade = (
  signalId: string,
  data: DocumentData
): NormalizedTrade | null => {
  const cleanedData = normalizeSignalDataKeys(data);

  logger.info("Trade sync signal keys after normalization.", {
    signalId,
    originalDataKeys: Object.keys(data),
    cleanedDataKeys: Object.keys(cleanedData),
  });

  if (isSignalArchivedOrInvalid(cleanedData)) {
    return null;
  }

  logger.info("Trade sync raw signal payload before normalization.", {
    signalId,
    dataKeys: Object.keys(cleanedData),
    rawSymbol: cleanedData.symbol,
    rawSymbolType: typeof cleanedData.symbol,
    rawSide: cleanedData.side,
    rawSideType: typeof cleanedData.side,
    rawDirection: cleanedData.direction,
    rawDirectionType: typeof cleanedData.direction,
    rawBracketSymbol: cleanedData["symbol"],
    rawBracketSymbolType: typeof cleanedData["symbol"],
    rawBracketSide: cleanedData["side"],
    rawBracketSideType: typeof cleanedData["side"],
    rawBracketDirection: cleanedData["direction"],
    rawBracketDirectionType: typeof cleanedData["direction"],
  });

  const rawSymbolValue = cleanedData.symbol ?? cleanedData.Symbol ?? cleanedData.ticker ?? cleanedData.asset ?? null;
  const rawSideValue = cleanedData.side ?? cleanedData.direction ?? cleanedData.action ?? null;
  const cleanedSymbolCandidate = pickFirstTextValue(cleanedData, ["symbol", "Symbol", "ticker", "asset"]);
  const cleanedSideCandidate = pickFirstTextValue(cleanedData, ["side", "direction", "action"]);
  const symbol = cleanedSymbolCandidate?.toUpperCase() ?? null;
  const side = cleanedSideCandidate?.toLowerCase() ?? null;
  const normalizedSide = normalizeSide(cleanedSideCandidate);

  logger.info("Trade sync symbol/side candidates after sanitization.", {
    signalId,
    rawSymbolValue,
    cleanedSymbolValue: cleanedSymbolCandidate,
    rawSideValue,
    cleanedSideValue: cleanedSideCandidate,
  });

  const entryPrice = toNumber(cleanedData.entryPrice ?? cleanedData.entry);
  const stopPrice = toNumber(cleanedData.stopPrice ?? cleanedData.stopLoss);
  const targetPrice = toNumber(cleanedData.targetPrice ?? cleanedData.target);

  if (!symbol || !normalizedSide || entryPrice === null || stopPrice === null || targetPrice === null) {
    logger.warn("Trade sync normalization failed for required fields.", {
      signalId,
      cleanedSymbolCandidate: symbol,
      cleanedSideCandidate: side,
    });
    logger.warn("Skipping trade creation because required signal fields are missing.", {
      signalId,
      hasSymbol: Boolean(symbol),
      hasSide: Boolean(normalizedSide),
      hasEntryPrice: entryPrice !== null,
      hasStopPrice: stopPrice !== null,
      hasTargetPrice: targetPrice !== null,
    });
    return null;
  }

  const riskPerShare = buildRiskPerShare(entryPrice, stopPrice);
  const entryTime = pickEntryTime(cleanedData);
  const { dayOfWeek, entryHourNY } = buildNyCalendarFields(entryTime);

  return {
    signalId,
    tradeId: signalId,
    strategyVersion:
      toTrimmedText(cleanedData.strategyVersion)
      ?? toTrimmedText(cleanedData.strategyName)
      ?? DEFAULT_STRATEGY_VERSION,
    symbol,
    timeframe: toTrimmedText(cleanedData.timeframe) ?? DEFAULT_TIMEFRAME,
    side: normalizedSide,
    entryTime,
    entryPrice,
    exitTime: null,
    exitPrice: null,
    stopPrice,
    targetPrice,
    riskPerShare,
    rewardPerShare: null,
    rrPlanned: toNumber(data.rrPlanned) ?? buildPlannedRR(normalizedSide, entryPrice, stopPrice, targetPrice),
    rrActual: null,
    pnlDollar: null,
    pnlPercent: null,
    result: "open",
    fees: 0,
    slippage: 0,
    marketSession: toTrimmedText(cleanedData.marketSession) ?? DEFAULT_MARKET_SESSION,
    dayOfWeek,
    entryHourNY,
    setupType: toTrimmedText(cleanedData.setupType) ?? DEFAULT_SETUP_TYPE,
    emaFilterPassed: toBoolean(cleanedData.emaFilterPassed, false),
    antiChasePassed: toBoolean(cleanedData.antiChasePassed, false),
    isManualReview: false,
    notes: toTrimmedText(cleanedData.notes) ?? "",
    isArchived: false,
    isTest: toBoolean(cleanedData.isTest, false),
    isValid: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
};

export const syncSignalToTrade = async (
  db: Firestore,
  signalId: string,
  data: DocumentData
) => {
  const trade = normalizeSignalForTrade(signalId, data);

  if (!trade) {
    return { status: "skipped-missing-fields" as const };
  }

  const tradeReference = db.collection(TRADES_COLLECTION_NAME).doc(signalId);

  const result = await db.runTransaction(async (transaction) => {
    const existingTradeSnapshot = await transaction.get(tradeReference);

    if (existingTradeSnapshot.exists) {
      logger.info("Trade already exists for signal. Skipping duplicate creation.", {
        signalId,
        tradeId: signalId,
      });
      return { status: "skipped-existing-trade" as const };
    }

    transaction.set(tradeReference, trade);
    return { status: "created" as const };
  });

  if (result.status === "created") {
    logger.info("Trade created from signal.", {
      signalId,
      tradeId: signalId,
    });
  }

  return result;
};
