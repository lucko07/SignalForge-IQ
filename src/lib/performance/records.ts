import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import type {
  PerformanceSignal,
  PerformanceTrade,
  TradeResult,
  TradeSide,
} from "../../types/performance";
import { formatDateLabel, toMillis } from "./metrics";

const toNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalizedValue = Number(value.replace(/,/g, "").trim());

    return Number.isFinite(normalizedValue) ? normalizedValue : null;
  }

  return null;
};

const normalizeBoolean = (value: unknown, fallback: boolean) => {
  if (typeof value === "boolean") {
    return value;
  }

  return fallback;
};

const normalizeText = (value: unknown, fallback = "") => {
  return typeof value === "string" ? value.trim() : fallback;
};

const normalizeTradeSide = (value: unknown): TradeSide => {
  const normalizedValue = normalizeText(value).toLowerCase();

  return normalizedValue === "short" ? "short" : "long";
};

const normalizeTradeResult = (value: unknown): TradeResult => {
  const normalizedValue = normalizeText(value).toLowerCase();

  if (normalizedValue === "win" || normalizedValue === "loss" || normalizedValue === "breakeven") {
    return normalizedValue;
  }

  return normalizedValue === "open" ? "open" : "open";
};

const buildRiskPerShare = (entryPrice: number | null, stopPrice: number | null) => {
  if (entryPrice === null || stopPrice === null) {
    return null;
  }

  const riskPerShare = Math.abs(entryPrice - stopPrice);
  return riskPerShare > 0 ? riskPerShare : null;
};

const buildPlannedRR = (
  side: TradeSide,
  entryPrice: number | null,
  stopPrice: number | null,
  targetPrice: number | null
) => {
  if (entryPrice === null || stopPrice === null || targetPrice === null) {
    return null;
  }

  const risk = Math.abs(entryPrice - stopPrice);
  const reward = side === "short"
    ? entryPrice - targetPrice
    : targetPrice - entryPrice;

  if (risk <= 0 || reward <= 0) {
    return null;
  }

  return Number((reward / risk).toFixed(2));
};

const buildActualRR = (
  side: TradeSide,
  entryPrice: number | null,
  stopPrice: number | null,
  exitPrice: number | null
) => {
  if (entryPrice === null || stopPrice === null || exitPrice === null) {
    return null;
  }

  const risk = Math.abs(entryPrice - stopPrice);
  const realizedReward = side === "short"
    ? entryPrice - exitPrice
    : exitPrice - entryPrice;

  if (risk <= 0) {
    return null;
  }

  return Number((realizedReward / risk).toFixed(2));
};

const buildPnlPercent = (side: TradeSide, entryPrice: number | null, exitPrice: number | null) => {
  if (entryPrice === null || exitPrice === null || entryPrice === 0) {
    return null;
  }

  const pnl = side === "short"
    ? ((entryPrice - exitPrice) / entryPrice) * 100
    : ((exitPrice - entryPrice) / entryPrice) * 100;

  return Number(pnl.toFixed(2));
};

const normalizeStrategyVersion = (data: DocumentData) => (
  normalizeText(data.strategyVersion)
  || normalizeText(data.strategyName)
  || "legacy"
);

const normalizeSignalStatus = (data: DocumentData) => (
  normalizeText(data.status).toUpperCase() || "UNKNOWN"
);

export const mapPerformanceSignal = (
  documentSnapshot: QueryDocumentSnapshot<DocumentData>
): PerformanceSignal => {
  const data = documentSnapshot.data();
  const entryPrice = toNumber(data.entryPrice ?? data.entry);
  const stopPrice = toNumber(data.stopPrice ?? data.stopLoss);
  const targetPrice = toNumber(data.targetPrice ?? data.target);
  const side = normalizeTradeSide(data.side ?? data.direction);

  return {
    id: documentSnapshot.id,
    signalId: normalizeText(data.signalId) || documentSnapshot.id,
    strategyVersion: normalizeStrategyVersion(data),
    symbol: normalizeText(data.symbol).toUpperCase(),
    timeframe: normalizeText(data.timeframe, "Unknown"),
    side,
    signalTime: data.signalTime ?? data.createdAt ?? data.approvedAt ?? null,
    entryPrice,
    stopPrice,
    targetPrice,
    riskPerShare: toNumber(data.riskPerShare) ?? buildRiskPerShare(entryPrice, stopPrice),
    rrPlanned: toNumber(data.rrPlanned) ?? buildPlannedRR(side, entryPrice, stopPrice, targetPrice),
    status: normalizeSignalStatus(data),
    source: normalizeText(data.source, "unknown"),
    isArchived: normalizeBoolean(data.isArchived, false),
    isTest: normalizeBoolean(data.isTest, false),
    isValid: normalizeBoolean(data.isValid, true),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};

export const mapPerformanceTrade = (
  documentSnapshot: QueryDocumentSnapshot<DocumentData>
): PerformanceTrade => {
  const data = documentSnapshot.data();
  const side = normalizeTradeSide(data.side ?? data.direction);
  const entryPrice = toNumber(data.entryPrice ?? data.entry);
  const stopPrice = toNumber(data.stopPrice ?? data.stopLoss);
  const targetPrice = toNumber(data.targetPrice ?? data.target);
  const exitPrice = toNumber(data.exitPrice);
  const rrActual = toNumber(data.rrActual ?? data.rrResult) ?? buildActualRR(side, entryPrice, stopPrice, exitPrice);
  const result = normalizeTradeResult(data.result ?? data.outcome ?? inferTradeResult(data.status, rrActual, exitPrice));
  const entryTime = data.entryTime ?? data.createdAt ?? data.signalTime ?? null;

  return {
    id: documentSnapshot.id,
    tradeId: normalizeText(data.tradeId) || documentSnapshot.id,
    signalId: normalizeText(data.signalId) || documentSnapshot.id,
    strategyVersion: normalizeStrategyVersion(data),
    symbol: normalizeText(data.symbol).toUpperCase(),
    timeframe: normalizeText(data.timeframe, "Unknown"),
    side,
    entryTime,
    entryPrice,
    exitTime: data.exitTime ?? data.closedAt ?? null,
    exitPrice,
    stopPrice,
    targetPrice,
    riskPerShare: toNumber(data.riskPerShare) ?? buildRiskPerShare(entryPrice, stopPrice),
    rewardPerShare:
      toNumber(data.rewardPerShare)
      ?? (entryPrice !== null && exitPrice !== null ? Math.abs(exitPrice - entryPrice) : null),
    rrPlanned: toNumber(data.rrPlanned) ?? buildPlannedRR(side, entryPrice, stopPrice, targetPrice),
    rrActual,
    pnlDollar: toNumber(data.pnlDollar),
    pnlPercent: toNumber(data.pnlPercent) ?? buildPnlPercent(side, entryPrice, exitPrice),
    result,
    fees: toNumber(data.fees) ?? 0,
    slippage: toNumber(data.slippage) ?? 0,
    marketSession: normalizeText(data.marketSession, "Unknown"),
    dayOfWeek: normalizeText(data.dayOfWeek, inferDayOfWeek(entryTime)),
    entryHourNY: toNumber(data.entryHourNY),
    setupType: normalizeText(data.setupType, "General"),
    emaFilterPassed: normalizeBoolean(data.emaFilterPassed, false),
    antiChasePassed: normalizeBoolean(data.antiChasePassed, false),
    isManualReview: normalizeBoolean(data.isManualReview, false),
    notes: normalizeText(data.notes),
    isArchived: normalizeBoolean(data.isArchived, false),
    isTest: normalizeBoolean(data.isTest, false),
    isValid: normalizeBoolean(data.isValid, true),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};

const inferTradeResult = (
  status: unknown,
  rrActual: number | null,
  exitPrice: number | null
): TradeResult => {
  const normalizedStatus = normalizeText(status).toUpperCase();

  if (normalizedStatus === "ACTIVE" || normalizedStatus === "PENDING") {
    return "open";
  }

  if (normalizedStatus === "TAKE_PROFIT") {
    return "win";
  }

  if (normalizedStatus === "STOPPED") {
    return "loss";
  }

  if (normalizedStatus === "BREAKEVEN") {
    return "breakeven";
  }

  if (exitPrice === null) {
    return "open";
  }

  if ((rrActual ?? 0) > 0) {
    return "win";
  }

  if ((rrActual ?? 0) < 0) {
    return "loss";
  }

  return "breakeven";
};

const inferDayOfWeek = (value: unknown) => {
  const millis = toMillis(value);

  if (millis === null) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "America/New_York",
  }).format(new Date(millis));
};

export const isVisiblePerformanceRecord = (
  record: Pick<PerformanceSignal | PerformanceTrade, "isArchived" | "isTest" | "isValid">,
  options?: {
    includeArchived?: boolean;
    includeTest?: boolean;
    includeInvalid?: boolean;
  }
) => {
  if (!options?.includeArchived && record.isArchived) {
    return false;
  }

  if (!options?.includeTest && record.isTest) {
    return false;
  }

  if (!options?.includeInvalid && !record.isValid) {
    return false;
  }

  return true;
};

export const sortTradesDescending = (trades: PerformanceTrade[]) => (
  [...trades].sort((left, right) => {
    const leftMillis = toMillis(left.exitTime ?? left.entryTime ?? left.createdAt) ?? 0;
    const rightMillis = toMillis(right.exitTime ?? right.entryTime ?? right.createdAt) ?? 0;

    return rightMillis - leftMillis;
  })
);

export const buildTradeSearchText = (trade: PerformanceTrade) => [
  trade.tradeId,
  trade.signalId,
  trade.symbol,
  trade.strategyVersion,
  trade.timeframe,
  trade.marketSession,
  trade.setupType,
  formatDateLabel(trade.entryTime),
  formatDateLabel(trade.exitTime),
]
  .join(" ")
  .toLowerCase();
