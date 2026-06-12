import { FieldValue, type DocumentData } from "firebase-admin/firestore";

export type CanonicalTradeStatus =
  | "pending_execution"
  | "open"
  | "closed"
  | "rejected"
  | "not_executed"
  | "error";

export type ClosedTradeOutcome = "win" | "loss" | "breakeven";
export type TradeLifecycleResult = CanonicalTradeStatus | ClosedTradeOutcome;
export type TerminalTradeStatus = "closed" | "rejected" | "not_executed" | "error";

const CANONICAL_TRADE_STATUSES = new Set<CanonicalTradeStatus>([
  "pending_execution",
  "open",
  "closed",
  "rejected",
  "not_executed",
  "error",
]);

const TERMINAL_TRADE_STATUSES = new Set<TerminalTradeStatus>([
  "closed",
  "rejected",
  "not_executed",
  "error",
]);

const CLOSED_TRADE_OUTCOMES = new Set<ClosedTradeOutcome>([
  "win",
  "loss",
  "breakeven",
]);

const normalizeText = (value: unknown) => (
  typeof value === "string" ? value.trim().toLowerCase() : ""
);

const normalizeCanonicalTradeStatus = (value: unknown): CanonicalTradeStatus | null => {
  const normalized = normalizeText(value);
  return CANONICAL_TRADE_STATUSES.has(normalized as CanonicalTradeStatus)
    ? normalized as CanonicalTradeStatus
    : null;
};

const normalizeClosedTradeOutcome = (value: unknown): ClosedTradeOutcome | null => {
  const normalized = normalizeText(value);
  return CLOSED_TRADE_OUTCOMES.has(normalized as ClosedTradeOutcome)
    ? normalized as ClosedTradeOutcome
    : null;
};

export const isTerminalTradeStatus = (value: unknown): value is TerminalTradeStatus => (
  TERMINAL_TRADE_STATUSES.has(normalizeText(value) as TerminalTradeStatus)
);

export const getCanonicalTradeStatus = (
  trade: DocumentData | Record<string, unknown> | null | undefined
): CanonicalTradeStatus | null => {
  if (!trade) {
    return null;
  }

  const status = normalizeCanonicalTradeStatus(trade.status);
  if (status) {
    return status;
  }

  const tradeResult = normalizeCanonicalTradeStatus(trade.tradeResult);
  if (tradeResult) {
    return tradeResult;
  }

  const resultStatus = normalizeCanonicalTradeStatus(trade.result);
  if (resultStatus) {
    return resultStatus;
  }

  if (
    normalizeClosedTradeOutcome(trade.result)
    || normalizeClosedTradeOutcome(trade.tradeResult)
  ) {
    return "closed";
  }

  return null;
};

export const isTerminalTradeDocument = (
  trade: DocumentData | Record<string, unknown> | null | undefined
) => {
  const status = getCanonicalTradeStatus(trade);
  return status !== null && isTerminalTradeStatus(status);
};

type TradeLifecyclePatchOptions = {
  executionStatus?: string | null;
  rejectionReason?: string | null;
  result?: TradeLifecycleResult | null;
  extra?: Record<string, unknown>;
};

const buildTradeLifecyclePatch = ({
  status,
  tradeResult,
  executionStatus,
  rejectionReason,
  finalizedAt,
  result,
  extra,
}: {
  status: CanonicalTradeStatus;
  tradeResult: CanonicalTradeStatus | "closed";
  executionStatus?: string | null;
  rejectionReason?: string | null;
  finalizedAt: FieldValue | null;
  result: TradeLifecycleResult | null;
  extra?: Record<string, unknown>;
}) => ({
  status,
  tradeResult,
  result,
  rejectionReason: rejectionReason ?? null,
  finalizedAt,
  updatedAt: FieldValue.serverTimestamp(),
  ...(executionStatus === undefined ? {} : { executionStatus }),
  ...(extra ?? {}),
});

export const buildPendingExecutionTradePatch = ({
  executionStatus = "pending",
  extra,
}: TradeLifecyclePatchOptions = {}) => buildTradeLifecyclePatch({
  status: "pending_execution",
  tradeResult: "pending_execution",
  executionStatus,
  rejectionReason: null,
  finalizedAt: null,
  result: "pending_execution",
  extra,
});

export const buildOpenTradePatch = ({
  executionStatus = "accepted",
  extra,
}: TradeLifecyclePatchOptions = {}) => buildTradeLifecyclePatch({
  status: "open",
  tradeResult: "open",
  executionStatus,
  rejectionReason: null,
  finalizedAt: null,
  result: "open",
  extra,
});

export const buildRejectedTradePatch = ({
  executionStatus = "rejected",
  rejectionReason,
  extra,
}: TradeLifecyclePatchOptions = {}) => buildTradeLifecyclePatch({
  status: "rejected",
  tradeResult: "rejected",
  executionStatus,
  rejectionReason,
  finalizedAt: FieldValue.serverTimestamp(),
  result: "rejected",
  extra,
});

export const buildNotExecutedTradePatch = ({
  executionStatus = "not_sent",
  rejectionReason,
  extra,
}: TradeLifecyclePatchOptions = {}) => buildTradeLifecyclePatch({
  status: "not_executed",
  tradeResult: "not_executed",
  executionStatus,
  rejectionReason,
  finalizedAt: FieldValue.serverTimestamp(),
  result: "not_executed",
  extra,
});

export const buildErroredTradePatch = ({
  executionStatus = "error",
  rejectionReason,
  extra,
}: TradeLifecyclePatchOptions = {}) => buildTradeLifecyclePatch({
  status: "error",
  tradeResult: "error",
  executionStatus,
  rejectionReason,
  finalizedAt: FieldValue.serverTimestamp(),
  result: "error",
  extra,
});

export const buildClosedTradePatch = ({
  result,
  executionStatus,
  extra,
}: {
  result: ClosedTradeOutcome;
  executionStatus?: string | null;
  extra?: Record<string, unknown>;
}) => buildTradeLifecyclePatch({
  status: "closed",
  tradeResult: "closed",
  executionStatus,
  rejectionReason: null,
  finalizedAt: FieldValue.serverTimestamp(),
  result,
  extra,
});
