import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { buildRejectedTradePatch } from "../../../tradeLifecycle.js";
import { updateExecutionStatus } from "../../firestore.js";
import type { ExecutionAutomationSettings, NormalizedTradeRecord } from "../../types.js";
import {
  KRAKEN_BROKER_VENUE,
  KRAKEN_PAPER_PAIR,
} from "./krakenTypes.js";

export const KRAKEN_LIVE_ALLOWED_SYMBOLS = ["BTCUSD"] as const;
export const KRAKEN_LIVE_MAX_NOTIONAL_USD = 25;
export const KRAKEN_LIVE_MAX_OPEN_POSITIONS = 1;
export const KRAKEN_LIVE_MAX_TRADES_PER_DAY = 1;
export const KRAKEN_LIVE_ACCOUNT_TYPE = "spot";
export const KRAKEN_LIVE_LEVERAGE = 1;

export const KRAKEN_LIVE_REJECTION_REASONS = {
  disabled: "kraken_live_disabled",
  notAdminEnabled: "kraken_live_not_admin_enabled",
  maxNotionalExceeded: "kraken_live_max_notional_exceeded",
  shortingDisabled: "kraken_live_shorting_disabled",
  marginDisabled: "kraken_live_margin_disabled",
  symbolNotAllowed: "kraken_live_symbol_not_allowed",
  dailyLimitReached: "kraken_live_daily_limit_reached",
  maxOpenPositionsReached: "kraken_live_max_open_positions_reached",
  insufficientBalance: "kraken_live_insufficient_balance",
} as const;

export type KrakenLiveRejectionReason =
  typeof KRAKEN_LIVE_REJECTION_REASONS[keyof typeof KRAKEN_LIVE_REJECTION_REASONS];

type KrakenLiveValidationInput = {
  db?: Firestore;
  trade?: NormalizedTradeRecord | null;
  automationSettings: ExecutionAutomationSettings;
  executionUid?: string | null;
  availableUsd?: number | null;
};

type KrakenLiveValidationCheck = {
  check: string;
  passed: boolean;
  reason: KrakenLiveRejectionReason | null;
  actual?: unknown;
  expected?: unknown;
};

const ACTIVE_KRAKEN_LIVE_STATUSES = new Set([
  "queued",
  "processing",
  "submitted",
  "accepted",
  "partially_filled",
  "filled",
]);

const normalizeTradeId = (value: unknown) => (
  typeof value === "string" ? value.trim() : ""
);

const normalizeSymbol = (value: unknown) => (
  typeof value === "string" ? value.trim().toUpperCase().replace("/", "") : ""
);

const normalizeSide = (value: unknown) => (
  typeof value === "string" ? value.trim().toLowerCase().replace("_", "-") : ""
);

const normalizeLeverage = (value: unknown) => {
  if (value === null || value === undefined || value === "") {
    return 1;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Number.POSITIVE_INFINITY;
};

const normalizeNotionalUsd = (settings: ExecutionAutomationSettings) => (
  Number.isFinite(settings.notionalUsd) && settings.notionalUsd > 0
    ? settings.notionalUsd
    : KRAKEN_LIVE_MAX_NOTIONAL_USD
);

const isKrakenLiveGloballyEnabled = () => (
  process.env.KRAKEN_LIVE_EXECUTION_ENABLED === "true"
);

const getDayKey = (date = new Date()) => (
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
);

const timestampToDate = (value: unknown) => {
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

const getKrakenLiveUsage = async ({
  db,
  executionUid,
}: {
  db?: Firestore;
  executionUid?: string | null;
}) => {
  if (!db) {
    return {
      openPositions: 0,
      tradesToday: 0,
      dayKey: getDayKey(),
    };
  }

  const dayKey = getDayKey();
  const snapshot = executionUid
    ? await db.collection("executions")
      .where("provider", "==", "kraken")
      .where("mode", "==", "live")
      .where("uid", "==", executionUid)
      .limit(100)
      .get()
    : await db.collection("executions")
      .where("provider", "==", "kraken")
      .where("mode", "==", "live")
      .limit(100)
      .get();

  let openPositions = 0;
  let tradesToday = 0;

  snapshot.docs.forEach((documentSnapshot) => {
    const data = documentSnapshot.data() as Record<string, unknown>;
    const status = typeof data.status === "string" ? data.status.trim().toLowerCase() : "";

    if (ACTIVE_KRAKEN_LIVE_STATUSES.has(status)) {
      openPositions += 1;
    }

    const createdAt = timestampToDate(data.createdAt);
    if (createdAt && getDayKey(createdAt) === dayKey && status !== "rejected") {
      tradesToday += 1;
    }
  });

  return {
    openPositions,
    tradesToday,
    dayKey,
  };
};

export const buildKrakenLiveExecutionId = (tradeId: string) => `kraken_live_${tradeId}`;

export const KRAKEN_LIVE_NOT_ENABLED_ERROR_CODE = KRAKEN_LIVE_REJECTION_REASONS.disabled;

export const KRAKEN_LIVE_BLOCKED_ENDPOINTS = [
  "AddOrder",
  "CancelOrder",
  "Withdraw",
  "Transfer",
  "margin",
] as const;

export const KRAKEN_LIVE_REJECTION = {
  errorCode: KRAKEN_LIVE_NOT_ENABLED_ERROR_CODE,
  executionStatus: "rejected",
  status: "rejected",
  tradeResult: "rejected",
} as const;

export const buildKrakenLiveRiskPolicy = () => ({
  liveEnabled: isKrakenLiveGloballyEnabled(),
  allowedSymbols: [...KRAKEN_LIVE_ALLOWED_SYMBOLS],
  maxNotionalUsd: KRAKEN_LIVE_MAX_NOTIONAL_USD,
  killSwitchSupported: true,
  maxOpenPositions: KRAKEN_LIVE_MAX_OPEN_POSITIONS,
  maxTradesPerDay: KRAKEN_LIVE_MAX_TRADES_PER_DAY,
  longsOnly: true,
  shortsEnabled: false,
  marginEnabled: false,
  leverage: KRAKEN_LIVE_LEVERAGE,
  accountType: KRAKEN_LIVE_ACCOUNT_TYPE,
  orderEndpointsEnabled: false,
  blockedEndpoints: KRAKEN_LIVE_BLOCKED_ENDPOINTS,
});

export const validateKrakenLiveRiskPolicy = async ({
  db,
  trade = null,
  automationSettings,
  executionUid = null,
  availableUsd = null,
}: KrakenLiveValidationInput) => {
  const policy = buildKrakenLiveRiskPolicy();
  const usage = await getKrakenLiveUsage({ db, executionUid });
  const symbol = normalizeSymbol(trade?.symbol);
  const side = normalizeSide(trade?.side);
  const marginEnabled = trade?.marginEnabled === true;
  const leverage = normalizeLeverage(trade?.leverage);
  const notionalUsd = normalizeNotionalUsd(automationSettings);
  const adminEnabled = automationSettings.enabled === true
    && automationSettings.provider === "kraken"
    && automationSettings.mode === "live";
  const checks: KrakenLiveValidationCheck[] = [
    {
      check: "global_live_enabled",
      passed: policy.liveEnabled && !automationSettings.killSwitch,
      reason: KRAKEN_LIVE_REJECTION_REASONS.disabled,
      actual: {
        liveEnabled: policy.liveEnabled,
        killSwitch: automationSettings.killSwitch,
      },
      expected: {
        liveEnabled: true,
        killSwitch: false,
      },
    },
    {
      check: "admin_live_enabled",
      passed: adminEnabled,
      reason: KRAKEN_LIVE_REJECTION_REASONS.notAdminEnabled,
      actual: {
        enabled: automationSettings.enabled,
        provider: automationSettings.provider,
        mode: automationSettings.mode,
      },
      expected: {
        enabled: true,
        provider: "kraken",
        mode: "live",
      },
    },
    {
      check: "symbol_allowed",
      passed: !trade || KRAKEN_LIVE_ALLOWED_SYMBOLS.includes(symbol as typeof KRAKEN_LIVE_ALLOWED_SYMBOLS[number]),
      reason: KRAKEN_LIVE_REJECTION_REASONS.symbolNotAllowed,
      actual: symbol || null,
      expected: policy.allowedSymbols,
    },
    {
      check: "longs_only",
      passed: !trade || side === "long",
      reason: KRAKEN_LIVE_REJECTION_REASONS.shortingDisabled,
      actual: side || null,
      expected: "long",
    },
    {
      check: "spot_no_margin",
      passed: !marginEnabled,
      reason: KRAKEN_LIVE_REJECTION_REASONS.marginDisabled,
      actual: marginEnabled,
      expected: false,
    },
    {
      check: "no_leverage",
      passed: leverage <= KRAKEN_LIVE_LEVERAGE,
      reason: KRAKEN_LIVE_REJECTION_REASONS.marginDisabled,
      actual: leverage,
      expected: KRAKEN_LIVE_LEVERAGE,
    },
    {
      check: "max_notional",
      passed: notionalUsd <= KRAKEN_LIVE_MAX_NOTIONAL_USD,
      reason: KRAKEN_LIVE_REJECTION_REASONS.maxNotionalExceeded,
      actual: notionalUsd,
      expected: KRAKEN_LIVE_MAX_NOTIONAL_USD,
    },
    {
      check: "max_open_positions",
      passed: usage.openPositions < KRAKEN_LIVE_MAX_OPEN_POSITIONS,
      reason: KRAKEN_LIVE_REJECTION_REASONS.maxOpenPositionsReached,
      actual: usage.openPositions,
      expected: KRAKEN_LIVE_MAX_OPEN_POSITIONS,
    },
    {
      check: "max_trades_per_day",
      passed: usage.tradesToday < KRAKEN_LIVE_MAX_TRADES_PER_DAY,
      reason: KRAKEN_LIVE_REJECTION_REASONS.dailyLimitReached,
      actual: {
        tradesToday: usage.tradesToday,
        dayKey: usage.dayKey,
      },
      expected: KRAKEN_LIVE_MAX_TRADES_PER_DAY,
    },
    {
      check: "usd_balance",
      passed: availableUsd === null || availableUsd >= notionalUsd,
      reason: KRAKEN_LIVE_REJECTION_REASONS.insufficientBalance,
      actual: availableUsd,
      expected: `>= ${notionalUsd}`,
    },
  ].map((check) => ({
    ...check,
    reason: check.passed ? null : check.reason,
  }));
  const firstFailure = checks.find((check) => !check.passed);

  return {
    allowed: !firstFailure,
    reason: firstFailure?.reason ?? null,
    policy,
    summary: {
      tradeId: normalizeTradeId(trade?.tradeId),
      symbol: symbol || null,
      side: side || null,
      notionalUsd,
      availableUsd,
      openPositions: usage.openPositions,
      tradesToday: usage.tradesToday,
      dayKey: usage.dayKey,
      checks,
    },
  };
};

export const rejectKrakenLiveExecution = async ({
  db,
  trade,
  automationSettings,
  executionUid = null,
}: {
  db: Firestore;
  trade: NormalizedTradeRecord;
  automationSettings: ExecutionAutomationSettings;
  executionUid?: string | null;
}) => {
  const tradeId = normalizeTradeId(trade.tradeId);
  const executionId = buildKrakenLiveExecutionId(tradeId);
  const clientOrderId = `sfiq_kraken_${tradeId}`;
  const validation = await validateKrakenLiveRiskPolicy({
    db,
    trade,
    automationSettings,
    executionUid,
  });
  const rejectionReason = validation.reason ?? KRAKEN_LIVE_NOT_ENABLED_ERROR_CODE;

  logger.warn("Kraken live execution rejected by live risk policy.", {
    tradeId,
    signalId: trade.signalId ?? null,
    executionId,
    provider: "kraken",
    mode: "live",
    ...KRAKEN_LIVE_REJECTION,
    rejectionReason,
    validation: validation.summary,
    noLiveOrderEndpointsCalled: true,
    blockedEndpoints: KRAKEN_LIVE_BLOCKED_ENDPOINTS,
  });

  await updateExecutionStatus({
    db,
    executionId,
    patch: {
      executionId,
      tradeId,
      signalId: trade.signalId ?? null,
      uid: executionUid,
      provider: "kraken",
      mode: "live",
      symbol: trade.symbol ?? "BTCUSD",
      side: trade.side ?? "long",
      positionSide: trade.side ?? "long",
      orderType: "market",
      timeInForce: "gtc",
      orderClass: "simple",
      clientOrderId,
      ...KRAKEN_LIVE_REJECTION,
      errorCode: rejectionReason,
      rejectionReason,
      reconciliationReason: rejectionReason,
      errorMessage: `Kraken live execution blocked: ${rejectionReason}.`,
      brokerVenue: KRAKEN_BROKER_VENUE,
      brokerPair: KRAKEN_PAPER_PAIR,
      brokerAccountType: "live",
      marginEnabled: false,
      leverage: KRAKEN_LIVE_LEVERAGE,
      noLiveOrderEndpointsCalled: true,
      blockedEndpoints: KRAKEN_LIVE_BLOCKED_ENDPOINTS,
      automationSettings,
      krakenLiveRiskPolicy: validation.policy,
      validation: {
        tradeEligible: false,
        reason: rejectionReason,
        tradeResult: trade.tradeResult ?? trade.status ?? trade.result ?? null,
        isArchived: trade.isArchived === true,
        isValid: trade.isValid !== false,
        isTest: trade.isTest === true,
        krakenLive: validation.summary,
      },
      error: {
        code: rejectionReason,
        message: `Kraken live execution blocked: ${rejectionReason}.`,
      },
      createdAt: FieldValue.serverTimestamp(),
    },
  });

  await db.collection("trades").doc(tradeId).set({
    ...buildRejectedTradePatch({
      executionStatus: KRAKEN_LIVE_REJECTION.executionStatus,
      rejectionReason: KRAKEN_LIVE_NOT_ENABLED_ERROR_CODE,
    }),
    executionId,
    errorCode: rejectionReason,
    rejectionReason,
    executionProvider: "kraken",
    executionMode: "live",
    executionClientOrderId: clientOrderId,
    brokerVenue: KRAKEN_BROKER_VENUE,
    brokerPair: KRAKEN_PAPER_PAIR,
    brokerAccountType: "live",
    marginEnabled: false,
    leverage: KRAKEN_LIVE_LEVERAGE,
  }, { merge: true });

  return {
    ...KRAKEN_LIVE_REJECTION,
    errorCode: rejectionReason,
    executionId,
    reason: rejectionReason,
    validation: validation.summary,
  };
};
