import { logger } from "firebase-functions";
import { executeTradeThroughAlpacaPaper } from "./executeTrade.js";
import type { ExecutionAutomationSettings, NormalizedTradeRecord } from "./types.js";
import { getFirestore, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { resolveAdminPaperExecutionTarget } from "./adminTarget.js";
import { buildClientOrderId, buildExecutionId, markTradeNotExecuted } from "./firestore.js";

type TradeCreatedEvent = {
  data?: QueryDocumentSnapshot;
  params: {
    tradeId?: string;
  };
};

const isTradeRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

const normalizeTradeId = (value: unknown) => (
  typeof value === "string" ? value.trim() : ""
);

const isExplicitKrakenLiveTrade = (trade: NormalizedTradeRecord) => (
  trade.executionProvider === "kraken" && trade.executionMode === "live"
);

const buildKrakenLiveBlockedSettings = (): ExecutionAutomationSettings => ({
  enabled: false,
  provider: "kraken",
  mode: "live",
  symbolAllowlist: ["BTCUSD"],
  longsEnabled: true,
  shortsEnabled: false,
  maxOpenPositions: 1,
  maxTradesPerDay: 1,
  sizingMode: "fixed_notional",
  notionalUsd: 25,
  killSwitch: true,
  allowUnprotectedMarketEntry: false,
});

export const handleExecutePaperTradeFromTrade = async (event: TradeCreatedEvent) => {
  const snapshot = event.data;
  const tradeId = normalizeTradeId(event.params.tradeId) || normalizeTradeId(snapshot?.id);

  if (!snapshot) {
    logger.warn("Alpaca execution trigger fired without trade document data.", {
      tradeId: tradeId || null,
    });
    return;
  }

  if (!tradeId) {
    logger.warn("Alpaca execution trigger fired without a tradeId parameter.", {
      snapshotId: snapshot.id ?? null,
    });
    return;
  }

  const tradePayload = snapshot.data();

  if (!isTradeRecord(tradePayload)) {
    logger.warn("Alpaca execution trigger received malformed trade data.", {
      tradeId,
      snapshotId: snapshot.id,
      payloadType: typeof tradePayload,
    });
    return;
  }

  const trade: NormalizedTradeRecord = {
    tradeId,
    ...tradePayload,
  };

  logger.info("Paper execution trigger received.", {
    tradeId,
    signalId: trade.signalId ?? null,
    symbol: trade.symbol ?? null,
    side: trade.side ?? null,
    executionProvider: trade.executionProvider ?? null,
    executionMode: trade.executionMode ?? null,
  });

  const db = getFirestore();

  if (isExplicitKrakenLiveTrade(trade)) {
    const krakenModule = await import("./providers/kraken/krakenProvider.js");

    logger.warn("Explicit Kraken live trade blocked before provider target resolution.", {
      tradeId,
      signalId: trade.signalId ?? null,
      provider: "kraken",
      mode: "live",
      ...krakenModule.KRAKEN_LIVE_REJECTION,
      noLiveOrderEndpointsCalled: true,
      blockedEndpoints: krakenModule.KRAKEN_LIVE_BLOCKED_ENDPOINTS,
    });

    await krakenModule.rejectKrakenLiveExecution({
      db,
      trade,
      automationSettings: buildKrakenLiveBlockedSettings(),
      executionUid: null,
    });
    return;
  }

  const adminTarget = await resolveAdminPaperExecutionTarget(db);

  if (!adminTarget) {
    logger.warn("Paper execution skipped because no eligible admin automation target is enabled.", {
      tradeId,
      signalId: trade.signalId ?? null,
      symbol: trade.symbol ?? null,
      side: trade.side ?? null,
    });

    await markTradeNotExecuted({
      db,
      tradeId,
      executionId: buildExecutionId(tradeId),
      clientOrderId: buildClientOrderId(tradeId),
      executionStatus: "not_sent",
      brokerStatus: "not_sent",
      noOp: true,
      reason: "no-admin-automation-target",
    });

    return;
  }

  logger.info("Paper execution target resolved for live trade.", {
    tradeId,
    signalId: trade.signalId ?? null,
    executionUid: adminTarget.uid,
    provider: adminTarget.settings.provider,
    mode: adminTarget.settings.mode,
    notionalUsd: adminTarget.settings.notionalUsd,
  });

  if (adminTarget.settings.provider === "alpaca") {
    await executeTradeThroughAlpacaPaper({
      db,
      trade,
      automationSettings: adminTarget.settings,
      executionUid: adminTarget.uid,
      accessContext: "automation",
    });
    return;
  }

  const krakenModule = await import("./providers/kraken/krakenProvider.js");

  if (adminTarget.settings.provider === "kraken" && adminTarget.settings.mode === "paper") {
    await krakenModule.executeKrakenPaperTrade({
      db,
      trade,
      automationSettings: adminTarget.settings,
      executionUid: adminTarget.uid,
      accessContext: "automation",
    });
    return;
  }

  if (adminTarget.settings.provider === "kraken" && adminTarget.settings.mode === "live") {
    logger.warn("Admin-target Kraken live execution blocked before broker order placement.", {
      tradeId,
      signalId: trade.signalId ?? null,
      executionUid: adminTarget.uid,
      provider: "kraken",
      mode: "live",
      ...krakenModule.KRAKEN_LIVE_REJECTION,
      noLiveOrderEndpointsCalled: true,
      blockedEndpoints: krakenModule.KRAKEN_LIVE_BLOCKED_ENDPOINTS,
    });

    await krakenModule.rejectKrakenLiveExecution({
      db,
      trade,
      automationSettings: adminTarget.settings,
      executionUid: adminTarget.uid,
    });
    return;
  }

  await executeTradeThroughAlpacaPaper({
    db,
    trade,
    automationSettings: adminTarget.settings,
    executionUid: adminTarget.uid,
    accessContext: "automation",
  });
};
