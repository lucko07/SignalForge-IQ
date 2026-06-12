import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { evaluateAutomationExecutionAccess } from "../access.js";
import { AlpacaApiError, closePositionBySymbol, createOrder, getAccount, getOpenPositions, getOrderByClientOrderId } from "../lib/alpaca.js";
import {
  findOpenPositionForSymbol,
  reconcileBrokerPositionState,
} from "./brokerState.js";
import {
  buildClientOrderId,
  buildExecutionId,
  createExecutionReservation,
  findExecutionByClientOrderId,
  findExecutionBySignalId,
  findExecutionByTradeId,
  markSignalRejected,
  markTradeErrored,
  markTradeNotExecuted,
  markTradeRejected,
  updateExecutionStatus,
  updateTradeExecutionReferences,
} from "./firestore.js";
import { getExecutionAutomationSettings } from "./config.js";
import { getCanonicalTradeStatus } from "../tradeLifecycle.js";
import type {
  AlpacaOrderRequest,
  ExecutionAutomationSettings,
  NormalizedTradeRecord,
  ExecutionProtectionStatus,
} from "./types.js";

type ExecuteTradeResult =
  | { status: "submitted"; executionId: string; orderId: string; clientOrderId: string }
  | { status: "skipped"; reason: string; executionId?: string }
  | { status: "duplicate"; reason: string; executionId?: string }
  | { status: "already-open"; executionId: string; reason: string }
  | { status: "position-conflict"; executionId: string; reason: string }
  | { status: "rejected"; executionId: string; reason: string }
  | { status: "error"; executionId?: string; reason: string };

const ACTIVE_TRADE_STATUSES = new Set([
  "processing",
  "submitted",
  "accepted",
  "partially_filled",
  "filled",
  "canceled",
  "expired",
]);

const EXECUTION_TIMEZONE = "America/New_York";
const isDevelopmentRuntime = process.env.FUNCTIONS_EMULATOR === "true" || process.env.NODE_ENV !== "production";
type ExecutionAccessContext = "automation" | "admin-paper-test";

const normalizeSymbol = (value: unknown) => (
  typeof value === "string" ? value.trim().toUpperCase() : ""
);

const normalizeSide = (value: unknown) => (
  typeof value === "string" ? value.trim().toLowerCase() : ""
);

const normalizeTradeId = (value: unknown) => (
  typeof value === "string" ? value.trim() : ""
);

const isFinitePositiveNumber = (value: unknown): value is number => (
  typeof value === "number" && Number.isFinite(value) && value > 0
);

const buildValidationContext = (trade: NormalizedTradeRecord, settings: ExecutionAutomationSettings) => ({
  tradeId: normalizeTradeId(trade.tradeId),
  signalId: trade.signalId ?? null,
  tradeStatus: getCanonicalTradeStatus(trade),
  symbol: normalizeSymbol(trade.symbol),
  side: normalizeSide(trade.side),
  strategyVersion: trade.strategyVersion ?? null,
  timeframe: trade.timeframe ?? null,
  provider: settings.provider,
  mode: settings.mode,
  sizingMode: settings.sizingMode,
  notionalUsd: settings.notionalUsd,
  symbolAllowlist: settings.symbolAllowlist,
  maxOpenPositions: settings.maxOpenPositions,
  maxTradesPerDay: settings.maxTradesPerDay,
  killSwitch: settings.killSwitch,
  allowUnprotectedMarketEntry: settings.allowUnprotectedMarketEntry,
});

const logBlockedExecution = (
  reason: string,
  context: Record<string, unknown>,
  level: "warn" | "info" = "warn"
) => {
  if (isDevelopmentRuntime) {
    console.debug("[alpaca-execution-blocked]", {
      blockedReason: reason,
      ...context,
    });
  }

  logger[level]("Alpaca execution blocked by guardrail.", {
    blockedReason: reason,
    ...context,
  });
};

const getTimezoneOffsetMinutes = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  });
  const offsetPart = formatter
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;
  const match = offsetPart?.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);

  if (!match) {
    return 0;
  }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");

  return sign * ((hours * 60) + minutes);
};

const getDayWindowForTimezone = (timeZone: string, referenceDate = new Date()) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(referenceDate);
  const year = Number(parts.find((part) => part.type === "year")?.value ?? "0");
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "0");
  const day = Number(parts.find((part) => part.type === "day")?.value ?? "0");
  const midnightUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const offsetMinutes = getTimezoneOffsetMinutes(new Date(midnightUtcMs), timeZone);
  const start = new Date(midnightUtcMs - (offsetMinutes * 60 * 1000));
  const end = new Date(start.getTime() + (24 * 60 * 60 * 1000));

  return {
    start,
    end,
    dayKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
};

const normalizeTimestampToDate = (value: unknown) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (
    typeof value === "object"
    && value !== null
    && "toDate" in value
    && typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }

  return null;
};

const shouldCountTowardDailyTradeCap = (execution: Record<string, unknown>) => {
  const status = typeof execution.status === "string" ? execution.status.trim().toLowerCase() : "";
  return ACTIVE_TRADE_STATUSES.has(status) || execution.orderRequest != null;
};

const getTodayExecutionCount = async ({
  db,
  executionUid,
  currentExecutionId,
}: {
  db: Firestore;
  executionUid: string | null;
  currentExecutionId: string;
}) => {
  const dayWindow = getDayWindowForTimezone(EXECUTION_TIMEZONE);
  const executionCollection = db.collection("executions");
  const snapshot = executionUid
    ? await executionCollection.where("uid", "==", executionUid).get()
    : await executionCollection.limit(200).get();

  const count = snapshot.docs.filter((documentSnapshot) => {
    if (documentSnapshot.id === currentExecutionId) {
      return false;
    }

    const data = documentSnapshot.data() as Record<string, unknown>;
    const createdAt = normalizeTimestampToDate(data.createdAt);

    if (!createdAt) {
      return false;
    }

    return data.provider === "alpaca"
      && data.mode === "paper"
      && (executionUid ? data.uid === executionUid : true)
      && createdAt >= dayWindow.start
      && createdAt < dayWindow.end
      && shouldCountTowardDailyTradeCap(data);
  }).length;

  return {
    count,
    dayKey: dayWindow.dayKey,
  };
};

const validateTradeEligibility = (
  trade: NormalizedTradeRecord,
  settings: ExecutionAutomationSettings
) => {
  const tradeId = normalizeTradeId(trade.tradeId);
  const tradeStatus = getCanonicalTradeStatus(trade);
  const symbol = normalizeSymbol(trade.symbol);
  const side = normalizeSide(trade.side);

  if (!settings.enabled) {
    return { eligible: false, reason: "automation-disabled" };
  }

  if (settings.killSwitch) {
    return { eligible: false, reason: "kill-switch-enabled" };
  }

  if (!tradeId) {
    return { eligible: false, reason: "missing-trade-id" };
  }

  if (trade.isArchived === true) {
    return { eligible: false, reason: "trade-archived" };
  }

  if (trade.isValid === false) {
    return { eligible: false, reason: "trade-invalid" };
  }

  if (trade.isTest === true) {
    return { eligible: false, reason: "trade-marked-test" };
  }

  if (tradeStatus !== null && tradeStatus !== "pending_execution") {
    if (tradeStatus === "open") {
      return { eligible: false, reason: "trade-already-open" };
    }

    return { eligible: false, reason: "trade-finalized" };
  }

  if (!settings.symbolAllowlist.includes(symbol)) {
    return { eligible: false, reason: "symbol-not-allowed" };
  }

  if (side !== "long" && side !== "short") {
    return { eligible: false, reason: "unsupported-side" };
  }

  if (side === "long" && !settings.longsEnabled) {
    return { eligible: false, reason: "longs-disabled" };
  }

  if (side === "short" && !settings.shortsEnabled) {
    return { eligible: false, reason: "shorts-disabled" };
  }

  if (!isFinitePositiveNumber(trade.entryPrice)) {
    return { eligible: false, reason: "missing-entry-price" };
  }

  if (!isFinitePositiveNumber(trade.stopPrice)) {
    return { eligible: false, reason: "missing-stop-price" };
  }

  if (!isFinitePositiveNumber(trade.targetPrice)) {
    return { eligible: false, reason: "missing-target-price" };
  }

  return { eligible: true as const, symbol, side: side as "long" | "short" };
};

const mapBrokerOrderStatusToExecutionStatus = (rawStatus: string | null | undefined) => {
  const normalized = typeof rawStatus === "string" ? rawStatus.trim().toLowerCase() : "";

  if (normalized === "new" || normalized === "pending_new" || normalized === "pending_replace") {
    return "submitted" as const;
  }

  if (normalized === "accepted" || normalized === "accepted_for_bidding") {
    return "accepted" as const;
  }

  if (normalized === "partially_filled") {
    return "partially_filled" as const;
  }

  if (normalized === "filled") {
    return "filled" as const;
  }

  if (normalized === "canceled" || normalized === "pending_cancel") {
    return "canceled" as const;
  }

  if (normalized === "expired") {
    return "expired" as const;
  }

  if (normalized === "rejected" || normalized === "stopped" || normalized === "suspended") {
    return "rejected" as const;
  }

  return "submitted" as const;
};

const getAccessBlockedMessage = (reason: string) => {
  if (reason === "not-elite") {
    return "Execution blocked: account is not on the Elite automation plan.";
  }

  if (reason === "inactive-subscription") {
    return "Execution blocked: subscription is inactive.";
  }

  if (reason === "not-approved") {
    return "Execution blocked: account is not approved for automation.";
  }

  if (reason === "admin-only-paper-testing") {
    return "Execution blocked: paper testing is reserved for admins.";
  }

  return `Execution blocked: ${reason}.`;
};

const isOpenPositionExistsBrokerError = (error: unknown) => {
  if (!(error instanceof AlpacaApiError)) {
    return false;
  }

  const message = error.message.trim().toLowerCase();
  return message.includes("open") && message.includes("position") && message.includes("exists");
};

const validateBracketGeometry = (trade: NormalizedTradeRecord) => {
  logger.info("protection geometry validation started", {
    tradeId: normalizeTradeId(trade.tradeId),
    signalId: trade.signalId ?? null,
    symbol: normalizeSymbol(trade.symbol),
    side: normalizeSide(trade.side),
    entryPrice: trade.entryPrice ?? null,
    stopPrice: trade.stopPrice ?? null,
    targetPrice: trade.targetPrice ?? null,
  });
  const side = normalizeSide(trade.side);
  const entryPrice = trade.entryPrice ?? null;
  const stopPrice = trade.stopPrice ?? null;
  const targetPrice = trade.targetPrice ?? null;

  if (!isFinitePositiveNumber(entryPrice) || !isFinitePositiveNumber(stopPrice) || !isFinitePositiveNumber(targetPrice)) {
    logger.warn("protection geometry failed", { tradeId: normalizeTradeId(trade.tradeId), reason: "invalid_protection_geometry" });
    return { valid: false as const, reason: "invalid_protection_geometry" };
  }

  if (side === "long" && !(stopPrice < entryPrice && entryPrice < targetPrice)) {
    logger.warn("protection geometry failed", { tradeId: normalizeTradeId(trade.tradeId), reason: "invalid_protection_geometry" });
    return { valid: false as const, reason: "invalid_protection_geometry" };
  }

  if (side === "short" && !(targetPrice < entryPrice && entryPrice < stopPrice)) {
    logger.warn("protection geometry failed", { tradeId: normalizeTradeId(trade.tradeId), reason: "invalid_protection_geometry" });
    return { valid: false as const, reason: "invalid_protection_geometry" };
  }

  logger.info("protection geometry passed", { tradeId: normalizeTradeId(trade.tradeId) });
  return { valid: true as const };
};

const recordBlockedExecution = async ({
  db,
  trade,
  automationSettings,
  executionUid,
  executionId,
  clientOrderId,
  status,
  reason,
  message,
  brokerSnapshot,
  brokerAccountId,
  brokerPositionConflict,
  noOp,
  tradeEligible,
  brokerReconciliationState,
  reservationAlreadyExists,
  orderClass,
  takeProfitPrice,
  stopLossPrice,
  protectionStatus,
  protectionMode,
  protectionActivatedAt,
  protectionFailedAt,
  protectionError,
  stopOrderId,
  takeProfitOrderId,
}: {
  db: Firestore;
  trade: NormalizedTradeRecord;
  automationSettings: ExecutionAutomationSettings;
  executionUid: string | null;
  executionId: string;
  clientOrderId: string;
  status: "rejected" | "position_conflict" | "skipped" | "already_open" | "broker_rejected" | "protection_failed";
  reason: string;
  message: string;
  brokerSnapshot?: Record<string, unknown> | null;
  brokerAccountId?: string | null;
  brokerPositionConflict?: boolean;
  noOp?: boolean;
  tradeEligible?: boolean;
  brokerReconciliationState?: "no_position" | "same_side_open" | "opposite_side_open" | "state_mismatch" | null;
  reservationAlreadyExists?: boolean;
  orderClass?: "simple" | "bracket" | null;
  takeProfitPrice?: number | null;
  stopLossPrice?: number | null;
  protectionStatus?: ExecutionProtectionStatus | null;
  protectionMode?: "synthetic_oco" | null;
  protectionActivatedAt?: unknown;
  protectionFailedAt?: unknown;
  protectionError?: string | null;
  stopOrderId?: string | null;
  takeProfitOrderId?: string | null;
}) => {
  if (reservationAlreadyExists !== true) {
    try {
      await createExecutionReservation({
        db,
        executionId,
        trade,
        clientOrderId,
        automationSettings,
        uid: executionUid,
      });
    } catch (error) {
      logger.warn("Alpaca execution rejection reservation already exists.", {
        executionId,
        clientOrderId,
        reason,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await updateExecutionStatus({
    db,
    executionId,
    patch: {
      status,
      brokerAccountId: brokerAccountId ?? null,
      brokerPositionConflict: brokerPositionConflict === true,
      brokerSnapshot: brokerSnapshot ?? null,
      noOp: noOp === true,
      brokerReconciliationState: brokerReconciliationState ?? null,
      reconciliationReason: reason,
      errorCode: reason,
      errorMessage: message,
      validation: {
        tradeEligible: tradeEligible === true,
        reason,
        tradeResult: trade.tradeResult ?? trade.status ?? trade.result ?? null,
        isArchived: trade.isArchived === true,
        isValid: trade.isValid !== false,
        isTest: trade.isTest === true,
      },
      error: {
        code: reason,
        message,
      },
    },
  });

  if (status === "skipped" || status === "already_open") {
    await markTradeNotExecuted({
      db,
      tradeId: trade.tradeId,
      executionId,
      clientOrderId,
      executionUid,
      executionStatus: status === "skipped" ? "not_sent" : status,
      brokerStatus: status,
      brokerPositionConflict,
      noOp,
      reason,
      orderClass,
      takeProfitPrice,
      stopLossPrice,
      protectionStatus,
      protectionMode,
      protectionActivatedAt,
      protectionFailedAt,
      protectionError,
      stopOrderId,
      takeProfitOrderId,
    });
    return;
  }

  await markTradeRejected({
    db,
    tradeId: trade.tradeId,
    executionId,
    clientOrderId,
    executionUid,
    executionStatus: status,
    brokerStatus: status,
    brokerPositionConflict,
    noOp,
    reason,
    orderClass,
    takeProfitPrice,
    stopLossPrice,
    protectionStatus,
    protectionMode,
    protectionActivatedAt,
    protectionFailedAt,
    protectionError,
    stopOrderId,
    takeProfitOrderId,
  });

  if (reason === "shorts-disabled") {
    await markSignalRejected({
      db,
      signalId: trade.signalId,
      executionStatus: "rejected",
      reason,
    });
  }
};

export const validatePaperExecutionEligibility = (
  trade: NormalizedTradeRecord,
  settings: ExecutionAutomationSettings = getExecutionAutomationSettings()
) => {
  const eligibility = validateTradeEligibility(trade, settings);

  logger.info("Alpaca execution eligibility evaluated.", {
    tradeId: normalizeTradeId(trade.tradeId),
    signalId: trade.signalId ?? null,
    symbol: normalizeSymbol(trade.symbol),
    side: normalizeSide(trade.side),
    automationSettings: settings,
    eligibility,
  });

  return eligibility;
};

const buildOrderRequest = (
  trade: NormalizedTradeRecord,
  automationSettings: ExecutionAutomationSettings,
  clientOrderId: string
): AlpacaOrderRequest => ({
  symbol: normalizeSymbol(trade.symbol),
  side: normalizeSide(trade.side) === "short" ? "sell" : "buy",
  type: "market",
  time_in_force: "gtc",
  client_order_id: clientOrderId,
  notional: automationSettings.notionalUsd.toFixed(2),
});

const buildSyntheticProtectionOrders = ({
  trade,
  symbol,
  filledQty,
  clientOrderId,
}: {
  trade: NormalizedTradeRecord;
  symbol: string;
  filledQty: string;
  clientOrderId: string;
}) => {
  const side = normalizeSide(trade.side) === "short" ? "buy" : "sell";
  const stopOrder: AlpacaOrderRequest = {
    symbol,
    side,
    type: "stop_limit",
    time_in_force: "gtc",
    qty: filledQty,
    stop_price: Number(trade.stopPrice).toFixed(2),
    limit_price: Number(trade.stopPrice).toFixed(2),
    client_order_id: `${clientOrderId}_STOP`,
  };
  const takeProfitOrder: AlpacaOrderRequest = {
    symbol,
    side,
    type: "limit",
    time_in_force: "gtc",
    qty: filledQty,
    limit_price: Number(trade.targetPrice).toFixed(2),
    client_order_id: `${clientOrderId}_TP`,
  };
  return { stopOrder, takeProfitOrder };
};

export const executeTradeThroughAlpacaPaper = async ({
  db,
  trade,
  automationSettings = getExecutionAutomationSettings(),
  executionUid = null,
  accessContext = "automation",
}: {
  db: Firestore;
  trade: NormalizedTradeRecord;
  automationSettings?: ExecutionAutomationSettings;
  executionUid?: string | null;
  accessContext?: ExecutionAccessContext;
}): Promise<ExecuteTradeResult> => {
  const validationContext = buildValidationContext(trade, automationSettings);
  const tradeId = normalizeTradeId(trade.tradeId);

  logger.info("Alpaca execution validation started.", validationContext);

  if (!tradeId) {
    logBlockedExecution("missing-trade-id", validationContext);
    return { status: "skipped", reason: "missing-trade-id" };
  }

  const executionId = buildExecutionId(tradeId);
  const clientOrderId = buildClientOrderId(tradeId);

  if (!executionUid) {
    logBlockedExecution("admin-only-paper-testing", {
      ...validationContext,
      executionId,
      clientOrderId,
      accessContext,
      executionUid,
    });

    await recordBlockedExecution({
      db,
      trade,
      automationSettings,
      executionUid,
      executionId,
      clientOrderId,
      status: "rejected",
      reason: "admin-only-paper-testing",
      message: getAccessBlockedMessage("admin-only-paper-testing"),
    });

    return {
      status: "rejected",
      executionId,
      reason: "admin-only-paper-testing",
    };
  }

  const executionProfileSnapshot = await db.collection("users").doc(executionUid).get();
  const executionProfile = executionProfileSnapshot.exists ? executionProfileSnapshot.data() : null;
  const accessDecision = evaluateAutomationExecutionAccess(executionProfile, {
    adminOnly: accessContext === "admin-paper-test",
  });

  if (!accessDecision.allowed) {
    logBlockedExecution(accessDecision.reason, {
      ...validationContext,
      executionId,
      clientOrderId,
      accessContext,
      executionUid,
      profileExists: executionProfileSnapshot.exists,
      effectivePlan: accessDecision.effectivePlan,
      isAdmin: accessDecision.isAdmin,
      subscriptionActive:
        executionProfile && typeof executionProfile.subscriptionActive === "boolean"
          ? executionProfile.subscriptionActive
          : null,
      approved:
        executionProfile && typeof executionProfile.approved === "boolean"
          ? executionProfile.approved
          : null,
    });

    await recordBlockedExecution({
      db,
      trade,
      automationSettings,
      executionUid,
      executionId,
      clientOrderId,
      status: "rejected",
      reason: accessDecision.reason,
      message: getAccessBlockedMessage(accessDecision.reason),
    });

    return {
      status: "rejected",
      executionId,
      reason: accessDecision.reason,
    };
  }

  const existingByExecution = await db.collection("executions").doc(executionId).get();
  if (existingByExecution.exists) {
    logger.warn("Alpaca execution duplicate detected by execution document.", {
      ...validationContext,
      executionId,
      clientOrderId,
    });
    return { status: "duplicate", reason: "execution-document-exists", executionId };
  }

  const existingByTradeId = await findExecutionByTradeId(db, tradeId);
  if (existingByTradeId) {
    logger.warn("Alpaca execution duplicate detected by tradeId.", {
      ...validationContext,
      executionId: existingByTradeId.id,
      clientOrderId,
    });
    return { status: "duplicate", reason: "trade-execution-exists", executionId: existingByTradeId.id };
  }

  const existingByClientOrderId = await findExecutionByClientOrderId(db, clientOrderId);
  if (existingByClientOrderId) {
    logger.warn("Alpaca execution duplicate detected by clientOrderId.", {
      ...validationContext,
      executionId: existingByClientOrderId.id,
      clientOrderId,
    });
    return {
      status: "duplicate",
      reason: "client-order-id-exists",
      executionId: existingByClientOrderId.id,
    };
  }

  const normalizedSignalId = typeof trade.signalId === "string" ? trade.signalId.trim() : "";
  if (normalizedSignalId) {
    const existingBySignalId = await findExecutionBySignalId(db, normalizedSignalId);
    if (existingBySignalId) {
      logger.warn("Alpaca execution duplicate detected by signalId/eventId.", {
        ...validationContext,
        executionId: existingBySignalId.id,
        signalId: normalizedSignalId,
        clientOrderId,
      });
      return {
        status: "duplicate",
        reason: "signal-id-exists",
        executionId: existingBySignalId.id,
      };
    }
  }

  const eligibility = validateTradeEligibility(trade, automationSettings);

  if (!eligibility.eligible) {
    const blockedStatus = eligibility.reason === "automation-disabled" ? "skipped" : "rejected";
    logBlockedExecution(eligibility.reason, {
      ...validationContext,
      executionId,
      clientOrderId,
    });

    await recordBlockedExecution({
      db,
      trade,
      automationSettings,
      executionUid,
      executionId,
      clientOrderId,
      status: blockedStatus,
      reason: eligibility.reason,
      message: `Execution blocked: ${eligibility.reason}.`,
    });

    return {
      status: blockedStatus,
      executionId,
      reason: eligibility.reason,
    };
  }

  const eligibleSymbol = eligibility.symbol;
  const eligibleSide = eligibility.side;

  if (!eligibleSymbol || !eligibleSide) {
    await recordBlockedExecution({
      db,
      trade,
      automationSettings,
      executionUid,
      executionId,
      clientOrderId,
      status: "rejected",
      reason: "missing-eligibility-context",
      message: "Execution eligibility did not provide symbol/side.",
    });

    return {
      status: "rejected",
      executionId,
      reason: "missing-eligibility-context",
    };
  }

  const bracketGeometry = validateBracketGeometry(trade);
  if (!bracketGeometry.valid) {
    await recordBlockedExecution({
      db,
      trade,
      automationSettings,
      executionUid,
      executionId,
      clientOrderId,
      status: "rejected",
      reason: bracketGeometry.reason,
      message: "Execution blocked: invalid protection geometry for entry/stop/target prices.",
      orderClass: "simple",
      takeProfitPrice: trade.targetPrice ?? null,
      stopLossPrice: trade.stopPrice ?? null,
      protectionStatus: "failed",
      protectionMode: "synthetic_oco",
    });

    return {
      status: "rejected",
      executionId,
      reason: bracketGeometry.reason,
    };
  }

  try {
    await createExecutionReservation({
      db,
      executionId,
      trade,
      clientOrderId,
      automationSettings,
      uid: executionUid,
    });
  } catch (error) {
    logger.warn("Alpaca execution reservation rejected as duplicate.", {
      ...validationContext,
      executionId,
      clientOrderId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { status: "duplicate", reason: "execution-reservation-exists", executionId };
  }

  try {
    const todaysExecutionCount = await getTodayExecutionCount({
      db,
      executionUid,
      currentExecutionId: executionId,
    });

    if (todaysExecutionCount.count >= automationSettings.maxTradesPerDay) {
      logBlockedExecution("daily-trade-cap-reached", {
        ...validationContext,
        executionId,
        clientOrderId,
        dayKey: todaysExecutionCount.dayKey,
        todaysExecutionCount: todaysExecutionCount.count,
      });

      await recordBlockedExecution({
        db,
        trade,
        automationSettings,
        executionUid,
        executionId,
        clientOrderId,
        status: "rejected",
        reason: "daily-trade-cap-reached",
        message: `Execution blocked: daily trade cap of ${automationSettings.maxTradesPerDay} reached for ${todaysExecutionCount.dayKey}.`,
        reservationAlreadyExists: true,
      });

      return {
        status: "rejected",
        executionId,
        reason: "daily-trade-cap-reached",
      };
    }

    const [account, positions] = await Promise.all([getAccount(), getOpenPositions()]);
    const openPositionSymbols = positions.map((position) => normalizeSymbol(position.symbol)).filter(Boolean);
    const brokerPosition = findOpenPositionForSymbol(positions, eligibleSymbol);
    const brokerPositionReconciliation = reconcileBrokerPositionState({
      symbol: eligibleSymbol,
      desiredSide: eligibleSide,
      firestoreTradeState: getCanonicalTradeStatus(trade) ?? trade.result ?? "unknown",
      brokerPosition,
    });
    const maxOpenPositionsReached = openPositionSymbols.length >= automationSettings.maxOpenPositions;

    logger.info("Alpaca broker position snapshot before entry submit.", {
      ...validationContext,
      executionId,
      clientOrderId,
      reconciliationState: brokerPositionReconciliation.state,
      reconciliationReason: brokerPositionReconciliation.reason,
      brokerPosition: brokerPositionReconciliation.brokerSnapshot,
      openPositionSymbols,
    });

    if (brokerPositionReconciliation.state === "same_side_open") {
      logBlockedExecution("open-position-exists", {
        ...validationContext,
        executionId,
        clientOrderId,
        branch: "same-side-open",
        brokerPosition: brokerPositionReconciliation.brokerSnapshot,
        openPositionSymbols,
      });

      await recordBlockedExecution({
        db,
        trade,
        automationSettings,
        executionUid,
        executionId,
        clientOrderId,
        status: "already_open",
        reason: "open-position-exists",
        message: "Open BTCUSD position already exists in Alpaca paper account.",
        brokerAccountId: account.id ?? null,
        brokerSnapshot: {
          openPositionSymbols,
          reconciliationState: brokerPositionReconciliation.state,
          brokerPosition: brokerPositionReconciliation.brokerSnapshot,
        },
        brokerPositionConflict: true,
        noOp: true,
        tradeEligible: true,
        brokerReconciliationState: brokerPositionReconciliation.state,
        reservationAlreadyExists: true,
      });

      logger.info("Entry order skipped as no-op because broker already has same-side position.", {
        ...validationContext,
        executionId,
        clientOrderId,
        reconciliationState: brokerPositionReconciliation.state,
      });

      return {
        status: "already-open",
        executionId,
        reason: "open-position-exists",
      };
    }

    if (brokerPositionReconciliation.state === "opposite_side_open") {
      logBlockedExecution("opposite-side-position-open", {
        ...validationContext,
        executionId,
        clientOrderId,
        branch: "opposite-side-open",
        brokerPosition: brokerPositionReconciliation.brokerSnapshot,
        openPositionSymbols,
      });

      await recordBlockedExecution({
        db,
        trade,
        automationSettings,
        executionUid,
        executionId,
        clientOrderId,
        status: "position_conflict",
        reason: "opposite-side-position-open",
        message: "Opposite-side BTCUSD position is already open in Alpaca paper account.",
        brokerAccountId: account.id ?? null,
        brokerSnapshot: {
          openPositionSymbols,
          reconciliationState: brokerPositionReconciliation.state,
          brokerPosition: brokerPositionReconciliation.brokerSnapshot,
        },
        brokerPositionConflict: true,
        noOp: true,
        tradeEligible: true,
        brokerReconciliationState: brokerPositionReconciliation.state,
        reservationAlreadyExists: true,
      });

      return {
        status: "position-conflict",
        executionId,
        reason: "opposite-side-position-open",
      };
    }

    if (maxOpenPositionsReached) {
      logBlockedExecution("max-open-positions-reached", {
        ...validationContext,
        executionId,
        clientOrderId,
        openPositionCount: openPositionSymbols.length,
        openPositionSymbols,
      });

      await recordBlockedExecution({
        db,
        trade,
        automationSettings,
        executionUid,
        executionId,
        clientOrderId,
        status: "rejected",
        reason: "max-open-positions-reached",
        message: `Execution blocked: max open positions limit of ${automationSettings.maxOpenPositions} reached.`,
        brokerAccountId: account.id ?? null,
        brokerSnapshot: {
          openPositionSymbols,
          reconciliationState: brokerPositionReconciliation.state,
          brokerPosition: brokerPositionReconciliation.brokerSnapshot,
        },
        reservationAlreadyExists: true,
      });

      return {
        status: "rejected",
        executionId,
        reason: "max-open-positions-reached",
      };
    }

    const orderRequest = buildOrderRequest(trade, automationSettings, clientOrderId);
    let protectionStatus: ExecutionProtectionStatus | null = null;
    const orderClass: "simple" = "simple";
    let stopOrderId: string | null = null;
    let takeProfitOrderId: string | null = null;

    logger.info("Alpaca execution order submission started.", {
      ...validationContext,
      executionId,
      clientOrderId,
      entryPrice: trade.entryPrice ?? null,
      stopPrice: trade.stopPrice ?? null,
      targetPrice: trade.targetPrice ?? null,
      orderClass,
      protectionStatus,
      orderRequest,
    });

    const safeOrderResponse = await createOrder(orderRequest);
    const brokerExecutionStatus = mapBrokerOrderStatusToExecutionStatus(safeOrderResponse.status ?? null);
    const brokerErrorMessage = (
      brokerExecutionStatus === "canceled"
        ? "Order was canceled in Alpaca paper."
        : brokerExecutionStatus === "expired"
          ? "Order expired in Alpaca paper."
          : brokerExecutionStatus === "rejected"
            ? "Order was rejected by Alpaca paper."
            : null
    );

    logger.info("Alpaca execution order submission succeeded.", {
      ...validationContext,
      executionId,
      clientOrderId,
      orderId: safeOrderResponse.id,
      orderStatus: safeOrderResponse.status,
      filledQty: safeOrderResponse.filled_qty ?? null,
      filledAvgPrice: safeOrderResponse.filled_avg_price ?? null,
      orderClass,
      protectionStatus: null,
    });

    const filledQty = safeOrderResponse.filled_qty?.trim() ?? "";
    logger.info("entry fill confirmed", {
      tradeId,
      signalId: trade.signalId ?? null,
      symbol: eligibleSymbol,
      side: eligibleSide,
      brokerExecutionStatus,
      filledQty,
      brokerFilledAvgPrice: safeOrderResponse.filled_avg_price ?? null,
    });
    if (brokerExecutionStatus === "filled" && !filledQty) {
      protectionStatus = "failed";
      await recordBlockedExecution({
        db,
        trade,
        automationSettings,
        executionUid,
        executionId,
        clientOrderId,
        status: "protection_failed",
        reason: "protection-submit-failed",
        message: "Filled entry is missing filled quantity; synthetic protection cannot be placed.",
        brokerAccountId: account.id ?? null,
        reservationAlreadyExists: true,
        orderClass,
        takeProfitPrice: trade.targetPrice ?? null,
        stopLossPrice: trade.stopPrice ?? null,
        protectionStatus: "failed",
        protectionMode: "synthetic_oco",
      });
      return {
        status: "rejected",
        executionId,
        reason: "protection-submit-failed",
      };
    }

    if (brokerExecutionStatus === "filled" && filledQty) {
      logger.info("Synthetic OCO placement started", {
        tradeId,
        signalId: trade.signalId ?? null,
        symbol: eligibleSymbol,
        side: eligibleSide,
      });
      try {
        const existingExecution = await db.collection("executions").doc(executionId).get();
        const existingData = existingExecution.data() as Record<string, unknown> | undefined;
        stopOrderId = typeof existingData?.stopOrderId === "string" ? existingData.stopOrderId : null;
        takeProfitOrderId = typeof existingData?.takeProfitOrderId === "string" ? existingData.takeProfitOrderId : null;
        if (stopOrderId && takeProfitOrderId) {
          protectionStatus = "active";
          logger.info("Synthetic OCO active", {
            tradeId,
            signalId: trade.signalId ?? null,
            symbol: eligibleSymbol,
            side: eligibleSide,
            stopOrderId,
            takeProfitOrderId,
          });
        } else {
        const protectionOrders = buildSyntheticProtectionOrders({
          trade,
          symbol: eligibleSymbol,
          filledQty,
          clientOrderId,
        });
        logger.info("stop order submission started", {
          tradeId,
          signalId: trade.signalId ?? null,
          symbol: eligibleSymbol,
          side: eligibleSide,
          payload: protectionOrders.stopOrder,
        });
        const stopOrder = await createOrder(protectionOrders.stopOrder);
        logger.info("Synthetic OCO stop order submitted", {
          tradeId,
          signalId: trade.signalId ?? null,
          symbol: eligibleSymbol,
          side: eligibleSide,
          stopOrderId: stopOrder.id ?? null,
        });
        logger.info("take-profit order submission started", {
          tradeId,
          signalId: trade.signalId ?? null,
          symbol: eligibleSymbol,
          side: eligibleSide,
          payload: protectionOrders.takeProfitOrder,
        });
        const takeProfitOrder = await createOrder(protectionOrders.takeProfitOrder);
        logger.info("Synthetic OCO take-profit order submitted", {
          tradeId,
          signalId: trade.signalId ?? null,
          symbol: eligibleSymbol,
          side: eligibleSide,
          takeProfitOrderId: takeProfitOrder.id ?? null,
        });
        stopOrderId = stopOrder.id ?? null;
        takeProfitOrderId = takeProfitOrder.id ?? null;
        if (!stopOrderId) {
          const recoveredStop = await getOrderByClientOrderId(`${clientOrderId}_STOP`);
          stopOrderId = recoveredStop?.id ?? null;
        }
        if (!takeProfitOrderId) {
          const recoveredTp = await getOrderByClientOrderId(`${clientOrderId}_TP`);
          takeProfitOrderId = recoveredTp?.id ?? null;
        }
        protectionStatus = stopOrderId && takeProfitOrderId ? "active" : "failed";
        logger.info("Synthetic OCO active", {
          tradeId,
          signalId: trade.signalId ?? null,
          symbol: eligibleSymbol,
          side: eligibleSide,
          stopOrderId,
          takeProfitOrderId,
        });
        }
      } catch (protectionError) {
        protectionStatus = "failed";
        logger.error("Synthetic OCO placement failed", {
          tradeId,
          signalId: trade.signalId ?? null,
          symbol: eligibleSymbol,
          side: eligibleSide,
          entryPrice: trade.entryPrice ?? null,
          stopPrice: trade.stopPrice ?? null,
          targetPrice: trade.targetPrice ?? null,
          error: protectionError instanceof Error ? protectionError.message : String(protectionError),
        });

        const emergencyClose = await closePositionBySymbol(eligibleSymbol).catch(() => null);
        const emergencyCloseSucceeded = Boolean(emergencyClose?.id);

        await recordBlockedExecution({
          db,
          trade,
          automationSettings,
          executionUid,
          executionId,
          clientOrderId,
          status: emergencyCloseSucceeded ? "broker_rejected" : "protection_failed",
          reason: "protection-submit-failed",
          message: emergencyCloseSucceeded
            ? "Synthetic OCO protection failed and position was force-closed for safety."
            : "Synthetic OCO protection failed and emergency close did not return an order id.",
          brokerAccountId: account.id ?? null,
          reservationAlreadyExists: true,
          orderClass,
          takeProfitPrice: trade.targetPrice ?? null,
          stopLossPrice: trade.stopPrice ?? null,
          protectionStatus: "failed",
          protectionMode: "synthetic_oco",
          protectionFailedAt: FieldValue.serverTimestamp(),
          protectionError: protectionError instanceof Error ? protectionError.message : String(protectionError),
          stopOrderId,
          takeProfitOrderId,
        });

        await updateExecutionStatus({
          db,
          executionId,
          patch: {
            protectionStatus: "failed",
            protectionMode: "synthetic_oco",
            protectionFailedAt: FieldValue.serverTimestamp(),
            protectionError: protectionError instanceof Error ? protectionError.message : String(protectionError),
            executionStatus: emergencyCloseSucceeded ? "broker_rejected" : "protection_failed",
            status: emergencyCloseSucceeded ? "broker_rejected" : "protection_failed",
            closeReason: emergencyCloseSucceeded ? "protection_failed_force_close" : null,
          },
        });

        return {
          status: "rejected",
          executionId,
          reason: "protection-submit-failed",
        };
      }
    }

    await updateExecutionStatus({
      db,
      executionId,
      patch: {
        status: brokerExecutionStatus,
        brokerAccountId: account.id ?? null,
        alpacaOrderId: safeOrderResponse.id,
        brokerOrderStatus: safeOrderResponse.status ?? null,
        rawStatus: safeOrderResponse.status ?? null,
        orderClass,
        takeProfitPrice: trade.targetPrice ?? null,
        stopLossPrice: trade.stopPrice ?? null,
        protectionStatus,
        protectionMode: protectionStatus ? "synthetic_oco" : null,
        protectionActivatedAt: protectionStatus === "active" ? FieldValue.serverTimestamp() : null,
        protectionFailedAt: protectionStatus === "failed" ? FieldValue.serverTimestamp() : null,
        protectionError: null,
        stopOrderId,
        takeProfitOrderId,
        brokerPositionConflict: false,
        brokerSnapshot: {
          openPositionSymbols,
          reconciliationState: brokerPositionReconciliation.state,
          brokerPosition: brokerPositionReconciliation.brokerSnapshot,
        },
        noOp: false,
        brokerReconciliationState: brokerPositionReconciliation.state,
        reconciliationReason: brokerPositionReconciliation.reason,
        orderRequest,
        orderResponse: safeOrderResponse,
        qty: safeOrderResponse.qty ?? null,
        notional: orderRequest.notional,
        filledQty: safeOrderResponse.filled_qty ?? null,
        filledAvgPrice: safeOrderResponse.filled_avg_price ?? null,
        errorCode: brokerErrorMessage ? brokerExecutionStatus : null,
        errorMessage: brokerErrorMessage,
        validation: {
          tradeEligible: true,
          reason: null,
          tradeResult: trade.tradeResult ?? trade.status ?? trade.result ?? null,
          isArchived: trade.isArchived === true,
          isValid: trade.isValid !== false,
          isTest: trade.isTest === true,
        },
        submittedAt: safeOrderResponse.submitted_at ? new Date(safeOrderResponse.submitted_at) : FieldValue.serverTimestamp(),
        filledAt: safeOrderResponse.filled_at ? new Date(safeOrderResponse.filled_at) : null,
        canceledAt: safeOrderResponse.canceled_at ? new Date(safeOrderResponse.canceled_at) : null,
        error: brokerErrorMessage
          ? {
            code: brokerExecutionStatus,
            message: brokerErrorMessage,
          }
          : null,
      },
    });

    logger.info("Alpaca execution Firestore write succeeded.", {
      ...validationContext,
      executionId,
      clientOrderId,
      orderId: safeOrderResponse.id,
      stopOrderId,
      takeProfitOrderId,
      protectionStatus,
    });

    await updateTradeExecutionReferences({
      db,
      tradeId,
      executionId,
      clientOrderId,
      orderId: safeOrderResponse.id,
      orderStatus: brokerExecutionStatus,
      executionUid,
      brokerStatus: safeOrderResponse.status ?? brokerExecutionStatus,
      brokerFilledQty: safeOrderResponse.filled_qty ?? null,
      brokerFilledAvgPrice: safeOrderResponse.filled_avg_price ?? null,
      orderClass,
      takeProfitPrice: trade.targetPrice ?? null,
      stopLossPrice: trade.stopPrice ?? null,
      protectionStatus,
      protectionMode: protectionStatus ? "synthetic_oco" : null,
      protectionActivatedAt: protectionStatus === "active" ? FieldValue.serverTimestamp() : null,
      protectionFailedAt: protectionStatus === "failed" ? FieldValue.serverTimestamp() : null,
      protectionError: null,
      stopOrderId,
      takeProfitOrderId,
      executionSubmittedAt: safeOrderResponse.submitted_at ? new Date(safeOrderResponse.submitted_at) : FieldValue.serverTimestamp(),
    });

    logger.info("Alpaca execution trade reference update succeeded.", {
      ...validationContext,
      executionId,
      clientOrderId,
      orderId: safeOrderResponse.id,
      orderClass,
      protectionStatus,
    });

    return {
      status: "submitted",
      executionId,
      orderId: safeOrderResponse.id,
      clientOrderId,
    };
  } catch (error) {
    if (isOpenPositionExistsBrokerError(error)) {
      logger.warn("Entry order rejected by broker because position is already open. Treated as no-op.", {
        ...validationContext,
        executionId,
        clientOrderId,
      });

      await recordBlockedExecution({
        db,
        trade,
        automationSettings,
        executionUid,
        executionId,
        clientOrderId,
        status: "already_open",
        reason: "open-position-exists",
        message: "Open BTCUSD position already exists in Alpaca paper account.",
        brokerPositionConflict: true,
        noOp: true,
        brokerReconciliationState: "same_side_open",
        reservationAlreadyExists: true,
      });

      return {
        status: "already-open",
        executionId,
        reason: "open-position-exists",
      };
    }

    logger.error("Alpaca execution failed.", {
      ...validationContext,
      executionId,
      clientOrderId,
      error: error instanceof Error ? error.message : String(error),
    });

    await updateExecutionStatus({
      db,
      executionId,
      patch: {
        status: "error",
        errorCode: error instanceof Error ? error.name : "unknown-error",
        errorMessage: error instanceof Error ? error.message : String(error),
        error: {
          code: error instanceof Error ? error.name : "unknown-error",
          message: error instanceof Error ? error.message : String(error),
        },
      },
    }).catch((firestoreError) => {
      logger.error("Alpaca execution Firestore failure while recording error state.", {
        ...validationContext,
        executionId,
        clientOrderId,
        error: firestoreError instanceof Error ? firestoreError.message : String(firestoreError),
      });
    });

    await markTradeErrored({
      db,
      tradeId,
      executionId,
      clientOrderId,
      executionUid,
      brokerStatus: "error",
      reason: error instanceof Error ? error.message : String(error),
    }).catch((tradeError) => {
      logger.error("Alpaca execution failed while syncing trade error state.", {
        ...validationContext,
        executionId,
        clientOrderId,
        error: tradeError instanceof Error ? tradeError.message : String(tradeError),
      });
    });

    return {
      status: "error",
      executionId,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
};
