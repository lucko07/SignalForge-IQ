import { Timestamp, FieldValue, type DocumentData, type DocumentReference } from "firebase-admin/firestore";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onRequest, type Request } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import {
  GOOGLE_SHEETS_CLIENT_EMAIL,
  GOOGLE_SHEETS_PRIVATE_KEY,
  upsertTradeRow,
} from "../utils/googleSheets.js";
import { TRADES_COLLECTION_NAME } from "../tradeSync.js";
import { enforceRateLimit, getRequestId, getRequestIp } from "../security/rateLimit.js";

const closeTradeWebhookSecret = defineSecret("CLOSE_TRADE_WEBHOOK_SECRET");
const WEBHOOK_EVENTS_COLLECTION = "webhook_events";
const EXECUTIONS_COLLECTION = "executions";
const MAX_BODY_BYTES = 32 * 1024;
const CLOSE_TRADE_RATE_LIMIT_WINDOW_MS = Number(process.env.CLOSE_TRADE_RATE_LIMIT_WINDOW_MS ?? 60 * 1000);
const CLOSE_TRADE_RATE_LIMIT_MAX = Number(process.env.CLOSE_TRADE_RATE_LIMIT_MAX ?? 180);

type TradeSide = "long" | "short";
type TradeResult = "open" | "win" | "loss" | "breakeven";
type WebhookOutcome = "win" | "loss";
type ExitResolutionSource =
  | "explicit-exit-price"
  | "explicit-outcome"
  | "close-reason-hint"
  | "event-id-hint"
  | "single-price-fallback";

type TradeDocument = {
  tradeId?: string;
  signalId?: string;
  executionUid?: string | null;
  symbol?: string;
  side?: TradeSide;
  entryPrice?: number;
  stopPrice?: number;
  targetPrice?: number;
  riskPerShare?: number;
  exitPrice?: number | null;
  exitTime?: Timestamp | Date | string | null;
  rrPlanned?: number | null;
  rrActual?: number | null;
  pnlPercent?: number | null;
  pnlDollar?: number | null;
  closeReason?: string;
  result?: TradeResult;
  status?: string;
  shares?: number | string | null;
  qty?: number | string | null;
  createdAt?: FieldValue | Timestamp | Date | string | null;
  entryTime?: FieldValue | Timestamp | Date | string | null;
  updatedAt?: FieldValue | Timestamp | Date | string | null;
};

type ValidatedPayload = {
  event: "exit";
  tradeId: string | null;
  signalId: string | null;
  symbol: string | null;
  side: TradeSide | null;
  outcome: WebhookOutcome | null;
  exitPrice: number | null;
  exitTime: Timestamp | null;
  closeReason: string;
  source: string;
  eventId: string | null;
  stopPrice: number | null;
  targetPrice: number | null;
  tickerId: string | null;
  timeframe: string | null;
  automationTag: string | null;
  barTime: Timestamp | null;
};

type TradeMetrics = {
  rrActual: number;
  pnlPercent: number;
  pnlDollar: number | null;
  pnlPerShare: number;
};

type ResolvedExit = {
  exitPrice: number;
  outcome: WebhookOutcome;
  closeReason: string;
  resolutionSource: ExitResolutionSource;
};

type MatchedTrade = {
  reference: DocumentReference<DocumentData>;
  matchedBy: "tradeId" | "signalId" | "symbol-side-latest-open";
  signalId: string | null;
};

type CloseTradeResult = {
  ok: true;
  status: "closed" | "already_closed" | "no_open_position" | "duplicate_exit";
  tradeId: string;
  signalId: string | null;
  duplicate: boolean;
  alreadyClosed: boolean;
  result: TradeResult | WebhookOutcome | null;
  exitPrice: number | null;
  closeReason: string;
  matchedBy: MatchedTrade["matchedBy"] | null;
  resolutionSource: ExitResolutionSource | null;
  trade: {
    symbol: string | null;
    side: TradeSide | null;
    entryPrice: number | null;
    stopPrice: number | null;
    targetPrice: number | null;
    rrPlanned: number | null;
    rrActual: number | null;
    pnlPercent: number | null;
    pnlDollar: number | null;
    createdAt: TradeDocument["createdAt"] | null;
    exitTime: TradeDocument["exitTime"] | null;
  };
};

const toTrimmedText = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
};

const toNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const roundTo = (value: number, decimals: number) => Number(value.toFixed(decimals));

const requireWebhookSecret = (request: Request) => {
  const providedSecret =
    request.header("x-webhook-secret") ||
    request.body?.secret ||
    request.body?.webhookSecret;

  const expectedSecret = closeTradeWebhookSecret.value();

  if (!providedSecret || providedSecret !== expectedSecret) {
    return false;
  }

  return true;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

const toTimestamp = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (value instanceof Timestamp) {
    return value;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`${fieldName} must be a valid date.`);
    }

    return Timestamp.fromDate(value);
  }

  if (typeof value === "number") {
    const parsedDate = new Date(value);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new Error(`${fieldName} must be a valid unix timestamp in milliseconds.`);
    }

    return Timestamp.fromDate(parsedDate);
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return null;
    }

    const maybeNumber = Number(trimmedValue);
    const parsedDate = Number.isFinite(maybeNumber)
      ? new Date(maybeNumber)
      : new Date(trimmedValue);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new Error(`${fieldName} must be a valid ISO date string or unix timestamp in milliseconds.`);
    }

    return Timestamp.fromDate(parsedDate);
  }

  throw new Error(`${fieldName} must be a valid date string or unix timestamp in milliseconds.`);
};

const normalizeOutcome = (value: unknown) => {
  const normalizedValue = toTrimmedText(value)?.toLowerCase();

  if (normalizedValue === "win" || normalizedValue === "loss") {
    return normalizedValue;
  }

  return null;
};

const normalizeSide = (value: unknown) => {
  const normalizedValue = toTrimmedText(value)?.toLowerCase();

  if (normalizedValue === "long" || normalizedValue === "short") {
    return normalizedValue;
  }

  return null;
};

const normalizeSymbol = (value: unknown) => toTrimmedText(value)?.toUpperCase() ?? null;

const validatePayload = (body: unknown): ValidatedPayload => {
  if (!isPlainObject(body)) {
    throw new Error("Request body must be a JSON object.");
  }

  const event = toTrimmedText(body.event)?.toLowerCase() ?? "exit";
  const tradeId = toTrimmedText(body.tradeId);
  const signalId = toTrimmedText(body.signalId);
  const symbol = normalizeSymbol(body.symbol);
  const side = normalizeSide(body.side);
  const outcome = normalizeOutcome(body.outcome);
  const closeReason = toTrimmedText(body.closeReason) ?? "";
  const source = toTrimmedText(body.source) ?? "webhook";
  const eventId = toTrimmedText(body.eventId);
  const exitPrice = toNumber(body.exitPrice);
  const stopPrice = toNumber(body.stopPrice);
  const targetPrice = toNumber(body.targetPrice);
  const tickerId = toTrimmedText(body.tickerId);
  const timeframe = toTrimmedText(body.timeframe);
  const automationTag = toTrimmedText(body.automationTag);
  const exitTime = toTimestamp(body.exitTime, "exitTime");
  const barTime = toTimestamp(body.barTime, "barTime");

  if (event !== "exit") {
    throw new Error('event must be exactly "exit" when provided.');
  }

  if (!tradeId && !signalId && !(symbol && side)) {
    throw new Error("Provide tradeId, signalId, or symbol + side.");
  }

  if (side === null && body.side !== undefined) {
    throw new Error('side must be "long" or "short" when provided.');
  }

  if (exitPrice !== null && exitPrice <= 0) {
    throw new Error("exitPrice must be a finite number greater than 0 when provided.");
  }

  if (stopPrice !== null && stopPrice <= 0) {
    throw new Error("stopPrice must be a finite number greater than 0 when provided.");
  }

  if (targetPrice !== null && targetPrice <= 0) {
    throw new Error("targetPrice must be a finite number greater than 0 when provided.");
  }

  return {
    event: "exit",
    tradeId,
    signalId,
    symbol,
    side,
    outcome,
    exitPrice,
    exitTime: exitTime ?? barTime,
    closeReason,
    source,
    eventId,
    stopPrice,
    targetPrice,
    tickerId,
    timeframe,
    automationTag,
    barTime,
  };
};

const getComparableTimestamp = (value: unknown) => {
  if (!value) {
    return 0;
  }

  if (value instanceof Timestamp) {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (
    typeof value === "object"
    && value !== null
    && "toMillis" in value
    && typeof value.toMillis === "function"
  ) {
    return value.toMillis();
  }

  if (
    typeof value === "object"
    && value !== null
    && "toDate" in value
    && typeof value.toDate === "function"
  ) {
    const converted = value.toDate();
    return converted instanceof Date ? converted.getTime() : 0;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime();
  }

  return 0;
};

const getTradeRecency = (tradeData: TradeDocument) => Math.max(
  getComparableTimestamp(tradeData.entryTime),
  getComparableTimestamp(tradeData.createdAt),
  getComparableTimestamp(tradeData.updatedAt)
);

const findLatestOpenTradeBySymbolAndSide = async (
  symbol: string,
  side: TradeSide
): Promise<MatchedTrade | null> => {
  const db = getFirestore();
  const querySnapshot = await db
    .collection(TRADES_COLLECTION_NAME)
    .where("result", "==", "open")
    .get();

  const matchingTrade = querySnapshot.docs
    .filter((documentSnapshot) => {
      const trade = documentSnapshot.data() as TradeDocument;
      const tradeSymbol = normalizeSymbol(trade.symbol);
      const tradeSide = normalizeSide(trade.side);

      return tradeSymbol === symbol && tradeSide === side;
    })
    .sort((left, right) => {
      const leftTrade = left.data() as TradeDocument;
      const rightTrade = right.data() as TradeDocument;
      return getTradeRecency(rightTrade) - getTradeRecency(leftTrade);
    })[0];

  if (!matchingTrade) {
    return null;
  }

  const matchingTradeData = matchingTrade.data() as TradeDocument;

  return {
    reference: matchingTrade.ref,
    matchedBy: "symbol-side-latest-open",
    signalId: toTrimmedText(matchingTradeData.signalId),
  };
};

const findTradeReference = async (
  payload: ValidatedPayload
): Promise<MatchedTrade | null> => {
  const db = getFirestore();
  const trades = db.collection(TRADES_COLLECTION_NAME);

  if (payload.tradeId) {
    const directRef = trades.doc(payload.tradeId);
    const directSnap = await directRef.get();

    if (directSnap.exists) {
      const trade = directSnap.data() as TradeDocument;
      return {
        reference: directRef,
        matchedBy: "tradeId",
        signalId: toTrimmedText(trade.signalId),
      };
    }
  }

  if (payload.signalId) {
    const directRef = trades.doc(payload.signalId);
    const directSnap = await directRef.get();

    if (directSnap.exists) {
      const trade = directSnap.data() as TradeDocument;
      return {
        reference: directRef,
        matchedBy: "signalId",
        signalId: toTrimmedText(trade.signalId) ?? payload.signalId,
      };
    }

    const signalQuery = await trades.where("signalId", "==", payload.signalId).limit(1).get();

    if (!signalQuery.empty) {
      const tradeSnapshot = signalQuery.docs[0];
      const trade = tradeSnapshot.data() as TradeDocument;

      return {
        reference: tradeSnapshot.ref,
        matchedBy: "signalId",
        signalId: toTrimmedText(trade.signalId) ?? payload.signalId,
      };
    }
  }

  if (payload.symbol && payload.side) {
    return findLatestOpenTradeBySymbolAndSide(payload.symbol, payload.side);
  }

  return null;
};

const classifyOutcomeFromExitPrice = (
  side: TradeSide,
  exitPrice: number,
  stopPrice: number,
  targetPrice: number
): WebhookOutcome => {
  if (side === "long") {
    return exitPrice >= targetPrice ? "win" : "loss";
  }

  return exitPrice <= targetPrice ? "win" : "loss";
};

const inferOutcomeFromHint = (hint: string) => {
  if (/target|tp|take[_ -]?profit|profit|win/i.test(hint)) {
    return "win" as const;
  }

  if (/stop|sl|stop[_ -]?loss|loss/i.test(hint)) {
    return "loss" as const;
  }

  return null;
};

const resolveExit = (
  tradeId: string,
  trade: TradeDocument,
  payload: ValidatedPayload
): ResolvedExit => {
  const side = normalizeSide(trade.side);
  const tradeStopPrice = toNumber(trade.stopPrice);
  const tradeTargetPrice = toNumber(trade.targetPrice);
  const stopPrice = payload.stopPrice ?? tradeStopPrice;
  const targetPrice = payload.targetPrice ?? tradeTargetPrice;

  if (side !== "long" && side !== "short") {
    throw new Error(`Trade ${tradeId} is missing a valid side.`);
  }

  if (stopPrice === null || stopPrice <= 0 || targetPrice === null || targetPrice <= 0) {
    throw new Error(`Trade ${tradeId} is missing valid stop/target prices needed to resolve the exit.`);
  }

  if (payload.exitPrice !== null) {
    return {
      exitPrice: payload.exitPrice,
      outcome: payload.outcome ?? classifyOutcomeFromExitPrice(side, payload.exitPrice, stopPrice, targetPrice),
      closeReason: payload.closeReason || "webhook exit",
      resolutionSource: "explicit-exit-price",
    };
  }

  if (payload.outcome === "win") {
    return {
      exitPrice: targetPrice,
      outcome: "win",
      closeReason: payload.closeReason || "webhook target fill",
      resolutionSource: "explicit-outcome",
    };
  }

  if (payload.outcome === "loss") {
    return {
      exitPrice: stopPrice,
      outcome: "loss",
      closeReason: payload.closeReason || "webhook stop fill",
      resolutionSource: "explicit-outcome",
    };
  }

  const closeReasonHint = inferOutcomeFromHint(payload.closeReason);

  if (closeReasonHint === "win") {
    return {
      exitPrice: targetPrice,
      outcome: "win",
      closeReason: payload.closeReason,
      resolutionSource: "close-reason-hint",
    };
  }

  if (closeReasonHint === "loss") {
    return {
      exitPrice: stopPrice,
      outcome: "loss",
      closeReason: payload.closeReason,
      resolutionSource: "close-reason-hint",
    };
  }

  const eventIdHint = inferOutcomeFromHint(payload.eventId ?? "");

  if (eventIdHint === "win") {
    return {
      exitPrice: targetPrice,
      outcome: "win",
      closeReason: payload.closeReason || "webhook target fill",
      resolutionSource: "event-id-hint",
    };
  }

  if (eventIdHint === "loss") {
    return {
      exitPrice: stopPrice,
      outcome: "loss",
      closeReason: payload.closeReason || "webhook stop fill",
      resolutionSource: "event-id-hint",
    };
  }

  if (payload.stopPrice !== null && payload.targetPrice === null) {
    return {
      exitPrice: stopPrice,
      outcome: "loss",
      closeReason: payload.closeReason || "webhook stop fill",
      resolutionSource: "single-price-fallback",
    };
  }

  if (payload.targetPrice !== null && payload.stopPrice === null) {
    return {
      exitPrice: targetPrice,
      outcome: "win",
      closeReason: payload.closeReason || "webhook target fill",
      resolutionSource: "single-price-fallback",
    };
  }

  const error = new Error(
    "Exit webhook is ambiguous without exitPrice or outcome. Include one of those fields in the exit payload."
  );
  error.name = "AmbiguousExit";
  throw error;
};

const computeTradeMetrics = (
  tradeId: string,
  trade: TradeDocument,
  exitPrice: number
): TradeMetrics => {
  const entryPrice = toNumber(trade.entryPrice);
  const riskPerShare = toNumber(trade.riskPerShare);
  const quantity = toNumber(trade.shares ?? trade.qty);
  const side = normalizeSide(trade.side);

  if (!side) {
    throw new Error(`Trade ${tradeId} is missing a valid side.`);
  }

  if (entryPrice === null || entryPrice <= 0) {
    throw new Error(`Trade ${tradeId} is missing a valid entryPrice.`);
  }

  if (riskPerShare === null || riskPerShare <= 0) {
    throw new Error(`Trade ${tradeId} is missing a valid riskPerShare.`);
  }

  const pnlPerShare = side === "short"
    ? entryPrice - exitPrice
    : exitPrice - entryPrice;

  return {
    pnlPerShare: roundTo(pnlPerShare, 4),
    rrActual: roundTo(pnlPerShare / riskPerShare, 2),
    pnlPercent: roundTo((pnlPerShare / entryPrice) * 100, 2),
    pnlDollar: quantity === null ? null : roundTo(pnlPerShare * quantity, 2),
  };
};

const normalizeTimestampForSheet = (value: unknown): string => {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (
    typeof value === "object"
    && "toDate" in value
    && typeof value.toDate === "function"
  ) {
    const converted = value.toDate();
    return converted instanceof Date ? converted.toISOString() : "";
  }

  return "";
};

const buildTradeSummary = (
  trade: TradeDocument,
  overrides?: Partial<CloseTradeResult["trade"]>
): CloseTradeResult["trade"] => ({
  symbol: normalizeSymbol(trade.symbol),
  side: normalizeSide(trade.side),
  entryPrice: toNumber(trade.entryPrice),
  stopPrice: toNumber(trade.stopPrice),
  targetPrice: toNumber(trade.targetPrice),
  rrPlanned: toNumber(trade.rrPlanned),
  rrActual: toNumber(trade.rrActual),
  pnlPercent: toNumber(trade.pnlPercent),
  pnlDollar: toNumber(trade.pnlDollar),
  createdAt: normalizeTimestampForSheet(trade.createdAt),
  exitTime: normalizeTimestampForSheet(trade.exitTime),
  ...overrides,
});

const buildExitExecutionAuditId = (payload: ValidatedPayload, matchedTrade?: MatchedTrade | null) => {
  const baseId = toTrimmedText(payload.eventId)
    ?? toTrimmedText(payload.tradeId)
    ?? toTrimmedText(payload.signalId)
    ?? [
      payload.symbol ?? "UNKNOWN",
      payload.side ?? "UNKNOWN",
      payload.barTime ? String(payload.barTime.toMillis()) : "NO_TIME",
    ].join("_");

  return `alpaca_paper_exit_${baseId.replace(/[^A-Za-z0-9_-]/g, "_")}`;
};

const buildExitExecutionClientOrderId = (payload: ValidatedPayload, matchedTrade?: MatchedTrade | null) => {
  const baseId = toTrimmedText(payload.eventId)
    ?? toTrimmedText(payload.tradeId)
    ?? toTrimmedText(payload.signalId)
    ?? matchedTrade?.reference.id
    ?? [
      payload.symbol ?? "UNKNOWN",
      payload.side ?? "UNKNOWN",
      payload.barTime ? String(payload.barTime.toMillis()) : "NO_TIME",
    ].join("_");

  return `sfiq_exit_${baseId.replace(/[^A-Za-z0-9_-]/g, "_")}`;
};

const upsertExitExecutionAudit = async ({
  payload,
  matchedTrade = null,
  trade = null,
  status,
  reason,
  message,
}: {
  payload: ValidatedPayload;
  matchedTrade?: MatchedTrade | null;
  trade?: TradeDocument | null;
  status: "closed" | "already_closed" | "no_open_position" | "duplicate_exit";
  reason: string;
  message: string;
}) => {
  const db = getFirestore();
  const executionId = buildExitExecutionAuditId(payload, matchedTrade);
  const executionReference = db.collection(EXECUTIONS_COLLECTION).doc(executionId);
  const executionSnapshot = await executionReference.get();
  const tradeId =
    matchedTrade?.reference.id
    ?? payload.tradeId
    ?? payload.signalId
    ?? `${payload.symbol ?? "UNKNOWN"}_${payload.side ?? "unknown"}_exit`;
  const signalId = toTrimmedText(trade?.signalId) ?? matchedTrade?.signalId ?? payload.signalId ?? null;
  const symbol = payload.symbol ?? normalizeSymbol(trade?.symbol) ?? "BTCUSD";
  const side = payload.side ?? normalizeSide(trade?.side) ?? "long";
  const clientOrderId = buildExitExecutionClientOrderId(payload, matchedTrade);
  const createdAtPatch = executionSnapshot.exists ? {} : {
    createdAt: FieldValue.serverTimestamp(),
    executionId,
    provider: "alpaca",
    mode: "paper",
    tradeId,
    signalId,
    uid: trade?.executionUid ?? null,
    symbol,
    side,
    positionSide: side,
    orderType: "market",
    timeInForce: "gtc",
    qty: null,
    notional: null,
    alpacaOrderId: null,
    clientOrderId,
    submittedAt: null,
    filledAt: null,
    canceledAt: null,
    filledQty: null,
    filledAvgPrice: null,
    brokerOrderStatus: null,
    brokerAccountId: null,
    brokerPositionConflict: false,
    automationSettings: null,
    orderRequest: null,
    orderResponse: null,
    brokerSnapshot: null,
  };

  await executionReference.set({
    ...createdAtPatch,
    updatedAt: FieldValue.serverTimestamp(),
    timeframe: payload.timeframe ?? null,
    strategyVersion: null,
    rawStatus: status,
    status,
    errorCode: reason,
    errorMessage: message,
    validation: {
      tradeEligible: status === "closed",
      reason,
      tradeResult: trade?.result ?? null,
      isArchived: false,
      isValid: true,
      isTest: false,
    },
    error: {
      code: reason,
      message,
    },
  }, { merge: true });

  return {
    executionId,
    clientOrderId,
  };
};

const closeTradeTransactional = async (
  matchedTrade: MatchedTrade,
  payload: ValidatedPayload
) => {
  const db = getFirestore();
  const eventReference = payload.eventId
    ? db.collection(WEBHOOK_EVENTS_COLLECTION).doc(payload.eventId)
    : null;

  return db.runTransaction(async (transaction): Promise<CloseTradeResult | null> => {
    if (eventReference) {
      const eventSnapshot = await transaction.get(eventReference);

      if (eventSnapshot.exists) {
        const eventData = eventSnapshot.data() ?? {};
        logger.info("Close trade webhook duplicate event ignored.", {
          eventId: payload.eventId,
          tradeId: eventData.tradeId ?? matchedTrade.reference.id,
          signalId: eventData.signalId ?? payload.signalId,
          source: payload.source,
        });

        const existingTradeSnapshot = await transaction.get(matchedTrade.reference);
        const existingTrade = existingTradeSnapshot.exists
          ? existingTradeSnapshot.data() as TradeDocument
          : {};

        return {
          ok: true,
          status: "duplicate_exit",
          tradeId: eventData.tradeId ?? matchedTrade.reference.id,
          signalId: eventData.signalId ?? matchedTrade.signalId ?? payload.signalId,
          duplicate: true,
          alreadyClosed: false,
          result: (eventData.result as TradeResult | WebhookOutcome | null | undefined) ?? null,
          exitPrice: toNumber(eventData.exitPrice) ?? payload.exitPrice,
          closeReason: toTrimmedText(eventData.closeReason) ?? payload.closeReason,
          matchedBy: (eventData.matchedBy as MatchedTrade["matchedBy"] | undefined) ?? matchedTrade.matchedBy,
          resolutionSource: (eventData.resolutionSource as ExitResolutionSource | null | undefined) ?? null,
          trade: buildTradeSummary(existingTrade),
        };
      }
    }

    const tradeSnapshot = await transaction.get(matchedTrade.reference);

    if (!tradeSnapshot.exists) {
      return null;
    }

    const trade = tradeSnapshot.data() as TradeDocument;
    const normalizedTradeSymbol = normalizeSymbol(trade.symbol);
    const normalizedTradeSide = normalizeSide(trade.side);

    if (payload.symbol && normalizedTradeSymbol && payload.symbol !== normalizedTradeSymbol) {
      const error = new Error("Provided symbol does not match the trade symbol.");
      error.name = "SymbolMismatch";
      throw error;
    }

    if (payload.side && normalizedTradeSide && payload.side !== normalizedTradeSide) {
      const error = new Error("Provided side does not match the trade side.");
      error.name = "SideMismatch";
      throw error;
    }

    if (trade.result && trade.result !== "open") {
      logger.info("Close trade webhook received already-closed trade.", {
        tradeId: matchedTrade.reference.id,
        signalId: trade.signalId ?? payload.signalId,
        currentResult: trade.result,
        source: payload.source,
        eventId: payload.eventId,
      });

      if (eventReference) {
        transaction.set(eventReference, {
          tradeId: matchedTrade.reference.id,
          signalId: trade.signalId ?? payload.signalId ?? null,
          source: payload.source,
          matchedBy: matchedTrade.matchedBy,
          result: trade.result,
          exitPrice: trade.exitPrice ?? payload.exitPrice,
          closeReason: trade.closeReason ?? payload.closeReason,
          status: "already_closed",
          alreadyClosed: true,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      return {
        ok: true,
        status: "already_closed",
        tradeId: matchedTrade.reference.id,
        signalId: toTrimmedText(trade.signalId) ?? matchedTrade.signalId ?? payload.signalId,
        duplicate: false,
        alreadyClosed: true,
        result: trade.result,
        exitPrice: toNumber(trade.exitPrice) ?? payload.exitPrice,
        closeReason: trade.closeReason ?? payload.closeReason,
        matchedBy: matchedTrade.matchedBy,
        resolutionSource: null,
        trade: buildTradeSummary(trade),
      };
    }

    const resolvedExit = resolveExit(matchedTrade.reference.id, trade, payload);
    const metrics = computeTradeMetrics(matchedTrade.reference.id, trade, resolvedExit.exitPrice);
    const closeReason = resolvedExit.closeReason || `webhook ${resolvedExit.outcome}`;
    const exitTimeValue = payload.exitTime ?? FieldValue.serverTimestamp();
    const signalId = toTrimmedText(trade.signalId) ?? matchedTrade.signalId ?? payload.signalId;

    transaction.update(matchedTrade.reference, {
      exitPrice: resolvedExit.exitPrice,
      exitTime: exitTimeValue,
      rrActual: metrics.rrActual,
      pnlPercent: metrics.pnlPercent,
      pnlDollar: metrics.pnlDollar,
      closeReason,
      result: resolvedExit.outcome,
      status: "closed",
      brokerStatus: "closed",
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (eventReference) {
      transaction.set(eventReference, {
        tradeId: matchedTrade.reference.id,
        signalId: signalId ?? null,
        source: payload.source,
        matchedBy: matchedTrade.matchedBy,
        result: resolvedExit.outcome,
        exitPrice: resolvedExit.exitPrice,
        closeReason,
        resolutionSource: resolvedExit.resolutionSource,
        status: "closed",
        alreadyClosed: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    logger.info("Close trade webhook accepted and closed trade.", {
      tradeId: matchedTrade.reference.id,
      signalId,
      source: payload.source,
      eventId: payload.eventId,
      matchedBy: matchedTrade.matchedBy,
      resolutionSource: resolvedExit.resolutionSource,
      result: resolvedExit.outcome,
      exitPrice: resolvedExit.exitPrice,
      closeReason,
      rrActual: metrics.rrActual,
      pnlPercent: metrics.pnlPercent,
      pnlDollar: metrics.pnlDollar,
    });

    return {
      ok: true,
      status: "closed",
      tradeId: matchedTrade.reference.id,
      signalId,
      duplicate: false,
      alreadyClosed: false,
      result: resolvedExit.outcome,
      exitPrice: resolvedExit.exitPrice,
      closeReason,
      matchedBy: matchedTrade.matchedBy,
      resolutionSource: resolvedExit.resolutionSource,
      trade: buildTradeSummary(trade, {
        rrActual: metrics.rrActual,
        pnlPercent: metrics.pnlPercent,
        pnlDollar: metrics.pnlDollar,
      }),
    };
  });
};

export const closeTradeFromWebhook = onRequest(
  {
    cors: false,
    secrets: [closeTradeWebhookSecret, GOOGLE_SHEETS_CLIENT_EMAIL, GOOGLE_SHEETS_PRIVATE_KEY],
  },
  async (request, response) => {
    const requestId = getRequestId(request);
    const clientIp = getRequestIp(request);
    logger.info("Close trade webhook request received.", {
      requestId,
      method: request.method,
      ip: clientIp,
    });

    if (request.method !== "POST") {
      response.status(405).json({ ok: false, error: "Method not allowed. Use POST." });
      return;
    }

    const rateLimit = await enforceRateLimit({
      route: "functions/closeTradeFromWebhook",
      identifier: clientIp,
      limit: CLOSE_TRADE_RATE_LIMIT_MAX,
      windowMs: CLOSE_TRADE_RATE_LIMIT_WINDOW_MS,
    });

    if (!rateLimit.allowed) {
      response.set("Retry-After", String(rateLimit.retryAfterSeconds));
      response.status(429).json({ ok: false, error: "Too many requests. Please wait and try again." });
      return;
    }

    const contentLengthHeader = request.header("content-length");
    const contentLength = contentLengthHeader ? Number(contentLengthHeader) : null;

    if (contentLength !== null && (Number.isNaN(contentLength) || contentLength > MAX_BODY_BYTES)) {
      logger.warn("Close trade webhook rejected oversized body.", {
        requestId,
        contentLength: contentLengthHeader,
        ip: clientIp,
      });
      response.status(400).json({ ok: false, error: "Request body too large." });
      return;
    }

    if (!requireWebhookSecret(request)) {
      logger.warn("Close trade webhook rejected due to invalid secret.", {
        requestId,
        ip: clientIp,
      });
      response.status(401).json({ ok: false, error: "Unauthorized." });
      return;
    }

    let payload: ValidatedPayload;

    try {
      payload = validatePayload(request.body);
    } catch (error) {
      logger.warn("Close trade webhook rejected invalid payload.", {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        ip: clientIp,
      });
      response.status(400).json({
        ok: false,
        error: "Invalid exit payload.",
      });
      return;
    }

    try {
      logger.info("Close trade webhook payload validated.", {
        requestId,
        tradeId: payload.tradeId,
        signalId: payload.signalId,
        symbol: payload.symbol,
        side: payload.side,
        source: payload.source,
        eventId: payload.eventId,
      });

      const matchedTrade = await findTradeReference(payload);

      if (!matchedTrade) {
        const result: CloseTradeResult = {
          ok: true,
          status: "no_open_position",
          tradeId: payload.tradeId ?? payload.signalId ?? `${payload.symbol ?? "UNKNOWN"}_${payload.side ?? "unknown"}_exit`,
          signalId: payload.signalId,
          duplicate: false,
          alreadyClosed: false,
          result: null,
          exitPrice: payload.exitPrice,
          closeReason: payload.closeReason || "No open trade or broker position matched this exit event.",
          matchedBy: null,
          resolutionSource: null,
          trade: {
            symbol: payload.symbol,
            side: payload.side,
            entryPrice: null,
            stopPrice: payload.stopPrice,
            targetPrice: payload.targetPrice,
            rrPlanned: null,
            rrActual: null,
            pnlPercent: null,
            pnlDollar: null,
            createdAt: null,
            exitTime: payload.exitTime ? payload.exitTime.toDate().toISOString() : null,
          },
        };

        logger.info("Close trade webhook handled with no matching open trade.", {
          requestId,
          tradeId: payload.tradeId,
          signalId: payload.signalId,
          symbol: payload.symbol,
          side: payload.side,
          source: payload.source,
          eventId: payload.eventId,
          status: result.status,
        });

        if (payload.eventId) {
          await getFirestore().collection(WEBHOOK_EVENTS_COLLECTION).doc(payload.eventId).set({
            tradeId: result.tradeId,
            signalId: result.signalId,
            source: payload.source,
            matchedBy: null,
            result: null,
            exitPrice: result.exitPrice,
            closeReason: result.closeReason,
            resolutionSource: null,
            status: result.status,
            alreadyClosed: false,
            noOpenPosition: true,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        }

        await upsertExitExecutionAudit({
          payload,
          status: "no_open_position",
          reason: "no-open-position",
          message: result.closeReason,
        });

        response.status(200).json(result);
        return;
      }

      const result = await closeTradeTransactional(matchedTrade, payload);

      if (!result) {
        logger.info("Close trade webhook handled after trade disappeared before close.", {
          tradeId: matchedTrade.reference.id,
          signalId: matchedTrade.signalId ?? payload.signalId,
          source: payload.source,
          eventId: payload.eventId,
        });

        await upsertExitExecutionAudit({
          payload,
          matchedTrade,
          status: "no_open_position",
          reason: "trade-disappeared-before-close",
          message: "Trade no longer has an open position to close.",
        });

        response.status(200).json({
          ok: true,
          status: "no_open_position",
          tradeId: matchedTrade.reference.id,
          signalId: matchedTrade.signalId ?? payload.signalId,
          duplicate: false,
          alreadyClosed: false,
          result: null,
          exitPrice: payload.exitPrice,
          closeReason: "Trade no longer has an open position to close.",
          matchedBy: matchedTrade.matchedBy,
          resolutionSource: null,
          trade: {
            symbol: payload.symbol,
            side: payload.side,
            entryPrice: null,
            stopPrice: payload.stopPrice,
            targetPrice: payload.targetPrice,
            rrPlanned: null,
            rrActual: null,
            pnlPercent: null,
            pnlDollar: null,
            createdAt: null,
            exitTime: payload.exitTime ? payload.exitTime.toDate().toISOString() : null,
          },
        } satisfies CloseTradeResult);
        return;
      }

      const tradeSnapshot = await matchedTrade.reference.get();
      const trade = tradeSnapshot.exists ? tradeSnapshot.data() as TradeDocument : null;

      await upsertExitExecutionAudit({
        payload,
        matchedTrade,
        trade,
        status: result.status,
        reason:
          result.status === "closed"
            ? "exit-processed"
            : result.status === "already_closed"
              ? "already-closed"
              : "duplicate-exit",
        message: result.closeReason,
      });

      try {
        await upsertTradeRow(
          "1BluPeuDCOlEvMq8BxWj6-V3O_yb97wO10YcPLeWcxpE",
          "trades",
          {
            eventId: payload.eventId ?? "",
            signalId: result.signalId ?? "",
            tradeId: result.tradeId,
            symbol: result.trade.symbol ?? "",
            side: result.trade.side ?? "",
            entryPrice: result.trade.entryPrice ?? "",
            stopPrice: result.trade.stopPrice ?? "",
            targetPrice: result.trade.targetPrice ?? "",
            exitPrice: result.exitPrice ?? "",
            result: result.result ?? "",
            closeReason: result.closeReason ?? "",
            rrPlanned: result.trade.rrPlanned ?? "",
            rrActual: result.trade.rrActual ?? "",
            pnlPercent: result.trade.pnlPercent ?? "",
            pnlDollar: result.trade.pnlDollar ?? "",
            createdAt: result.trade.createdAt ?? "",
            exitTime: result.trade.exitTime ?? "",
          }
        );
      } catch (sheetError) {
        logger.error("Failed to append closed trade to Google Sheets.", {
          requestId,
          tradeId: result.tradeId,
          eventId: payload.eventId,
          error: sheetError instanceof Error ? sheetError.message : String(sheetError),
        });
      }

      logger.info("Close trade webhook final response classified.", {
        requestId,
        tradeId: result.tradeId,
        signalId: result.signalId,
        source: payload.source,
        eventId: payload.eventId,
        status: result.status,
        duplicate: result.duplicate,
        alreadyClosed: result.alreadyClosed,
      });
      response.status(200).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal error.";
      const errorName = error instanceof Error ? error.name : "UnknownError";

      if (errorName === "SymbolMismatch" || errorName === "SideMismatch") {
        logger.info("Close trade webhook handled trade mismatch as no-open-position.", {
          requestId,
          tradeId: payload.tradeId,
          signalId: payload.signalId,
          source: payload.source,
          eventId: payload.eventId,
          error: message,
        });

        await upsertExitExecutionAudit({
          payload,
          status: "no_open_position",
          reason: "trade-mismatch",
          message: "Provided trade details do not match an open trade.",
        });

        response.status(200).json({
          ok: true,
          status: "no_open_position",
          tradeId: payload.tradeId ?? payload.signalId ?? `${payload.symbol ?? "UNKNOWN"}_${payload.side ?? "unknown"}_exit`,
          signalId: payload.signalId,
          duplicate: false,
          alreadyClosed: false,
          result: null,
          exitPrice: payload.exitPrice,
          closeReason: "Provided trade details do not match an open trade.",
          matchedBy: null,
          resolutionSource: null,
          trade: {
            symbol: payload.symbol,
            side: payload.side,
            entryPrice: null,
            stopPrice: payload.stopPrice,
            targetPrice: payload.targetPrice,
            rrPlanned: null,
            rrActual: null,
            pnlPercent: null,
            pnlDollar: null,
            createdAt: null,
            exitTime: payload.exitTime ? payload.exitTime.toDate().toISOString() : null,
          },
        } satisfies CloseTradeResult);
        return;
      }

      if (errorName === "AmbiguousExit") {
        logger.warn("Close trade webhook rejected ambiguous exit.", {
          requestId,
          tradeId: payload.tradeId,
          signalId: payload.signalId,
          symbol: payload.symbol,
          side: payload.side,
          source: payload.source,
          eventId: payload.eventId,
          error: message,
        });
        response.status(400).json({ ok: false, error: "Exit webhook payload is ambiguous." });
        return;
      }

      logger.error("Close trade webhook failed.", {
        requestId,
        tradeId: payload.tradeId,
        signalId: payload.signalId,
        symbol: payload.symbol,
        side: payload.side,
        source: payload.source,
        eventId: payload.eventId,
        error: message,
      });
      response.status(500).json({ ok: false, error: "Internal server error." });
    }
  }
);
