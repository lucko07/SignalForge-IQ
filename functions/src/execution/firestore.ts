import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type {
  ExecutionAutomationSettings,
  ExecutionDocument,
  NormalizedTradeRecord,
} from "./types.js";

const normalizeSide = (value: unknown): "long" | "short" => (
  typeof value === "string" && value.trim().toLowerCase() === "short" ? "short" : "long"
);

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
      qty: null,
      notional: automationSettings.notionalUsd.toFixed(2),
      alpacaOrderId: null,
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
      automationSettings,
      validation: {
        tradeEligible: true,
        reason: null,
        tradeResult: trade.result ?? null,
        isArchived: trade.isArchived === true,
        isValid: trade.isValid !== false,
        isTest: trade.isTest === true,
      },
      orderRequest: null,
      orderResponse: null,
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
  executionSubmittedAt?: unknown;
}) => {
  await db.collection("trades").doc(tradeId).set({
    executionId,
    executionProvider: "alpaca",
    executionMode: "paper",
    executionStatus: orderStatus,
    executionClientOrderId: clientOrderId,
    executionOrderId: orderId,
    executionUid: executionUid ?? null,
    executionSubmittedAt: executionSubmittedAt ?? FieldValue.serverTimestamp(),
    brokerOrderId: orderId,
    brokerClientOrderId: clientOrderId,
    brokerStatus: brokerStatus ?? orderStatus,
    brokerFilledQty: brokerFilledQty ?? null,
    brokerFilledAvgPrice: brokerFilledAvgPrice ?? null,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
};

const valuesAreEqual = (current: unknown, next: unknown) => JSON.stringify(current) === JSON.stringify(next);

const getTradeBrokerLifecyclePatch = ({
  trade,
  execution,
}: {
  trade: Record<string, unknown>;
  execution: ExecutionDocument;
}) => {
  const patch: Record<string, unknown> = {
    executionId: execution.executionId,
    executionProvider: execution.provider,
    executionMode: execution.mode,
    executionStatus: execution.status,
    executionClientOrderId: execution.clientOrderId,
    executionOrderId: execution.alpacaOrderId ?? null,
    executionSubmittedAt: execution.submittedAt ?? trade.executionSubmittedAt ?? null,
    brokerOrderId: execution.alpacaOrderId ?? null,
    brokerClientOrderId: execution.clientOrderId,
    brokerStatus: execution.rawStatus ?? execution.status,
    brokerFilledQty: execution.filledQty ?? null,
    brokerFilledAvgPrice: execution.filledAvgPrice ?? null,
  };

  if (execution.status === "filled" && (trade.result === undefined || trade.result === "open")) {
    patch.result = "open";
    patch.status = "open";
  }

  return Object.fromEntries(
    Object.entries(patch).filter(([key, value]) => !valuesAreEqual(trade[key], value))
  );
};

export const syncTradeBrokerLifecycleFromExecution = async ({
  db,
  execution,
}: {
  db: Firestore;
  execution: ExecutionDocument;
}) => {
  const tradeReference = db.collection("trades").doc(execution.tradeId);
  const tradeSnapshot = await tradeReference.get();

  if (!tradeSnapshot.exists) {
    return { updated: false, reason: "trade-not-found" as const };
  }

  const trade = tradeSnapshot.data() as Record<string, unknown>;
  const patch = getTradeBrokerLifecyclePatch({
    trade,
    execution,
  });

  if (Object.keys(patch).length === 0) {
    return { updated: false, reason: "no-trade-changes" as const };
  }

  await tradeReference.set({
    ...patch,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return { updated: true, reason: "updated" as const, changedFields: Object.keys(patch) };
};
