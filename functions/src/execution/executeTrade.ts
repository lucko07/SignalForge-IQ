import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { evaluateAutomationExecutionAccess } from "../access.js";
import { createOrder, getAccount, getOpenPositions } from "../lib/alpaca.js";
import {
  buildClientOrderId,
  buildExecutionId,
  createExecutionReservation,
  findExecutionByClientOrderId,
  findExecutionByTradeId,
  updateExecutionStatus,
  updateTradeExecutionReferences,
} from "./firestore.js";
import { getExecutionAutomationSettings } from "./config.js";
import type {
  AlpacaOrderRequest,
  ExecutionAutomationSettings,
  NormalizedTradeRecord,
} from "./types.js";

type ExecuteTradeResult =
  | { status: "submitted"; executionId: string; orderId: string; clientOrderId: string }
  | { status: "skipped"; reason: string; executionId?: string }
  | { status: "duplicate"; reason: string; executionId?: string }
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

  if (trade.result !== "open") {
    return { eligible: false, reason: "trade-not-open" };
  }

  if (!settings.symbolAllowlist.includes(symbol)) {
    return { eligible: false, reason: "symbol-not-allowed" };
  }

  if (side === "short") {
    if (!settings.shortsEnabled) {
      return { eligible: false, reason: "shorts-disabled" };
    }

    return { eligible: false, reason: "short-execution-not-supported" };
  }

  if (side !== "long") {
    return { eligible: false, reason: "unsupported-side" };
  }

  if (!settings.longsEnabled) {
    return { eligible: false, reason: "longs-disabled" };
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

  return { eligible: true as const, symbol, side: "long" as const };
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
}: {
  db: Firestore;
  trade: NormalizedTradeRecord;
  automationSettings: ExecutionAutomationSettings;
  executionUid: string | null;
  executionId: string;
  clientOrderId: string;
  status: "rejected" | "position_conflict" | "skipped";
  reason: string;
  message: string;
  brokerSnapshot?: { openPositionSymbols: string[] } | null;
  brokerAccountId?: string | null;
  brokerPositionConflict?: boolean;
}) => {
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

  await updateExecutionStatus({
    db,
    executionId,
    patch: {
      status,
      brokerAccountId: brokerAccountId ?? null,
      brokerPositionConflict: brokerPositionConflict === true,
      brokerSnapshot: brokerSnapshot ?? null,
      errorCode: reason,
      errorMessage: message,
      validation: {
        tradeEligible: false,
        reason,
        tradeResult: trade.result ?? null,
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
  symbol: normalizeSymbol(trade.symbol) as "BTCUSD",
  side: "buy",
  type: "market",
  time_in_force: "gtc",
  client_order_id: clientOrderId,
  notional: automationSettings.notionalUsd.toFixed(2),
});

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
      });

      return {
        status: "rejected",
        executionId,
        reason: "daily-trade-cap-reached",
      };
    }

    const [account, positions] = await Promise.all([getAccount(), getOpenPositions()]);
    const openPositionSymbols = positions.map((position) => normalizeSymbol(position.symbol)).filter(Boolean);
    const hasBtcPosition = openPositionSymbols.includes("BTCUSD");
    const maxOpenPositionsReached = openPositionSymbols.length >= automationSettings.maxOpenPositions;

    if (hasBtcPosition) {
      logBlockedExecution("open-position-exists", {
        ...validationContext,
        executionId,
        clientOrderId,
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
        reason: "open-position-exists",
        message: "Open BTCUSD position already exists in Alpaca paper account.",
        brokerAccountId: account.id ?? null,
        brokerSnapshot: { openPositionSymbols },
        brokerPositionConflict: true,
      });

      return {
        status: "position-conflict",
        executionId,
        reason: "open-position-exists",
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
        brokerSnapshot: { openPositionSymbols },
      });

      return {
        status: "rejected",
        executionId,
        reason: "max-open-positions-reached",
      };
    }

    const orderRequest = buildOrderRequest(trade, automationSettings, clientOrderId);

    logger.info("Alpaca execution order submission started.", {
      ...validationContext,
      executionId,
      clientOrderId,
      orderRequest,
    });

    const orderResponse = await createOrder(orderRequest);
    const brokerExecutionStatus = mapBrokerOrderStatusToExecutionStatus(orderResponse.status ?? null);
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
      orderId: orderResponse.id,
      orderStatus: orderResponse.status,
      filledQty: orderResponse.filled_qty ?? null,
      filledAvgPrice: orderResponse.filled_avg_price ?? null,
    });

    await updateExecutionStatus({
      db,
      executionId,
      patch: {
        status: brokerExecutionStatus,
        brokerAccountId: account.id ?? null,
        alpacaOrderId: orderResponse.id,
        brokerOrderStatus: orderResponse.status ?? null,
        rawStatus: orderResponse.status ?? null,
        brokerPositionConflict: false,
        brokerSnapshot: { openPositionSymbols },
        orderRequest,
        orderResponse,
        qty: orderResponse.qty ?? null,
        notional: orderRequest.notional,
        filledQty: orderResponse.filled_qty ?? null,
        filledAvgPrice: orderResponse.filled_avg_price ?? null,
        errorCode: brokerErrorMessage ? brokerExecutionStatus : null,
        errorMessage: brokerErrorMessage,
        validation: {
          tradeEligible: true,
          reason: null,
          tradeResult: trade.result ?? null,
          isArchived: trade.isArchived === true,
          isValid: trade.isValid !== false,
          isTest: trade.isTest === true,
        },
        submittedAt: orderResponse.submitted_at ? new Date(orderResponse.submitted_at) : FieldValue.serverTimestamp(),
        filledAt: orderResponse.filled_at ? new Date(orderResponse.filled_at) : null,
        canceledAt: orderResponse.canceled_at ? new Date(orderResponse.canceled_at) : null,
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
      orderId: orderResponse.id,
    });

    await updateTradeExecutionReferences({
      db,
      tradeId,
      executionId,
      clientOrderId,
      orderId: orderResponse.id,
      orderStatus: brokerExecutionStatus,
      executionUid,
      brokerStatus: orderResponse.status ?? brokerExecutionStatus,
      brokerFilledQty: orderResponse.filled_qty ?? null,
      brokerFilledAvgPrice: orderResponse.filled_avg_price ?? null,
      executionSubmittedAt: orderResponse.submitted_at ? new Date(orderResponse.submitted_at) : FieldValue.serverTimestamp(),
    });

    logger.info("Alpaca execution trade reference update succeeded.", {
      ...validationContext,
      executionId,
      clientOrderId,
      orderId: orderResponse.id,
    });

    return {
      status: "submitted",
      executionId,
      orderId: orderResponse.id,
      clientOrderId,
    };
  } catch (error) {
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

    return {
      status: "error",
      executionId,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
};
