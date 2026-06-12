import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import {
  buildErroredTradePatch,
  buildNotExecutedTradePatch,
  buildOpenTradePatch,
  buildPendingExecutionTradePatch,
  buildRejectedTradePatch,
  getCanonicalTradeStatus,
  isTerminalTradeStatus,
  type CanonicalTradeStatus,
} from "../tradeLifecycle.js";
import type {
  ExecutionAutomationSettings,
  ExecutionDocument,
  NormalizedTradeRecord,
} from "./types.js";

const TRADES_COLLECTION_NAME = "trades";
const SIGNALS_COLLECTION_NAME = "signals";

const normalizeSide = (value: unknown): "long" | "short" => (
  typeof value === "string" && value.trim().toLowerCase() === "short" ? "short" : "long"
);

const valuesAreEqual = (current: unknown, next: unknown) => JSON.stringify(current) === JSON.stringify(next);

const buildTradeExecutionReferencePatch = ({
  executionId,
  clientOrderId,
  orderId,
  executionUid,
  executionStatus,
  brokerStatus,
  brokerFilledQty,
  brokerFilledAvgPrice,
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
  executionSubmittedAt,
  brokerPositionConflict,
  noOp,
  reason,
  executionProvider,
  executionMode,
  brokerVenue,
  brokerPair,
  brokerAccountType,
  marginEnabled,
  leverage,
}: {
  executionId: string;
  clientOrderId: string;
  orderId?: string | null;
  executionUid?: string | null;
  executionStatus: string;
  brokerStatus?: string | null;
  brokerFilledQty?: string | null;
  brokerFilledAvgPrice?: string | null;
  orderClass?: string | null;
  takeProfitPrice?: number | string | null;
  stopLossPrice?: number | string | null;
  protectionStatus?: string | null;
  protectionMode?: string | null;
  protectionActivatedAt?: unknown;
  protectionFailedAt?: unknown;
  protectionError?: string | null;
  stopOrderId?: string | null;
  takeProfitOrderId?: string | null;
  executionSubmittedAt?: unknown;
  brokerPositionConflict?: boolean;
  noOp?: boolean;
  reason?: string | null;
  executionProvider?: string;
  executionMode?: string;
  brokerVenue?: string | null;
  brokerPair?: string | null;
  brokerAccountType?: string | null;
  marginEnabled?: boolean | null;
  leverage?: number | null;
}) => ({
  executionId,
  executionProvider: executionProvider ?? "alpaca",
  executionMode: executionMode ?? "paper",
  executionStatus,
  executionClientOrderId: clientOrderId,
  executionOrderId: orderId ?? null,
  executionUid: executionUid ?? null,
  brokerOrderId: orderId ?? null,
  brokerClientOrderId: clientOrderId,
  brokerStatus: brokerStatus ?? executionStatus,
  brokerVenue: brokerVenue ?? (executionProvider === "kraken" ? "kraken" : "alpaca"),
  brokerPair: brokerPair ?? null,
  brokerAccountType: brokerAccountType ?? (executionMode === "live" ? "live" : "paper"),
  marginEnabled: marginEnabled ?? false,
  leverage: leverage ?? null,
  brokerFilledQty: brokerFilledQty ?? null,
  brokerFilledAvgPrice: brokerFilledAvgPrice ?? null,
  orderClass: orderClass ?? null,
  takeProfitPrice: takeProfitPrice ?? null,
  stopLossPrice: stopLossPrice ?? null,
  protectionStatus: protectionStatus ?? null,
  protectionMode: protectionMode ?? null,
  ...(protectionActivatedAt === undefined ? {} : { protectionActivatedAt }),
  ...(protectionFailedAt === undefined ? {} : { protectionFailedAt }),
  protectionError: protectionError ?? null,
  stopOrderId: stopOrderId ?? null,
  takeProfitOrderId: takeProfitOrderId ?? null,
  brokerPositionConflict: brokerPositionConflict === true,
  executionNoOp: noOp === true,
  executionReason: reason ?? null,
  updatedAt: FieldValue.serverTimestamp(),
  ...(executionSubmittedAt === undefined ? {} : { executionSubmittedAt }),
});

const buildTradeLifecyclePatchForExecutionStatus = ({
  executionStatus,
  reason,
}: {
  executionStatus: string;
  reason?: string | null;
}) => {
  switch (executionStatus) {
  case "queued":
  case "processing":
  case "submitted":
    return {
      nextTradeStatus: "pending_execution" as CanonicalTradeStatus,
      patch: buildPendingExecutionTradePatch({
        executionStatus,
      }),
    };
  case "accepted":
  case "partially_filled":
  case "filled":
    return {
      nextTradeStatus: "open" as CanonicalTradeStatus,
      patch: buildOpenTradePatch({
        executionStatus,
      }),
    };
  case "rejected":
  case "broker_rejected":
  case "failed_validation":
  case "position_conflict":
    return {
      nextTradeStatus: "rejected" as CanonicalTradeStatus,
      patch: buildRejectedTradePatch({
        executionStatus,
        rejectionReason: reason ?? executionStatus,
      }),
    };
  case "skipped":
  case "already_open":
  case "canceled":
  case "expired":
    return {
      nextTradeStatus: "not_executed" as CanonicalTradeStatus,
      patch: buildNotExecutedTradePatch({
        executionStatus: executionStatus === "skipped" ? "not_sent" : executionStatus,
        rejectionReason: reason ?? executionStatus,
      }),
    };
  case "error":
  case "protection_failed":
    return {
      nextTradeStatus: "error" as CanonicalTradeStatus,
      patch: buildErroredTradePatch({
        executionStatus,
        rejectionReason: reason ?? executionStatus,
      }),
    };
  default:
    return {
      nextTradeStatus: null,
      patch: {},
    };
  }
};

const computeChangedTradePatch = (
  trade: Record<string, unknown>,
  patch: Record<string, unknown>
) => {
  const changedPatch: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(patch)) {
    if (key === "updatedAt") {
      continue;
    }

    if (key === "finalizedAt") {
      const hasCurrentFinalizedAt = trade.finalizedAt !== undefined && trade.finalizedAt !== null;
      const shouldWriteFinalizedAt = (value === null && hasCurrentFinalizedAt)
        || (value !== null && !hasCurrentFinalizedAt);

      if (shouldWriteFinalizedAt) {
        changedPatch[key] = value;
      }

      continue;
    }

    if (!valuesAreEqual(trade[key], value)) {
      changedPatch[key] = value;
    }
  }

  if (Object.keys(changedPatch).length > 0) {
    changedPatch.updatedAt = patch.updatedAt ?? FieldValue.serverTimestamp();
  }

  return changedPatch;
};

const applyTradeExecutionPatch = async ({
  db,
  tradeId,
  referencePatch,
  lifecyclePatch,
  nextTradeStatus,
  transition,
}: {
  db: Firestore;
  tradeId: string;
  referencePatch: Record<string, unknown>;
  lifecyclePatch?: Record<string, unknown>;
  nextTradeStatus?: CanonicalTradeStatus | null;
  transition: string;
}) => {
  const tradeReference = db.collection(TRADES_COLLECTION_NAME).doc(tradeId);

  return db.runTransaction(async (transaction) => {
    const tradeSnapshot = await transaction.get(tradeReference);

    if (!tradeSnapshot.exists) {
      logger.warn("Trade execution lifecycle patch skipped because trade document was not found.", {
        tradeId,
        transition,
        nextTradeStatus: nextTradeStatus ?? null,
      });
      return { updated: false, reason: "trade-not-found" as const };
    }

    const trade = tradeSnapshot.data() as Record<string, unknown>;
    const currentStatus = getCanonicalTradeStatus(trade);
    const shouldSkipLifecycle = (
      currentStatus !== null
      && isTerminalTradeStatus(currentStatus)
      && nextTradeStatus !== undefined
      && nextTradeStatus !== null
      && currentStatus !== nextTradeStatus
    );
    const requestedPatch = shouldSkipLifecycle
      ? referencePatch
      : {
        ...referencePatch,
        ...(lifecyclePatch ?? {}),
      };
    const changedPatch = computeChangedTradePatch(trade, requestedPatch);

    if (Object.keys(changedPatch).length === 0) {
      return {
        updated: false,
        reason: "no-trade-changes" as const,
        currentStatus: currentStatus ?? null,
        nextTradeStatus: nextTradeStatus ?? null,
        skippedLifecycle: shouldSkipLifecycle,
      };
    }

    transaction.set(tradeReference, changedPatch, { merge: true });

    logger.info("Trade execution lifecycle patch applied.", {
      tradeId,
      transition,
      currentStatus: currentStatus ?? null,
      nextTradeStatus: nextTradeStatus ?? null,
      skippedLifecycle: shouldSkipLifecycle,
      changedFields: Object.keys(changedPatch),
    });

    return {
      updated: true,
      reason: shouldSkipLifecycle ? "metadata-only" as const : "updated" as const,
      currentStatus: currentStatus ?? null,
      nextTradeStatus: nextTradeStatus ?? null,
      skippedLifecycle: shouldSkipLifecycle,
      changedFields: Object.keys(changedPatch),
    };
  });
};

export const EXECUTIONS_COLLECTION_NAME = "executions";

export const buildExecutionId = (tradeId: string) => `alpaca_paper_${tradeId}`;

export const buildClientOrderId = (tradeId: string) => `sfiq_${tradeId}`;

export const findExecutionByTradeId = async (db: Firestore, tradeId: string) => {
  const querySnapshot = await db
    .collection(EXECUTIONS_COLLECTION_NAME)
    .where("tradeId", "==", tradeId)
    .limit(1)
    .get();

  return querySnapshot.empty ? null : querySnapshot.docs[0];
};

export const findExecutionByClientOrderId = async (db: Firestore, clientOrderId: string) => {
  const querySnapshot = await db
    .collection(EXECUTIONS_COLLECTION_NAME)
    .where("clientOrderId", "==", clientOrderId)
    .limit(1)
    .get();

  return querySnapshot.empty ? null : querySnapshot.docs[0];
};

export const findExecutionBySignalId = async (db: Firestore, signalId: string) => {
  const querySnapshot = await db
    .collection(EXECUTIONS_COLLECTION_NAME)
    .where("signalId", "==", signalId)
    .limit(1)
    .get();

  return querySnapshot.empty ? null : querySnapshot.docs[0];
};

export const createExecutionReservation = async ({
  db,
  executionId,
  trade,
  clientOrderId,
  automationSettings,
  uid,
}: {
  db: Firestore;
  executionId: string;
  trade: NormalizedTradeRecord;
  clientOrderId: string;
  automationSettings: ExecutionAutomationSettings;
  uid?: string | null;
}) => {
  const executionReference = db.collection(EXECUTIONS_COLLECTION_NAME).doc(executionId);

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(executionReference);

    if (snapshot.exists) {
      throw new Error("Execution already reserved for this trade.");
    }

    const reservation: ExecutionDocument = {
      executionId,
      tradeId: trade.tradeId,
      signalId: trade.signalId ?? null,
      uid: uid ?? null,
      provider: automationSettings.provider,
      mode: automationSettings.mode,
      symbol: trade.symbol ?? "BTCUSD",
      side: normalizeSide(trade.side),
      positionSide: normalizeSide(trade.side),
      orderType: "market",
      timeInForce: "gtc",
      orderClass: "simple",
      takeProfitPrice: null,
      stopLossPrice: null,
      protectionStatus: null,
      protectionMode: null,
      protectionActivatedAt: null,
      protectionFailedAt: null,
      protectionError: null,
      qty: null,
      notional: automationSettings.notionalUsd.toFixed(2),
      alpacaOrderId: null,
      brokerOrderId: null,
      brokerVenue: automationSettings.provider,
      brokerPair: automationSettings.provider === "kraken" ? "BTC/USD" : null,
      brokerAccountType: automationSettings.mode === "live" ? "live" : "paper",
      marginEnabled: false,
      leverage: null,
      clientOrderId,
      status: "queued",
      submittedAt: null,
      filledAt: null,
      canceledAt: null,
      filledQty: null,
      filledAvgPrice: null,
      rawStatus: null,
      errorCode: null,
      errorMessage: null,
      timeframe: trade.timeframe ?? null,
      strategyVersion: trade.strategyVersion ?? null,
      brokerOrderStatus: null,
      brokerAccountId: null,
      brokerPositionConflict: false,
      brokerReconciliationState: null,
      reconciliationReason: null,
      noOp: false,
      automationSettings,
      validation: {
        tradeEligible: true,
        reason: null,
        tradeResult: trade.tradeResult ?? trade.status ?? trade.result ?? null,
        isArchived: trade.isArchived === true,
        isValid: trade.isValid !== false,
        isTest: trade.isTest === true,
      },
      orderRequest: null,
      orderResponse: null,
      stopOrderId: null,
      takeProfitOrderId: null,
      brokerSnapshot: null,
      error: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    transaction.create(executionReference, reservation);
  });

  return executionReference;
};

export const updateExecutionStatus = async ({
  db,
  executionId,
  patch,
}: {
  db: Firestore;
  executionId: string;
  patch: Record<string, unknown>;
}) => {
  await db.collection(EXECUTIONS_COLLECTION_NAME).doc(executionId).set({
    updatedAt: FieldValue.serverTimestamp(),
    ...patch,
  }, { merge: true });
};

export const markSignalRejected = async ({
  db,
  signalId,
  executionStatus = "rejected",
  reason,
}: {
  db: Firestore;
  signalId: string | null | undefined;
  executionStatus?: string;
  reason?: string | null;
}) => {
  const normalizedSignalId = typeof signalId === "string" ? signalId.trim() : "";

  if (!normalizedSignalId) {
    logger.warn("Signal rejection sync skipped because signalId was missing.", {
      executionStatus,
      reason: reason ?? null,
    });
    return { updated: false, reason: "missing-signal-id" as const };
  }

  const signalReference = db.collection(SIGNALS_COLLECTION_NAME).doc(normalizedSignalId);
  const signalSnapshot = await signalReference.get();

  if (!signalSnapshot.exists) {
    logger.warn("Signal rejection sync skipped because signal document was not found.", {
      signalId: normalizedSignalId,
      executionStatus,
      reason: reason ?? null,
    });
    return { updated: false, reason: "signal-not-found" as const };
  }

  await signalReference.set({
    status: "REJECTED",
    reviewStatus: "REJECTED",
    executionStatus,
    rejectionReason: reason ?? executionStatus,
    statusUpdatedAt: FieldValue.serverTimestamp(),
    statusUpdatedBy: "automation",
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  logger.info("Signal document marked rejected from trade execution flow.", {
    signalId: normalizedSignalId,
    executionStatus,
    reason: reason ?? null,
  });

  return { updated: true, reason: "updated" as const };
};

export const markTradeRejected = async ({
  db,
  tradeId,
  executionId,
  clientOrderId,
  executionUid,
  executionStatus = "rejected",
  brokerStatus,
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
  executionProvider,
  executionMode,
  brokerVenue,
  brokerPair,
  brokerAccountType,
  marginEnabled,
  leverage,
}: {
  db: Firestore;
  tradeId: string;
  executionId: string;
  clientOrderId: string;
  executionUid?: string | null;
  executionStatus?: string;
  brokerStatus?: string | null;
  brokerPositionConflict?: boolean;
  noOp?: boolean;
  reason?: string | null;
  orderClass?: string | null;
  takeProfitPrice?: number | string | null;
  stopLossPrice?: number | string | null;
  protectionStatus?: string | null;
  protectionMode?: string | null;
  protectionActivatedAt?: unknown;
  protectionFailedAt?: unknown;
  protectionError?: string | null;
  stopOrderId?: string | null;
  takeProfitOrderId?: string | null;
  executionProvider?: string;
  executionMode?: string;
  brokerVenue?: string | null;
  brokerPair?: string | null;
  brokerAccountType?: string | null;
  marginEnabled?: boolean | null;
  leverage?: number | null;
}) => applyTradeExecutionPatch({
  db,
  tradeId,
  transition: "trade-rejected",
  nextTradeStatus: "rejected",
  referencePatch: buildTradeExecutionReferencePatch({
    executionId,
    clientOrderId,
    executionUid,
    executionStatus,
    brokerStatus,
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
    executionProvider,
    executionMode,
    brokerVenue,
    brokerPair,
    brokerAccountType,
    marginEnabled,
    leverage,
  }),
  lifecyclePatch: buildRejectedTradePatch({
    executionStatus,
    rejectionReason: reason ?? executionStatus,
  }),
});

export const markTradeNotExecuted = async ({
  db,
  tradeId,
  executionId,
  clientOrderId,
  executionUid,
  executionStatus = "not_sent",
  brokerStatus,
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
  executionProvider,
  executionMode,
  brokerVenue,
  brokerPair,
  brokerAccountType,
  marginEnabled,
  leverage,
}: {
  db: Firestore;
  tradeId: string;
  executionId: string;
  clientOrderId: string;
  executionUid?: string | null;
  executionStatus?: string;
  brokerStatus?: string | null;
  brokerPositionConflict?: boolean;
  noOp?: boolean;
  reason?: string | null;
  orderClass?: string | null;
  takeProfitPrice?: number | string | null;
  stopLossPrice?: number | string | null;
  protectionStatus?: string | null;
  protectionMode?: string | null;
  protectionActivatedAt?: unknown;
  protectionFailedAt?: unknown;
  protectionError?: string | null;
  stopOrderId?: string | null;
  takeProfitOrderId?: string | null;
  executionProvider?: string;
  executionMode?: string;
  brokerVenue?: string | null;
  brokerPair?: string | null;
  brokerAccountType?: string | null;
  marginEnabled?: boolean | null;
  leverage?: number | null;
}) => applyTradeExecutionPatch({
  db,
  tradeId,
  transition: "trade-not-executed",
  nextTradeStatus: "not_executed",
  referencePatch: buildTradeExecutionReferencePatch({
    executionId,
    clientOrderId,
    executionUid,
    executionStatus,
    brokerStatus,
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
    executionProvider,
    executionMode,
    brokerVenue,
    brokerPair,
    brokerAccountType,
    marginEnabled,
    leverage,
  }),
  lifecyclePatch: buildNotExecutedTradePatch({
    executionStatus,
    rejectionReason: reason ?? executionStatus,
  }),
});

export const markTradeErrored = async ({
  db,
  tradeId,
  executionId,
  clientOrderId,
  executionUid,
  brokerStatus,
  reason,
}: {
  db: Firestore;
  tradeId: string;
  executionId: string;
  clientOrderId: string;
  executionUid?: string | null;
  brokerStatus?: string | null;
  reason?: string | null;
}) => applyTradeExecutionPatch({
  db,
  tradeId,
  transition: "trade-error",
  nextTradeStatus: "error",
  referencePatch: buildTradeExecutionReferencePatch({
    executionId,
    clientOrderId,
    executionUid,
    executionStatus: "error",
    brokerStatus,
    reason,
  }),
  lifecyclePatch: buildErroredTradePatch({
    executionStatus: "error",
    rejectionReason: reason ?? "error",
  }),
});

export const updateTradeExecutionReferences = async ({
  db,
  tradeId,
  executionId,
  clientOrderId,
  orderId,
  orderStatus,
  executionUid,
  brokerStatus,
  brokerFilledQty,
  brokerFilledAvgPrice,
  executionSubmittedAt,
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
  executionProvider,
  executionMode,
  brokerVenue,
  brokerPair,
  brokerAccountType,
  marginEnabled,
  leverage,
}: {
  db: Firestore;
  tradeId: string;
  executionId: string;
  clientOrderId: string;
  orderId: string;
  orderStatus: string;
  executionUid?: string | null;
  brokerStatus?: string | null;
  brokerFilledQty?: string | null;
  brokerFilledAvgPrice?: string | null;
  orderClass?: string | null;
  takeProfitPrice?: number | string | null;
  stopLossPrice?: number | string | null;
  protectionStatus?: string | null;
  protectionMode?: string | null;
  protectionActivatedAt?: unknown;
  protectionFailedAt?: unknown;
  protectionError?: string | null;
  stopOrderId?: string | null;
  takeProfitOrderId?: string | null;
  executionSubmittedAt?: unknown;
  executionProvider?: string;
  executionMode?: string;
  brokerVenue?: string | null;
  brokerPair?: string | null;
  brokerAccountType?: string | null;
  marginEnabled?: boolean | null;
  leverage?: number | null;
}) => {
  const { nextTradeStatus, patch: lifecyclePatch } = buildTradeLifecyclePatchForExecutionStatus({
    executionStatus: orderStatus,
    reason: brokerStatus ?? orderStatus,
  });

  return applyTradeExecutionPatch({
    db,
    tradeId,
    transition: "trade-execution-references",
    nextTradeStatus,
    referencePatch: buildTradeExecutionReferencePatch({
      executionId,
      clientOrderId,
      orderId,
      executionUid,
      executionStatus: orderStatus,
      brokerStatus,
      brokerFilledQty,
      brokerFilledAvgPrice,
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
      executionSubmittedAt,
      executionProvider,
      executionMode,
      brokerVenue,
      brokerPair,
      brokerAccountType,
      marginEnabled,
      leverage,
    }),
    lifecyclePatch,
  });
};

export const updateTradeExecutionState = async ({
  db,
  tradeId,
  executionId,
  clientOrderId,
  executionUid,
  executionStatus,
  brokerStatus,
  brokerPositionConflict,
  noOp,
  reason,
}: {
  db: Firestore;
  tradeId: string;
  executionId: string;
  clientOrderId: string;
  executionUid?: string | null;
  executionStatus: string;
  brokerStatus?: string | null;
  brokerPositionConflict?: boolean;
  noOp?: boolean;
  reason?: string | null;
}) => {
  const { nextTradeStatus, patch: lifecyclePatch } = buildTradeLifecyclePatchForExecutionStatus({
    executionStatus,
    reason,
  });

  return applyTradeExecutionPatch({
    db,
    tradeId,
    transition: "trade-execution-state",
    nextTradeStatus,
    referencePatch: buildTradeExecutionReferencePatch({
      executionId,
      clientOrderId,
      executionUid,
      executionStatus,
      brokerStatus,
      brokerPositionConflict,
      noOp,
      reason,
    }),
    lifecyclePatch,
  });
};

const getTradeBrokerLifecyclePatch = ({
  execution,
}: {
  execution: ExecutionDocument;
}) => {
  const { nextTradeStatus, patch: lifecyclePatch } = buildTradeLifecyclePatchForExecutionStatus({
    executionStatus: execution.status,
    reason: execution.reconciliationReason ?? execution.errorCode ?? execution.status,
  });

  return {
    nextTradeStatus,
    patch: lifecyclePatch,
  };
};

export const syncTradeBrokerLifecycleFromExecution = async ({
  db,
  execution,
}: {
  db: Firestore;
  execution: ExecutionDocument;
}) => {
  const tradeReference = db.collection(TRADES_COLLECTION_NAME).doc(execution.tradeId);
  const tradeSnapshot = await tradeReference.get();

  if (!tradeSnapshot.exists) {
    return { updated: false, reason: "trade-not-found" as const };
  }

  const trade = tradeSnapshot.data() as Record<string, unknown>;
  const { patch, nextTradeStatus } = getTradeBrokerLifecyclePatch({ execution });

  return applyTradeExecutionPatch({
    db,
    tradeId: execution.tradeId,
    transition: "sync-trade-broker-lifecycle",
    nextTradeStatus,
    referencePatch: buildTradeExecutionReferencePatch({
      executionId: execution.executionId,
      clientOrderId: execution.clientOrderId,
      orderId: execution.alpacaOrderId ?? null,
      executionUid: execution.uid ?? null,
      executionStatus: execution.status,
      brokerStatus: execution.rawStatus ?? execution.status,
      brokerFilledQty: execution.filledQty ?? null,
      brokerFilledAvgPrice: execution.filledAvgPrice ?? null,
      orderClass: execution.orderClass ?? null,
      takeProfitPrice: execution.takeProfitPrice ?? null,
      stopLossPrice: execution.stopLossPrice ?? null,
      protectionStatus: execution.protectionStatus ?? null,
      protectionMode: execution.protectionMode ?? null,
      protectionActivatedAt: execution.protectionActivatedAt ?? null,
      protectionFailedAt: execution.protectionFailedAt ?? null,
      protectionError: execution.protectionError ?? null,
      stopOrderId: execution.stopOrderId ?? null,
      takeProfitOrderId: execution.takeProfitOrderId ?? null,
      executionSubmittedAt: execution.submittedAt ?? trade.executionSubmittedAt ?? null,
      brokerPositionConflict: execution.brokerPositionConflict === true,
      noOp: execution.noOp === true,
      reason: execution.reconciliationReason ?? execution.errorCode ?? null,
    }),
    lifecyclePatch: patch,
  });
};
