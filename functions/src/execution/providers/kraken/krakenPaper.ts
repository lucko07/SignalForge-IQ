import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import {
  buildClosedTradePatch,
  buildOpenTradePatch,
  buildRejectedTradePatch,
  getCanonicalTradeStatus,
} from "../../../tradeLifecycle.js";
import {
  createExecutionReservation,
  updateExecutionStatus,
  updateTradeExecutionReferences,
} from "../../firestore.js";
import type { ExecutionAutomationSettings, NormalizedTradeRecord } from "../../types.js";
import {
  KRAKEN_BROKER_VENUE,
  KRAKEN_PAPER_DEFAULT_NOTIONAL_USD,
  KRAKEN_PAPER_PAIR,
  KRAKEN_PAPER_SYMBOL,
  type KrakenPaperCloseResult,
  type KrakenPaperCloseScenario,
  type KrakenPaperExecutionInput,
  type KrakenPaperExecutionResult,
  type KrakenPaperOrderIds,
} from "./krakenTypes.js";

const normalizeTradeId = (value: unknown) => (
  typeof value === "string" ? value.trim() : ""
);

const normalizeSymbol = (value: unknown) => (
  typeof value === "string" ? value.trim().toUpperCase().replace("/", "") : ""
);

const normalizeSide = (value: unknown): "long" | "short" | null => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return normalized === "long" || normalized === "short" ? normalized : null;
};

const isPositiveNumber = (value: unknown): value is number => (
  typeof value === "number" && Number.isFinite(value) && value > 0
);

const roundTo = (value: number, places: number) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

const formatUsd = (value: number) => value.toFixed(2);
const formatBtcQty = (value: number) => value.toFixed(8);

const normalizePositiveNumberFromCandidates = (candidates: unknown[]) => {
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null || candidate === "") {
      continue;
    }

    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
};

const getKrakenPaperOpenPositionMatches = async ({
  db,
  currentExecutionId,
  accessContext,
}: {
  db: Firestore;
  currentExecutionId: string;
  accessContext: KrakenPaperExecutionInput["accessContext"];
}) => {
  const activeSnapshot = await db
    .collection("executions")
    .where("provider", "==", "kraken")
    .where("mode", "==", "paper")
    .where("status", "in", ["submitted", "accepted", "partially_filled", "filled"])
    .limit(10)
    .get();
  const activeOtherExecutions = activeSnapshot.docs.filter((doc) => doc.id !== currentExecutionId);

  const matches = await Promise.all(activeOtherExecutions.map(async (documentSnapshot) => {
    const execution = documentSnapshot.data() as Record<string, unknown>;
    const tradeId = typeof execution.tradeId === "string" ? execution.tradeId : "";
    const tradeSnapshot = tradeId ? await db.collection("trades").doc(tradeId).get() : null;
    const trade = tradeSnapshot?.exists ? tradeSnapshot.data() as Record<string, unknown> : null;
    const canonicalTradeStatus = getCanonicalTradeStatus(trade);
    const isOpenTrade = canonicalTradeStatus === "open";

    return {
      executionId: documentSnapshot.id,
      tradeId: tradeId || null,
      shouldCount: accessContext === "admin-paper-test" ? isOpenTrade : true,
      fields: {
        executionProvider: execution.provider ?? null,
        executionMode: execution.mode ?? null,
        executionStatus: execution.status ?? null,
        executionSymbol: execution.symbol ?? null,
        executionSide: execution.side ?? null,
        tradeStatus: trade?.status ?? null,
        tradeResult: trade?.tradeResult ?? null,
        tradeResultAlias: trade?.result ?? null,
        canonicalTradeStatus,
        isArchived: trade?.isArchived === true,
        source: trade?.source ?? null,
      },
    };
  }));

  return matches;
};

export const buildKrakenPaperExecutionId = (tradeId: string) => `kraken_paper_${tradeId}`;
export const buildKrakenPaperClientOrderId = (tradeId: string) => `sfiq_kraken_paper_${tradeId}`;

export const buildKrakenPaperOrderIds = (tradeId: string): KrakenPaperOrderIds => ({
  brokerOrderId: `paper_kraken_${tradeId}_ENTRY`,
  stopOrderId: `paper_kraken_${tradeId}_STOP`,
  takeProfitOrderId: `paper_kraken_${tradeId}_TP`,
});

const buildKrakenPaperOpenTradePatch = ({
  executionId,
  clientOrderId,
  executionUid,
  orderIds,
  filledQty,
  filledAvgPrice,
  submittedAt,
  stopPrice,
  targetPrice,
}: {
  executionId: string;
  clientOrderId: string;
  executionUid: string | null;
  orderIds: KrakenPaperOrderIds;
  filledQty: string;
  filledAvgPrice: string;
  submittedAt: Timestamp;
  stopPrice: number;
  targetPrice: number;
}) => ({
  ...buildOpenTradePatch({ executionStatus: "filled" }),
  executionId,
  executionProvider: "kraken",
  executionMode: "paper",
  executionStatus: "filled",
  executionClientOrderId: clientOrderId,
  executionOrderId: orderIds.brokerOrderId,
  executionUid,
  brokerOrderId: orderIds.brokerOrderId,
  brokerClientOrderId: clientOrderId,
  brokerStatus: "filled",
  brokerOrderStatus: "filled",
  brokerFilledQty: filledQty,
  brokerFilledAvgPrice: filledAvgPrice,
  filledQty,
  filledAvgPrice,
  brokerVenue: KRAKEN_BROKER_VENUE,
  brokerPair: KRAKEN_PAPER_PAIR,
  brokerAccountType: "paper",
  marginEnabled: false,
  leverage: null,
  orderClass: "simple",
  takeProfitPrice: targetPrice,
  stopLossPrice: stopPrice,
  protectionMode: "synthetic_oco",
  protectionStatus: "active",
  protectionActivatedAt: FieldValue.serverTimestamp(),
  protectionFailedAt: null,
  protectionError: null,
  stopOrderId: orderIds.stopOrderId,
  takeProfitOrderId: orderIds.takeProfitOrderId,
  executionSubmittedAt: submittedAt,
  quantity: Number(filledQty),
  qty: filledQty,
});

const getSimulatedNotionalUsd = (settings: ExecutionAutomationSettings) => (
  isPositiveNumber(settings.notionalUsd) ? settings.notionalUsd : KRAKEN_PAPER_DEFAULT_NOTIONAL_USD
);

const validateKrakenPaperTrade = (
  trade: NormalizedTradeRecord,
  settings: ExecutionAutomationSettings
) => {
  const tradeId = normalizeTradeId(trade.tradeId);
  const symbol = normalizeSymbol(trade.symbol);
  const side = normalizeSide(trade.side);
  const entryPrice = trade.entryPrice ?? null;
  const stopPrice = trade.stopPrice ?? null;
  const targetPrice = trade.targetPrice ?? null;

  if (!settings.enabled) {
    return { valid: false as const, reason: "automation-disabled" };
  }

  if (settings.killSwitch) {
    return { valid: false as const, reason: "kill-switch-enabled" };
  }

  if (!tradeId) {
    return { valid: false as const, reason: "missing-trade-id" };
  }

  if (settings.provider !== "kraken" || settings.mode !== "paper") {
    return { valid: false as const, reason: "unsupported-kraken-paper-settings" };
  }

  if (symbol !== KRAKEN_PAPER_SYMBOL) {
    return { valid: false as const, reason: "symbol-not-allowed" };
  }

  if (!settings.symbolAllowlist.map((item) => normalizeSymbol(item)).includes(KRAKEN_PAPER_SYMBOL)) {
    return { valid: false as const, reason: "symbol-not-allowed" };
  }

  if (side === null) {
    return { valid: false as const, reason: "unsupported-side" };
  }

  if (side === "long" && !settings.longsEnabled) {
    return { valid: false as const, reason: "longs-disabled" };
  }

  if (side === "short" && !settings.shortsEnabled) {
    return { valid: false as const, reason: "shorts-disabled" };
  }

  if (!isPositiveNumber(entryPrice) || !isPositiveNumber(stopPrice) || !isPositiveNumber(targetPrice)) {
    return { valid: false as const, reason: "invalid_protection_geometry" };
  }

  if (side === "long" && !(stopPrice < entryPrice && entryPrice < targetPrice)) {
    return { valid: false as const, reason: "invalid_protection_geometry" };
  }

  if (side === "short" && !(targetPrice < entryPrice && entryPrice < stopPrice)) {
    return { valid: false as const, reason: "invalid_protection_geometry" };
  }

  return {
    valid: true as const,
    tradeId,
    symbol: KRAKEN_PAPER_SYMBOL,
    side,
    entryPrice,
    stopPrice,
    targetPrice,
  };
};

const rejectKrakenPaperTrade = async ({
  db,
  trade,
  automationSettings,
  executionUid,
  executionId,
  clientOrderId,
  reason,
  message,
}: KrakenPaperExecutionInput & {
  executionId: string;
  clientOrderId: string;
  reason: string;
  message: string;
}) => {
  await createExecutionReservation({
    db,
    executionId,
    trade,
    clientOrderId,
    automationSettings,
    uid: executionUid ?? null,
  }).catch(() => undefined);

  await updateExecutionStatus({
    db,
    executionId,
    patch: {
      status: "rejected",
      executionStatus: "rejected",
      rejectionReason: reason,
      provider: "kraken",
      mode: "paper",
      brokerVenue: KRAKEN_BROKER_VENUE,
      brokerPair: KRAKEN_PAPER_PAIR,
      brokerAccountType: "paper",
      marginEnabled: false,
      leverage: null,
      protectionStatus: "failed",
      protectionMode: "synthetic_oco",
      protectionFailedAt: FieldValue.serverTimestamp(),
      reconciliationReason: reason,
      errorCode: reason,
      errorMessage: message,
      validation: {
        tradeEligible: false,
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

  await db.collection("trades").doc(trade.tradeId).set({
    ...buildRejectedTradePatch({
      executionStatus: "rejected",
      rejectionReason: reason,
    }),
    executionId,
    executionProvider: "kraken",
    executionMode: "paper",
    executionClientOrderId: clientOrderId,
    brokerVenue: KRAKEN_BROKER_VENUE,
    brokerPair: KRAKEN_PAPER_PAIR,
    brokerAccountType: "paper",
    brokerStatus: "rejected",
    marginEnabled: false,
    leverage: null,
    protectionStatus: "failed",
  }, { merge: true });
};

export const executeKrakenPaperTrade = async ({
  db,
  trade,
  automationSettings,
  executionUid = null,
  accessContext = "automation",
}: KrakenPaperExecutionInput): Promise<KrakenPaperExecutionResult> => {
  const tradeId = normalizeTradeId(trade.tradeId);
  const executionId = buildKrakenPaperExecutionId(tradeId);
  const clientOrderId = buildKrakenPaperClientOrderId(tradeId);
  const orderIds = buildKrakenPaperOrderIds(tradeId);

  logger.info("Kraken paper execution started", {
    tradeId,
    signalId: trade.signalId ?? null,
    side: trade.side ?? null,
    symbol: trade.symbol ?? null,
    entryPrice: trade.entryPrice ?? null,
    stopPrice: trade.stopPrice ?? null,
    targetPrice: trade.targetPrice ?? null,
    brokerOrderId: orderIds.brokerOrderId,
    stopOrderId: orderIds.stopOrderId,
    takeProfitOrderId: orderIds.takeProfitOrderId,
    accessContext,
  });

  const validation = validateKrakenPaperTrade(trade, automationSettings);

  if (!validation.valid) {
    logger.warn("Kraken paper execution rejected", {
      tradeId,
      signalId: trade.signalId ?? null,
      side: trade.side ?? null,
      symbol: trade.symbol ?? null,
      entryPrice: trade.entryPrice ?? null,
      stopPrice: trade.stopPrice ?? null,
      targetPrice: trade.targetPrice ?? null,
      brokerOrderId: orderIds.brokerOrderId,
      stopOrderId: orderIds.stopOrderId,
      takeProfitOrderId: orderIds.takeProfitOrderId,
      reason: validation.reason,
    });

    await rejectKrakenPaperTrade({
      db,
      trade,
      automationSettings,
      executionUid,
      accessContext,
      executionId,
      clientOrderId,
      reason: validation.reason,
      message: `Kraken paper execution blocked: ${validation.reason}.`,
    });

    return { status: "rejected", executionId, reason: validation.reason };
  }

  logger.info("Kraken paper geometry validation passed", {
    tradeId,
    signalId: trade.signalId ?? null,
    side: validation.side,
    symbol: validation.symbol,
    entryPrice: validation.entryPrice,
    stopPrice: validation.stopPrice,
    targetPrice: validation.targetPrice,
    brokerOrderId: orderIds.brokerOrderId,
    stopOrderId: orderIds.stopOrderId,
    takeProfitOrderId: orderIds.takeProfitOrderId,
  });

  const openPositionMatches = await getKrakenPaperOpenPositionMatches({
    db,
    currentExecutionId: executionId,
    accessContext,
  });
  const countedOpenPositionMatches = openPositionMatches.filter((match) => match.shouldCount);

  if (countedOpenPositionMatches.length >= automationSettings.maxOpenPositions) {
    logger.warn("Kraken paper execution rejected by max open positions guardrail", {
      uid: executionUid,
      provider: automationSettings.provider,
      mode: automationSettings.mode,
      symbol: validation.symbol,
      side: validation.side,
      matchingOpenTradeIds: countedOpenPositionMatches.map((match) => match.tradeId),
      matchingOpenPositions: countedOpenPositionMatches,
      ignoredAdminPaperTestMatches: accessContext === "admin-paper-test"
        ? openPositionMatches.filter((match) => !match.shouldCount)
        : [],
    });

    await rejectKrakenPaperTrade({
      db,
      trade,
      automationSettings,
      executionUid,
      accessContext,
      executionId,
      clientOrderId,
      reason: "max-open-positions-reached",
      message: "Kraken paper execution blocked: max open positions reached.",
    });
    return { status: "rejected", executionId, reason: "max-open-positions-reached" };
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
    return { status: "duplicate", executionId, reason: "execution-reservation-exists" };
  }

  const notionalUsd = getSimulatedNotionalUsd(automationSettings);
  const filledQty = formatBtcQty(notionalUsd / validation.entryPrice);
  const now = Timestamp.now();

  logger.info("Kraken paper entry filled", {
    tradeId,
    signalId: trade.signalId ?? null,
    side: validation.side,
    symbol: validation.symbol,
    entryPrice: validation.entryPrice,
    stopPrice: validation.stopPrice,
    targetPrice: validation.targetPrice,
    brokerOrderId: orderIds.brokerOrderId,
    stopOrderId: orderIds.stopOrderId,
    takeProfitOrderId: orderIds.takeProfitOrderId,
    filledQty,
  });

  logger.info("Kraken paper protective orders created", {
    tradeId,
    signalId: trade.signalId ?? null,
    side: validation.side,
    symbol: validation.symbol,
    entryPrice: validation.entryPrice,
    stopPrice: validation.stopPrice,
    targetPrice: validation.targetPrice,
    brokerOrderId: orderIds.brokerOrderId,
    stopOrderId: orderIds.stopOrderId,
    takeProfitOrderId: orderIds.takeProfitOrderId,
  });

  await updateExecutionStatus({
    db,
    executionId,
    patch: {
      status: "filled",
      executionStatus: "filled",
      provider: "kraken",
      mode: "paper",
      symbol: KRAKEN_PAPER_SYMBOL,
      side: validation.side,
      positionSide: validation.side,
      brokerOrderId: orderIds.brokerOrderId,
      brokerVenue: KRAKEN_BROKER_VENUE,
      brokerPair: KRAKEN_PAPER_PAIR,
      brokerAccountType: "paper",
      brokerOrderStatus: "filled",
      rawStatus: "filled",
      marginEnabled: false,
      leverage: null,
      orderClass: "simple",
      takeProfitPrice: validation.targetPrice,
      stopLossPrice: validation.stopPrice,
      protectionMode: "synthetic_oco",
      protectionStatus: "active",
      protectionActivatedAt: FieldValue.serverTimestamp(),
      protectionFailedAt: null,
      protectionError: null,
      stopOrderId: orderIds.stopOrderId,
      takeProfitOrderId: orderIds.takeProfitOrderId,
      qty: filledQty,
      notional: formatUsd(notionalUsd),
      filledQty,
      filledAvgPrice: formatUsd(validation.entryPrice),
      submittedAt: now,
      filledAt: now,
      orderRequest: {
        venue: KRAKEN_BROKER_VENUE,
        pair: KRAKEN_PAPER_PAIR,
        type: "market",
        side: validation.side === "short" ? "sell" : "buy",
        notionalUsd: formatUsd(notionalUsd),
        clientOrderId,
      },
      orderResponse: {
        id: orderIds.brokerOrderId,
        client_order_id: clientOrderId,
        created_at: now.toDate().toISOString(),
        submitted_at: now.toDate().toISOString(),
        filled_at: now.toDate().toISOString(),
        symbol: KRAKEN_PAPER_SYMBOL,
        qty: filledQty,
        filled_qty: filledQty,
        filled_avg_price: formatUsd(validation.entryPrice),
        type: "market",
        side: validation.side === "short" ? "sell" : "buy",
        time_in_force: "gtc",
        status: "filled",
      },
      brokerSnapshot: {
        openPositionSymbols: [KRAKEN_PAPER_SYMBOL],
        simulated: true,
        protectiveOrders: {
          stopOrderId: orderIds.stopOrderId,
          takeProfitOrderId: orderIds.takeProfitOrderId,
        },
      },
      validation: {
        tradeEligible: true,
        reason: null,
        tradeResult: "open",
        isArchived: trade.isArchived === true,
        isValid: trade.isValid !== false,
        isTest: trade.isTest === true,
      },
      errorCode: null,
      errorMessage: null,
      error: null,
    },
  });

  await updateTradeExecutionReferences({
    db,
    tradeId,
    executionId,
    clientOrderId,
    orderId: orderIds.brokerOrderId,
    orderStatus: "filled",
    executionUid,
    brokerStatus: "filled",
    brokerFilledQty: filledQty,
    brokerFilledAvgPrice: formatUsd(validation.entryPrice),
    executionSubmittedAt: now,
    orderClass: "simple",
    takeProfitPrice: validation.targetPrice,
    stopLossPrice: validation.stopPrice,
    protectionStatus: "active",
    protectionMode: "synthetic_oco",
    protectionActivatedAt: FieldValue.serverTimestamp(),
    protectionFailedAt: null,
    protectionError: null,
    stopOrderId: orderIds.stopOrderId,
    takeProfitOrderId: orderIds.takeProfitOrderId,
    executionProvider: "kraken",
    executionMode: "paper",
    brokerVenue: KRAKEN_BROKER_VENUE,
    brokerPair: KRAKEN_PAPER_PAIR,
    brokerAccountType: "paper",
    marginEnabled: false,
    leverage: null,
  });

  await db.collection("trades").doc(tradeId).set(buildKrakenPaperOpenTradePatch({
    executionId,
    clientOrderId,
    executionUid,
    orderIds,
    filledQty,
    filledAvgPrice: formatUsd(validation.entryPrice),
    submittedAt: now,
    stopPrice: validation.stopPrice,
    targetPrice: validation.targetPrice,
  }), { merge: true });

  if (trade.signalId) {
    const signalReference = db.collection("signals").doc(trade.signalId);
    const signalSnapshot = await signalReference.get();

    if (signalSnapshot.exists) {
      await signalReference.set({
        tradeId,
        executionId,
        executionProvider: "kraken",
        executionMode: "paper",
        executionStatus: "filled",
        brokerVenue: KRAKEN_BROKER_VENUE,
        brokerPair: KRAKEN_PAPER_PAIR,
        brokerOrderId: orderIds.brokerOrderId,
        brokerStatus: "filled",
        brokerFilledQty: filledQty,
        brokerFilledAvgPrice: formatUsd(validation.entryPrice),
        protectionMode: "synthetic_oco",
        protectionStatus: "active",
        stopOrderId: orderIds.stopOrderId,
        takeProfitOrderId: orderIds.takeProfitOrderId,
        statusUpdatedAt: FieldValue.serverTimestamp(),
        statusUpdatedBy: "kraken-paper-execution",
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  }

  logger.info("Kraken paper execution completed", {
    tradeId,
    signalId: trade.signalId ?? null,
    side: validation.side,
    symbol: validation.symbol,
    entryPrice: validation.entryPrice,
    stopPrice: validation.stopPrice,
    targetPrice: validation.targetPrice,
    brokerOrderId: orderIds.brokerOrderId,
    stopOrderId: orderIds.stopOrderId,
    takeProfitOrderId: orderIds.takeProfitOrderId,
  });

  return {
    status: "submitted",
    executionId,
    orderId: orderIds.brokerOrderId,
    clientOrderId,
  };
};

const classifyOutcome = (side: "long" | "short", entryPrice: number, exitPrice: number) => {
  if (exitPrice === entryPrice) {
    return "breakeven" as const;
  }

  return side === "short"
    ? exitPrice < entryPrice ? "win" as const : "loss" as const
    : exitPrice > entryPrice ? "win" as const : "loss" as const;
};

export const closeKrakenPaperTrade = async ({
  db,
  tradeId,
  scenario,
}: {
  db: Firestore;
  tradeId: string;
  scenario: KrakenPaperCloseScenario;
}): Promise<KrakenPaperCloseResult> => {
  const executionId = buildKrakenPaperExecutionId(tradeId);
  const tradeReference = db.collection("trades").doc(tradeId);
  const tradeSnapshot = await tradeReference.get();

  if (!tradeSnapshot.exists) {
    throw new Error("Kraken paper close test trade not found.");
  }

  const trade = tradeSnapshot.data() as NormalizedTradeRecord & Record<string, unknown>;
  const side = normalizeSide(trade.side);
  const entryPrice = Number(trade.entryPrice);
  const stopPrice = Number(trade.stopPrice);
  const targetPrice = Number(trade.targetPrice);
  const quantity = normalizePositiveNumberFromCandidates([
    trade.quantity,
    trade.filledQty,
    trade.brokerFilledQty,
    trade.qty,
  ]);
  const orderIds = buildKrakenPaperOrderIds(tradeId);

  if (!side || !isPositiveNumber(entryPrice) || !isPositiveNumber(stopPrice) || !isPositiveNumber(targetPrice)) {
    throw new Error("Kraken paper close test trade has invalid close inputs.");
  }

  if (quantity === null) {
    logger.error("Kraken paper close quantity normalization failed", {
      tradeId,
      quantity: trade.quantity,
      qty: trade.qty,
      filledQty: trade.filledQty,
      brokerFilledQty: trade.brokerFilledQty,
    });
    throw new Error("Kraken paper close test trade has invalid filled quantity.");
  }

  const exitPrice = scenario === "stop"
    ? stopPrice
    : scenario === "take_profit"
      ? targetPrice
      : entryPrice;
  const filledOrderId = scenario === "take_profit" ? orderIds.takeProfitOrderId : orderIds.stopOrderId;
  const canceledOrderId = scenario === "take_profit" ? orderIds.stopOrderId : orderIds.takeProfitOrderId;
  const pnlPerBtc = side === "short" ? entryPrice - exitPrice : exitPrice - entryPrice;
  const pnlDollar = roundTo(pnlPerBtc * quantity, 2);
  const pnlPercent = roundTo((pnlPerBtc / entryPrice) * 100, 2);
  const riskPerBtc = Math.abs(entryPrice - stopPrice);
  const rrActual = riskPerBtc > 0 ? roundTo(pnlPerBtc / riskPerBtc, 2) : null;
  const result = classifyOutcome(side, entryPrice, exitPrice);

  await updateExecutionStatus({
    db,
    executionId,
    patch: {
      status: "closed",
      executionStatus: "closed",
      protectionStatus: "completed",
      protectionCompletedAt: FieldValue.serverTimestamp(),
      exitPrice,
      pnlDollar,
      pnlPercent,
      rrActual,
      exitOrderId: filledOrderId,
      canceledOrderId,
      canceledProtectiveOrderId: canceledOrderId,
      closeReason: scenario === "take_profit"
        ? "synthetic_oco_take_profit_filled"
        : scenario === "stop"
          ? "synthetic_oco_stop_filled"
          : "broker_flat_reconciled",
      brokerSnapshot: {
        openPositionSymbols: [],
        simulated: true,
        filledProtectiveOrderId: filledOrderId,
        canceledProtectiveOrderId: canceledOrderId,
      },
    },
  });

  await tradeReference.set(buildClosedTradePatch({
    result,
    executionStatus: "closed",
    extra: {
      exitPrice,
      exitTime: FieldValue.serverTimestamp(),
      closeReason: scenario === "take_profit"
        ? "synthetic_oco_take_profit_filled"
        : scenario === "stop"
          ? "synthetic_oco_stop_filled"
          : "broker_flat_reconciled",
      protectionStatus: "completed",
      protectionCompletedAt: FieldValue.serverTimestamp(),
      canceledOrderId,
      canceledProtectiveOrderId: canceledOrderId,
      exitOrderId: filledOrderId,
      pnlPercent,
      pnlDollar,
      ...(rrActual === null ? {} : { rrActual }),
    },
  }), { merge: true });

  return {
    tradeId,
    executionId,
    status: "closed",
    protectionStatus: "completed",
    exitPrice,
    result,
    canceledOrderId,
    exitOrderId: filledOrderId,
    pnlDollar,
    pnlPercent,
    rrActual,
  };
};
