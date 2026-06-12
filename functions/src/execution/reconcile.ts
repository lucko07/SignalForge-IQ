import { Timestamp, getFirestore, type DocumentSnapshot, type Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { cancelOrderById, closePositionBySymbol, createOrder, getOpenPositions, getOrderById } from "../lib/alpaca.js";
import { EXECUTIONS_COLLECTION_NAME, syncTradeBrokerLifecycleFromExecution } from "./firestore.js";
import type { AlpacaOrderResponse, ExecutionDocument, ExecutionStatus } from "./types.js";
import { closeTradeFromBrokerReconciliation } from "../tradeClose.js";

const alpacaApiKeySecret = defineSecret("ALPACA_API_KEY");
const alpacaSecretKeySecret = defineSecret("ALPACA_SECRET_KEY");

const RECONCILABLE_STATUSES: ExecutionStatus[] = [
  "queued",
  "processing",
  "submitted",
  "accepted",
  "partially_filled",
  "filled",
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

const normalizeSide = (value: unknown) => (
  typeof value === "string" ? value.trim().toLowerCase() : ""
);

const isOrderFinal = (status: string | null | undefined) => {
  const normalized = (status ?? "").trim().toLowerCase();
  return normalized === "filled" || normalized === "canceled" || normalized === "expired" || normalized === "rejected";
};

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
  positionOpen,
}: {
  execution: ExecutionDocument;
  order: AlpacaOrderResponse;
  positionOpen: boolean;
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
      openPositionSymbols: positionOpen ? [normalizeSymbol(execution.symbol)] : [],
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
  positionsBySymbol,
}: {
  db: Firestore;
  snapshot: DocumentSnapshot;
  positionsBySymbol: Set<string>;
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
  const symbol = normalizeSymbol(execution.symbol);
  const positionOpen = positionsBySymbol.has(symbol);
  const patch = buildReconciliationPatch({
    execution,
    order,
    positionOpen,
  });
  const nextExecution = {
    ...execution,
    ...patch,
  } as ExecutionDocument;
  const changedPatch = computeChangedPatch(snapshot, patch);

  const postPatch: Record<string, unknown> = {};

  if (mapOrderStatusToExecutionStatus(order) === "filled" && execution.protectionMode !== "synthetic_oco") {
    const side = normalizeSide(execution.side) === "short" ? "buy" : "sell";
    const qty = (order.filled_qty ?? execution.filledQty ?? "").trim();
    if (!qty) {
      postPatch.protectionStatus = "failed";
      postPatch.protectionFailedAt = Timestamp.now();
      postPatch.protectionError = "Cannot create synthetic OCO without filled quantity.";
      postPatch.errorCode = "protection-submit-failed";
      postPatch.errorMessage = "Cannot create synthetic OCO without filled quantity.";
    } else {
      try {
        const stopPrice = execution.stopLossPrice;
        const targetPrice = execution.takeProfitPrice;
        if (typeof stopPrice !== "number" || typeof targetPrice !== "number") {
          throw new Error("Missing stop/target prices for synthetic OCO.");
        }
        const stopOrder = await createOrder({
          symbol,
          side: side as "buy" | "sell",
          type: "stop_limit",
          time_in_force: "gtc",
          qty,
          stop_price: stopPrice.toFixed(2),
          limit_price: stopPrice.toFixed(2),
          client_order_id: `${execution.clientOrderId}_STOP`,
        });
        const takeProfitOrder = await createOrder({
          symbol,
          side: side as "buy" | "sell",
          type: "limit",
          time_in_force: "gtc",
          qty,
          limit_price: targetPrice.toFixed(2),
          client_order_id: `${execution.clientOrderId}_TP`,
        });
        postPatch.protectionMode = "synthetic_oco";
        postPatch.protectionStatus = "active";
        postPatch.protectionActivatedAt = Timestamp.now();
        postPatch.protectionFailedAt = null;
        postPatch.protectionError = null;
        postPatch.stopOrderId = stopOrder.id ?? null;
        postPatch.takeProfitOrderId = takeProfitOrder.id ?? null;
      } catch (error) {
        await closePositionBySymbol(symbol).catch(() => null);
        postPatch.protectionMode = "synthetic_oco";
        postPatch.protectionStatus = "failed";
        postPatch.protectionFailedAt = Timestamp.now();
        postPatch.protectionError = error instanceof Error ? error.message : String(error);
        postPatch.errorCode = "protection-submit-failed";
        postPatch.errorMessage = error instanceof Error ? error.message : String(error);
      }
    }
  }

  const nextStopOrderId = (postPatch.stopOrderId as string | null | undefined) ?? execution.stopOrderId;
  const nextTakeProfitOrderId = (postPatch.takeProfitOrderId as string | null | undefined) ?? execution.takeProfitOrderId;
  const brokerFlat = !positionOpen;
  let closeReason: "synthetic_oco_stop_filled" | "synthetic_oco_take_profit_filled" | "broker_flat_reconciled" | null = null;
  let closeExitPrice: number | null = null;
  let closeExitTime: string | null = null;
  let canceledRemainingOrderId: string | null = null;

  if (execution.protectionMode === "synthetic_oco" || postPatch.protectionMode === "synthetic_oco") {
    if ((!nextStopOrderId || !nextTakeProfitOrderId) && !brokerFlat) {
      postPatch.protectionStatus = "missing_orders";
      postPatch.protectionFailedAt = Timestamp.now();
      postPatch.protectionError = "Synthetic OCO orders missing while broker position remains open.";
      logger.error("Synthetic OCO placement failed", {
        tradeId: execution.tradeId,
        signalId: execution.signalId ?? null,
        symbol,
        side: execution.side,
        stopOrderId: nextStopOrderId,
        takeProfitOrderId: nextTakeProfitOrderId,
      });
      await closePositionBySymbol(symbol).catch(() => null);
    }

    if (nextStopOrderId && nextTakeProfitOrderId) {
      const [stopOrder, takeProfitOrder] = await Promise.all([
        getOrderById(nextStopOrderId).catch(() => null),
        getOrderById(nextTakeProfitOrderId).catch(() => null),
      ]);
      const stopFilled = stopOrder?.status?.toLowerCase() === "filled";
      const tpFilled = takeProfitOrder?.status?.toLowerCase() === "filled";
      if (stopFilled && takeProfitOrder && !isOrderFinal(takeProfitOrder.status)) {
        await cancelOrderById(nextTakeProfitOrderId).catch(() => false);
        canceledRemainingOrderId = nextTakeProfitOrderId;
        postPatch.protectionStatus = "completed";
        logger.info("Synthetic OCO reconciled flat broker position", {
          tradeId: execution.tradeId,
          signalId: execution.signalId ?? null,
          symbol,
          side: execution.side,
          stopOrderId: nextStopOrderId,
          takeProfitOrderId: nextTakeProfitOrderId,
          canceledRemainingOrderId,
        });
        closeReason = "synthetic_oco_stop_filled";
        closeExitPrice = Number(stopOrder.filled_avg_price ?? stopOrder.stop_price ?? execution.stopLossPrice ?? 0) || null;
        closeExitTime = stopOrder.filled_at ?? stopOrder.updated_at ?? null;
      } else if (tpFilled && stopOrder && !isOrderFinal(stopOrder.status)) {
        await cancelOrderById(nextStopOrderId).catch(() => false);
        canceledRemainingOrderId = nextStopOrderId;
        postPatch.protectionStatus = "completed";
        logger.info("Synthetic OCO reconciled flat broker position", {
          tradeId: execution.tradeId,
          signalId: execution.signalId ?? null,
          symbol,
          side: execution.side,
          stopOrderId: nextStopOrderId,
          takeProfitOrderId: nextTakeProfitOrderId,
          canceledRemainingOrderId,
        });
        closeReason = "synthetic_oco_take_profit_filled";
        closeExitPrice = Number(takeProfitOrder.filled_avg_price ?? takeProfitOrder.limit_price ?? execution.takeProfitPrice ?? 0) || null;
        closeExitTime = takeProfitOrder.filled_at ?? takeProfitOrder.updated_at ?? null;
      } else if (brokerFlat) {
        if (stopOrder && !isOrderFinal(stopOrder.status)) {
          await cancelOrderById(nextStopOrderId).catch(() => false);
          canceledRemainingOrderId = nextStopOrderId;
        }
        if (takeProfitOrder && !isOrderFinal(takeProfitOrder.status)) {
          await cancelOrderById(nextTakeProfitOrderId).catch(() => false);
          canceledRemainingOrderId = canceledRemainingOrderId ?? nextTakeProfitOrderId;
        }
        postPatch.protectionStatus = "completed";
        logger.info("Synthetic OCO reconciled flat broker position", {
          tradeId: execution.tradeId,
          signalId: execution.signalId ?? null,
          symbol,
          side: execution.side,
          stopOrderId: nextStopOrderId,
          takeProfitOrderId: nextTakeProfitOrderId,
          canceledRemainingOrderId,
        });
        closeReason = "broker_flat_reconciled";
        closeExitPrice = Number(order.filled_avg_price ?? execution.filledAvgPrice ?? execution.stopLossPrice ?? execution.takeProfitPrice ?? 0) || null;
        closeExitTime = order.filled_at ?? order.updated_at ?? null;
      }
    } else if (brokerFlat) {
      postPatch.protectionStatus = nextStopOrderId && nextTakeProfitOrderId ? "completed" : "missing_orders";
      closeReason = "broker_flat_reconciled";
      closeExitPrice = Number(order.filled_avg_price ?? execution.filledAvgPrice ?? execution.stopLossPrice ?? execution.takeProfitPrice ?? 0) || null;
      closeExitTime = order.filled_at ?? order.updated_at ?? null;
    }
  }

  const mergedPatch = { ...changedPatch, ...postPatch };

  if (Object.keys(mergedPatch).length === 0) {
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
    ...mergedPatch,
    updatedAt: Timestamp.now(),
  }, { merge: true });

  if (closeReason) {
    const closeResult = await closeTradeFromBrokerReconciliation({
      db,
      tradeId: execution.tradeId,
      signalId: execution.signalId,
      exitPrice: closeExitPrice,
      exitTime: closeExitTime,
      closeReason,
    });

    logger.info("Broker reconciliation attempted trade close sync.", {
      tradeId: execution.tradeId,
      signalId: execution.signalId ?? null,
      symbol,
      side: execution.side,
      entryPrice: execution.orderResponse?.filled_avg_price ?? null,
      exitPrice: closeExitPrice,
      exitTime: closeExitTime,
      closeReason,
      outcome: "outcome" in closeResult ? closeResult.outcome : null,
      canceledRemainingOrderId,
      closeStatus: closeResult.status,
    });
  }

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
    changedFields: Object.keys(mergedPatch),
    positionOpen,
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

    const positionsBySymbol = new Set(positions.map((position) => normalizeSymbol(position.symbol)).filter(Boolean));

    logger.info("Alpaca reconciliation cycle started.", {
      executionCount: executionSnapshot.size,
      openPositionSymbols: [...positionsBySymbol],
      reconciledStatuses: RECONCILABLE_STATUSES,
    });

    for (const executionDocument of executionSnapshot.docs) {
      try {
        await reconcileExecution({
          db,
          snapshot: executionDocument,
          positionsBySymbol,
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
      openPositionSymbols: [...positionsBySymbol],
    });
  }
);
