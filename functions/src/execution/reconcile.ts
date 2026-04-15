import { Timestamp, getFirestore, type DocumentSnapshot, type Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { getOpenPositions, getOrderById } from "../lib/alpaca.js";
import { EXECUTIONS_COLLECTION_NAME, syncTradeBrokerLifecycleFromExecution } from "./firestore.js";
import type { AlpacaOrderResponse, ExecutionDocument, ExecutionStatus } from "./types.js";

const alpacaApiKeySecret = defineSecret("ALPACA_API_KEY");
const alpacaSecretKeySecret = defineSecret("ALPACA_SECRET_KEY");

const RECONCILABLE_STATUSES: ExecutionStatus[] = [
  "queued",
  "processing",
  "submitted",
  "accepted",
  "partially_filled",
];

const toTimestamp = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return Timestamp.fromDate(parsedDate);
};

const normalizeSymbol = (value: unknown) => (
  typeof value === "string" ? value.trim().toUpperCase() : ""
);

const mapOrderStatusToExecutionStatus = (order: AlpacaOrderResponse): ExecutionStatus => {
  const normalized = order.status.trim().toLowerCase();

  if (normalized === "new" || normalized === "pending_new" || normalized === "pending_replace") {
    return "submitted";
  }

  if (normalized === "accepted" || normalized === "accepted_for_bidding") {
    return "accepted";
  }

  if (normalized === "partially_filled") {
    return "partially_filled";
  }

  if (normalized === "filled") {
    return "filled";
  }

  if (normalized === "canceled" || normalized === "pending_cancel") {
    return "canceled";
  }

  if (normalized === "expired") {
    return "expired";
  }

  if (normalized === "rejected" || normalized === "stopped" || normalized === "suspended") {
    return "rejected";
  }

  return "submitted";
};

const buildReconciliationPatch = ({
  execution,
  order,
  btcPositionOpen,
}: {
  execution: ExecutionDocument;
  order: AlpacaOrderResponse;
  btcPositionOpen: boolean;
}) => {
  const nextStatus = mapOrderStatusToExecutionStatus(order);
  const nextSubmittedAt = toTimestamp(order.submitted_at ?? order.created_at ?? null);
  const nextFilledAt = toTimestamp(order.filled_at ?? null);
  const nextCanceledAt = toTimestamp(order.canceled_at ?? null);
  const nextErrorCode = (
    nextStatus === "canceled"
    || nextStatus === "expired"
    || nextStatus === "rejected"
  )
    ? nextStatus
    : null;
  const nextErrorMessage = (
    nextStatus === "canceled"
      ? "Order was canceled in Alpaca paper."
      : nextStatus === "expired"
        ? "Order expired in Alpaca paper."
        : nextStatus === "rejected"
          ? "Order was rejected by Alpaca paper."
          : null
  );

  return {
    status: nextStatus,
    brokerOrderStatus: order.status ?? null,
    rawStatus: order.status ?? null,
    alpacaOrderId: order.id ?? execution.alpacaOrderId,
    clientOrderId: order.client_order_id ?? execution.clientOrderId,
    qty: order.qty ?? execution.qty,
    filledQty: order.filled_qty ?? execution.filledQty ?? null,
    filledAvgPrice: order.filled_avg_price ?? execution.filledAvgPrice ?? null,
    submittedAt: nextSubmittedAt,
    filledAt: nextFilledAt,
    canceledAt: nextCanceledAt,
    errorCode: nextErrorCode,
    errorMessage: nextErrorMessage,
    error: nextErrorMessage
      ? {
        code: nextErrorCode,
        message: nextErrorMessage,
      }
      : null,
    orderResponse: order,
    brokerSnapshot: {
      openPositionSymbols: btcPositionOpen ? ["BTCUSD"] : [],
    },
  };
};

const valuesAreEqual = (current: unknown, next: unknown) => {
  if (current instanceof Timestamp && next instanceof Timestamp) {
    return current.toMillis() === next.toMillis();
  }

  if (current instanceof Date && next instanceof Date) {
    return current.getTime() === next.getTime();
  }

  if (current instanceof Timestamp && next instanceof Date) {
    return current.toMillis() === next.getTime();
  }

  if (current instanceof Date && next instanceof Timestamp) {
    return current.getTime() === next.toMillis();
  }

  return JSON.stringify(current) === JSON.stringify(next);
};

const computeChangedPatch = (
  snapshot: DocumentSnapshot,
  patch: Record<string, unknown>
) => {
  const currentData = snapshot.data() as Record<string, unknown> | undefined;
  const changedEntries = Object.entries(patch).filter(([key, value]) => {
    const currentValue = currentData?.[key];
    return !valuesAreEqual(currentValue, value);
  });

  return Object.fromEntries(changedEntries);
};

const reconcileExecution = async ({
  db,
  snapshot,
  btcPositionOpen,
}: {
  db: Firestore;
  snapshot: DocumentSnapshot;
  btcPositionOpen: boolean;
}) => {
  const execution = snapshot.data() as ExecutionDocument | undefined;

  if (!execution) {
    return;
  }

  logger.info("Alpaca reconciliation started.", {
    executionId: snapshot.id,
    tradeId: execution.tradeId,
    clientOrderId: execution.clientOrderId,
    alpacaOrderId: execution.alpacaOrderId,
    currentStatus: execution.status,
  });

  if (!execution.alpacaOrderId) {
    logger.warn("Alpaca reconciliation skipped execution without order id.", {
      executionId: snapshot.id,
      tradeId: execution.tradeId,
      clientOrderId: execution.clientOrderId,
      currentStatus: execution.status,
    });
    return;
  }

  const order = await getOrderById(execution.alpacaOrderId);
  const patch = buildReconciliationPatch({
    execution,
    order,
    btcPositionOpen,
  });
  const nextExecution = {
    ...execution,
    ...patch,
  } as ExecutionDocument;
  const changedPatch = computeChangedPatch(snapshot, patch);

  if (Object.keys(changedPatch).length === 0) {
    const tradeSyncResult = await syncTradeBrokerLifecycleFromExecution({
      db,
      execution: nextExecution,
    });

    logger.info("Alpaca reconciliation found no changes.", {
      executionId: snapshot.id,
      tradeId: execution.tradeId,
      orderId: execution.alpacaOrderId,
      orderStatus: order.status,
      tradeSyncResult,
    });
    return;
  }

  await db.collection(EXECUTIONS_COLLECTION_NAME).doc(snapshot.id).set({
    ...changedPatch,
    updatedAt: Timestamp.now(),
  }, { merge: true });

  const tradeSyncResult = await syncTradeBrokerLifecycleFromExecution({
    db,
    execution: nextExecution,
  });

  logger.info("Alpaca reconciliation updated execution.", {
    executionId: snapshot.id,
    tradeId: execution.tradeId,
    orderId: execution.alpacaOrderId,
    orderStatus: order.status,
    nextStatus: patch.status,
    changedFields: Object.keys(changedPatch),
    btcPositionOpen,
    tradeSyncResult,
  });
};

export const reconcileAlpacaPaperExecutions = onSchedule(
  {
    schedule: "every 5 minutes",
    secrets: [alpacaApiKeySecret, alpacaSecretKeySecret],
  },
  async () => {
    const db = getFirestore();
    const [executionSnapshot, positions] = await Promise.all([
      db
        .collection(EXECUTIONS_COLLECTION_NAME)
        .where("provider", "==", "alpaca")
        .where("mode", "==", "paper")
        .where("status", "in", RECONCILABLE_STATUSES)
        .get(),
      getOpenPositions(),
    ]);

    const btcPositionOpen = positions.some((position) => normalizeSymbol(position.symbol) === "BTCUSD");

    logger.info("Alpaca reconciliation cycle started.", {
      executionCount: executionSnapshot.size,
      btcPositionOpen,
      reconciledStatuses: RECONCILABLE_STATUSES,
    });

    for (const executionDocument of executionSnapshot.docs) {
      try {
        await reconcileExecution({
          db,
          snapshot: executionDocument,
          btcPositionOpen,
        });
      } catch (error) {
        logger.error("Alpaca reconciliation failed for execution.", {
          executionId: executionDocument.id,
          tradeId: executionDocument.get("tradeId") ?? null,
          alpacaOrderId: executionDocument.get("alpacaOrderId") ?? null,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info("Alpaca reconciliation cycle completed.", {
      executionCount: executionSnapshot.size,
      btcPositionOpen,
    });
  }
);
