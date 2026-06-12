import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { isAdminProfile } from "../access.js";
import { getAccount } from "../lib/alpaca.js";
import { buildExecutionId } from "./firestore.js";
import { getExecutionAutomationSettings } from "./config.js";
import { executeTradeThroughAlpacaPaper, validatePaperExecutionEligibility } from "./executeTrade.js";
import {
  getAutomationSettings,
  getBrokerConnection,
  normalizeAutomationSettings,
} from "./userState.js";
import type { ExecutionDocument, NormalizedTradeRecord } from "./types.js";
import { buildPendingExecutionTradePatch } from "../tradeLifecycle.js";
import {
  buildKrakenLiveRiskPolicy,
  closeKrakenPaperTrade,
  executeKrakenPaperTrade,
  validateKrakenLiveRiskPolicy,
} from "./providers/kraken/krakenProvider.js";
import {
  KrakenReadOnlyClientError,
  createKrakenReadOnlyClient,
  type KrakenBalanceResult,
  type KrakenServerTimeResult,
} from "./providers/kraken/live/krakenReadOnlyClient.js";

const alpacaApiKeySecret = defineSecret("ALPACA_API_KEY");
const alpacaSecretKeySecret = defineSecret("ALPACA_SECRET_KEY");
const krakenApiKeySecret = defineSecret("KRAKEN_API_KEY");
const krakenApiSecretSecret = defineSecret("KRAKEN_API_SECRET");

const maskValue = (value: string | null | undefined, visibleCount = 4) => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length <= visibleCount) {
    return "*".repeat(trimmed.length);
  }

  return `${"*".repeat(trimmed.length - visibleCount)}${trimmed.slice(-visibleCount)}`;
};

const normalizeKrakenAssetSymbol = (asset: string) => {
  if (asset === "XXBT") {
    return "XBT";
  }

  if (asset === "ZUSD") {
    return "USD";
  }

  if ((asset.startsWith("X") || asset.startsWith("Z")) && asset.length > 3) {
    return asset.slice(1);
  }

  return asset;
};

const sanitizeKrakenBalances = (balances: KrakenBalanceResult) => (
  Object.entries(balances)
    .map(([asset, total]) => ({
      asset: normalizeKrakenAssetSymbol(asset),
      krakenAsset: asset,
      total,
    }))
    .sort((left, right) => left.asset.localeCompare(right.asset))
);

const getNonZeroKrakenBalanceAssets = (balances: KrakenBalanceResult) => (
  sanitizeKrakenBalances(balances)
    .filter((balance) => {
      const parsedTotal = Number(balance.total);
      return Number.isFinite(parsedTotal) && parsedTotal !== 0;
    })
    .map((balance) => balance.asset)
);

const getKrakenUsdBalance = (balances: KrakenBalanceResult) => (
  sanitizeKrakenBalances(balances)
    .filter((balance) => balance.asset === "USD")
    .reduce((total, balance) => {
      const parsedTotal = Number(balance.total);
      return Number.isFinite(parsedTotal) ? total + parsedTotal : total;
    }, 0)
);

const sanitizeKrakenErrorForClient = (error: ReturnType<typeof toSanitizedKrakenError> | null) => (
  error
    ? {
      category: error.category,
      message: error.message,
    }
    : null
);

const inferKrakenPermissionsStatus = ({
  balanceAvailable,
  openOrdersAvailable,
  tradeBalanceAvailable,
  openOrdersError,
  tradeBalanceError,
}: {
  balanceAvailable: boolean;
  openOrdersAvailable: boolean;
  tradeBalanceAvailable: boolean;
  openOrdersError: ReturnType<typeof toSanitizedKrakenError> | null;
  tradeBalanceError: ReturnType<typeof toSanitizedKrakenError> | null;
}) => {
  if (!balanceAvailable) {
    return "balance_permission_unavailable";
  }

  if (openOrdersAvailable && tradeBalanceAvailable) {
    return "read_only_permissions_verified";
  }

  if (
    openOrdersError?.category === "missing_permissions"
    || tradeBalanceError?.category === "missing_permissions"
  ) {
    return "limited_read_only_permissions";
  }

  if (!openOrdersAvailable || !tradeBalanceAvailable) {
    return "partial_read_only_permissions";
  }

  return "unknown";
};

const sanitizeKrakenServerTime = (serverTime: KrakenServerTimeResult | null) => (
  serverTime
    ? {
      unixtime: typeof serverTime.unixtime === "number" ? serverTime.unixtime : null,
      rfc1123: typeof serverTime.rfc1123 === "string" ? serverTime.rfc1123 : null,
    }
    : null
);

const toSanitizedKrakenError = (error: unknown) => {
  if (error instanceof KrakenReadOnlyClientError) {
    return {
      category: error.category,
      message: error.message,
      krakenErrors: error.krakenErrors,
    };
  }

  return {
    category: "unknown",
    message: error instanceof Error ? error.message : "Unknown Kraken read-only error.",
    krakenErrors: [],
  };
};

const assertAdmin = async (uid: string) => {
  const db = getFirestore();
  const profileSnapshot = await db.collection("users").doc(uid).get();

  if (!profileSnapshot.exists) {
    throw new HttpsError("not-found", "User profile not found.");
  }

  if (!isAdminProfile(profileSnapshot.data())) {
    throw new HttpsError("permission-denied", "Only admins can manage Alpaca paper automation.");
  }

  return { db, profile: profileSnapshot.data() };
};

const normalizeSymbolAllowlistInput = (value: unknown) => (
  Array.isArray(value)
    ? value
      .map((item) => (typeof item === "string" ? item.trim().toUpperCase() : ""))
      .filter(Boolean)
    : undefined
);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeTradeIdInput = (value: unknown) => (
  typeof value === "string" && value.trim() ? value.trim() : null
);

const normalizeKrakenPaperTestSide = (value: unknown): "long" | "short" => (
  typeof value === "string" && value.trim().toLowerCase() === "short" ? "short" : "long"
);

const normalizeKrakenPaperCloseScenario = (value: unknown): "stop" | "take_profit" | "manual_flat" => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "take_profit" || normalized === "tp") {
    return "take_profit";
  }

  if (normalized === "manual_flat" || normalized === "manual") {
    return "manual_flat";
  }

  return "stop";
};

const getAdminKrakenPaperNotionalUsd = (settings: ReturnType<typeof normalizeAutomationSettings>) => (
  settings.provider === "kraken" && settings.mode === "paper" && settings.notionalUsd > 0
    ? settings.notionalUsd
    : 25
);

const buildAdminPaperTestTrade = (tradeId: string): NormalizedTradeRecord & Record<string, unknown> => {
  const entryPrice = 100000;
  const stopPrice = 98000;
  const targetPrice = 104000;
  const entryTime = Timestamp.now();
  const createdAt = Timestamp.now();
  const updatedAt = Timestamp.now();

  return {
    ...buildPendingExecutionTradePatch(),
    signalId: tradeId,
    tradeId,
    strategyVersion: "admin_paper_test_v1",
    symbol: "BTCUSD",
    timeframe: "15m",
    side: "long",
    entryTime,
    entryPrice,
    exitTime: null,
    exitPrice: null,
    stopPrice,
    targetPrice,
    riskPerShare: entryPrice - stopPrice,
    rewardPerShare: targetPrice - entryPrice,
    rrPlanned: Number(((targetPrice - entryPrice) / (entryPrice - stopPrice)).toFixed(2)),
    rrActual: null,
    pnlDollar: null,
    pnlPercent: null,
    fees: 0,
    slippage: 0,
    marketSession: "Admin Test",
    dayOfWeek: "Unknown",
    entryHourNY: null,
    setupType: "Admin Paper Execution Test",
    emaFilterPassed: true,
    antiChasePassed: true,
    isManualReview: false,
    notes: "Admin-only Alpaca paper execution test.",
    isArchived: false,
    isTest: false,
    isValid: true,
    createdAt,
    updatedAt,
    source: "admin-paper-test",
  };
};

const buildAdminKrakenPaperTestTrade = (
  tradeId: string,
  side: "long" | "short"
): NormalizedTradeRecord & Record<string, unknown> => {
  const entryPrice = 100000;
  const stopPrice = side === "short" ? 102000 : 98000;
  const targetPrice = side === "short" ? 96000 : 104000;
  const riskPerShare = Math.abs(entryPrice - stopPrice);
  const rewardPerShare = Math.abs(targetPrice - entryPrice);
  const entryTime = Timestamp.now();
  const createdAt = Timestamp.now();
  const updatedAt = Timestamp.now();

  return {
    ...buildPendingExecutionTradePatch(),
    signalId: tradeId,
    tradeId,
    strategyVersion: "admin_kraken_paper_test_v1",
    symbol: "BTCUSD",
    timeframe: "15m",
    side,
    entryTime,
    entryPrice,
    exitTime: null,
    exitPrice: null,
    stopPrice,
    targetPrice,
    riskPerShare,
    rewardPerShare,
    rrPlanned: Number((rewardPerShare / riskPerShare).toFixed(2)),
    rrActual: null,
    pnlDollar: null,
    pnlPercent: null,
    fees: 0,
    slippage: 0,
    marketSession: "Admin Test",
    dayOfWeek: "Unknown",
    entryHourNY: null,
    setupType: "Admin Kraken Paper Execution Test",
    emaFilterPassed: true,
    antiChasePassed: true,
    isManualReview: false,
    notes: "Admin-only Kraken internal paper execution test.",
    isArchived: false,
    isTest: false,
    isValid: true,
    executionProvider: "kraken",
    executionMode: "paper",
    brokerVenue: "kraken",
    brokerPair: "BTC/USD",
    brokerAccountType: "paper",
    marginEnabled: false,
    leverage: null,
    createdAt,
    updatedAt,
    source: "admin-kraken-paper-test",
  };
};

const withAdminKrakenPaperCloseSeedFill = <T extends NormalizedTradeRecord & Record<string, unknown>>(
  trade: T
) => ({
  ...trade,
  quantity: 0.00025,
  qty: "0.00025000",
  filledQty: "0.00025000",
  brokerFilledQty: "0.00025000",
  brokerFilledAvgPrice: "100000.00",
});

const getExecutionResultReason = (
  executionResult:
    | Awaited<ReturnType<typeof executeTradeThroughAlpacaPaper>>
    | { status: "queued"; reason: string; executionId: string }
    | null
) => {
  if (!executionResult) {
    return null;
  }

  if ("reason" in executionResult) {
    return executionResult.reason;
  }

  return null;
};

const waitForExecutionDocument = async ({
  db,
  executionId,
  maxAttempts = 12,
  delayMs = 500,
}: {
  db: FirebaseFirestore.Firestore;
  executionId: string;
  maxAttempts?: number;
  delayMs?: number;
}) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const snapshot = await db.collection("executions").doc(executionId).get();

    if (snapshot.exists) {
      return snapshot.data() as ExecutionDocument;
    }

    await sleep(delayMs);
  }

  return null;
};

export const saveAlpacaPaperAutomationSettings = onCall({}, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "You must be signed in to manage Alpaca paper automation.");
  }

  const { db } = await assertAdmin(request.auth.uid);
  const currentSettings = await getAutomationSettings(db, request.auth.uid);

  const nextSettings = normalizeAutomationSettings({
    ...currentSettings,
    enabled: request.data?.enabled ?? currentSettings.enabled,
    provider: "alpaca",
    mode: "paper",
    symbolAllowlist: normalizeSymbolAllowlistInput(request.data?.symbolAllowlist)
      ?? currentSettings.symbolAllowlist,
    longsEnabled: request.data?.longsEnabled ?? currentSettings.longsEnabled,
    shortsEnabled: request.data?.shortsEnabled ?? currentSettings.shortsEnabled,
    maxOpenPositions: request.data?.maxOpenPositions ?? currentSettings.maxOpenPositions,
    maxTradesPerDay: request.data?.maxTradesPerDay ?? currentSettings.maxTradesPerDay,
    sizingMode: "fixed_notional",
    notionalUsd: request.data?.notionalUsd ?? currentSettings.notionalUsd,
    killSwitch: request.data?.killSwitch ?? currentSettings.killSwitch,
    allowUnprotectedMarketEntry:
      request.data?.allowUnprotectedMarketEntry ?? currentSettings.allowUnprotectedMarketEntry,
  });

  if (!nextSettings.symbolAllowlist.includes("BTCUSD")) {
    throw new HttpsError("invalid-argument", "BTCUSD must remain enabled for the paper test flow.");
  }

  const automationReference = db
    .collection("users")
    .doc(request.auth.uid)
    .collection("automationSettings")
    .doc("default");
  const brokerReference = db
    .collection("users")
    .doc(request.auth.uid)
    .collection("brokerConnections")
    .doc("alpaca");

  const existingBrokerConnection = await getBrokerConnection(db, request.auth.uid);

  await Promise.all([
    automationReference.set({
      ...nextSettings,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true }),
    brokerReference.set({
      provider: "alpaca",
      mode: "paper",
      connected: existingBrokerConnection.connected,
      lastValidatedAt: existingBrokerConnection.lastValidatedAt ?? null,
      paperTradingEnabled: nextSettings.enabled,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true }),
  ]);

  logger.info("Alpaca paper automation settings updated.", {
    userId: request.auth.uid,
    enabled: nextSettings.enabled,
    killSwitch: nextSettings.killSwitch,
    notionalUsd: nextSettings.notionalUsd,
    symbolAllowlist: nextSettings.symbolAllowlist,
    longsEnabled: nextSettings.longsEnabled,
    shortsEnabled: nextSettings.shortsEnabled,
    allowUnprotectedMarketEntry: nextSettings.allowUnprotectedMarketEntry,
  });

  return {
    ok: true,
    settings: nextSettings,
  };
});

export const testAlpacaConnection = onCall(
  {
    secrets: [alpacaApiKeySecret, alpacaSecretKeySecret],
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "You must be signed in to test Alpaca connectivity.");
    }

    const { db } = await assertAdmin(request.auth.uid);
    const brokerReference = db
      .collection("users")
      .doc(request.auth.uid)
      .collection("brokerConnections")
      .doc("alpaca");
    const currentBrokerState = await getBrokerConnection(db, request.auth.uid);

    try {
      const account = await getAccount();

      await brokerReference.set({
        provider: "alpaca",
        mode: "paper",
        connected: true,
        lastValidatedAt: FieldValue.serverTimestamp(),
        paperTradingEnabled: currentBrokerState.paperTradingEnabled,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      logger.info("Alpaca admin connectivity test succeeded.", {
        userId: request.auth.uid,
        accountId: account.id,
        status: account.status,
      });

      return {
        ok: true,
        provider: "alpaca",
        mode: "paper",
        account: {
          id: maskValue(account.id),
          accountNumber: maskValue(account.account_number),
          status: account.status,
          currency: account.currency,
          buyingPower: account.buying_power,
          cash: account.cash,
          portfolioValue: account.portfolio_value,
          cryptoStatus: account.crypto_status ?? null,
          tradingBlocked: account.trading_blocked === true,
          transfersBlocked: account.transfers_blocked === true,
          accountBlocked: account.account_blocked === true,
        },
      };
    } catch (error) {
      await brokerReference.set({
        provider: "alpaca",
        mode: "paper",
        connected: false,
        lastValidatedAt: FieldValue.serverTimestamp(),
        paperTradingEnabled: currentBrokerState.paperTradingEnabled,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      }, { merge: true }).catch(() => undefined);

      logger.error("Alpaca admin connectivity test failed.", {
        userId: request.auth.uid,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new HttpsError("internal", "Failed to connect to the Alpaca paper account.");
    }
  }
);

export const runAdminKrakenReadOnlyTest = onCall(
  {
    secrets: [krakenApiKeySecret, krakenApiSecretSecret],
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "You must be signed in to test Kraken connectivity.");
    }

    await assertAdmin(request.auth.uid);

    logger.info("Kraken read-only admin connectivity test started.", {
      userId: request.auth.uid,
      provider: "kraken",
      mode: "read_only",
    });

    try {
      const lastCheckedAt = new Date().toISOString();
      const client = createKrakenReadOnlyClient({
        apiKey: krakenApiKeySecret.value(),
        apiSecret: krakenApiSecretSecret.value(),
      });
      const [balancesResult, openOrdersResult, tradeBalanceResult, serverTimeResult] = await Promise.allSettled([
        client.getAccountBalance(),
        client.getOpenOrders(),
        client.getTradeBalance(),
        client.getServerTime(),
      ]);
      const balances = balancesResult.status === "fulfilled" ? balancesResult.value : {};
      const balanceError = balancesResult.status === "rejected"
        ? toSanitizedKrakenError(balancesResult.reason)
        : null;
      const openOrdersError = openOrdersResult.status === "rejected"
        ? toSanitizedKrakenError(openOrdersResult.reason)
        : null;
      const tradeBalanceError = tradeBalanceResult.status === "rejected"
        ? toSanitizedKrakenError(tradeBalanceResult.reason)
        : null;
      const serverTimeError = serverTimeResult.status === "rejected"
        ? toSanitizedKrakenError(serverTimeResult.reason)
        : null;
      const connected = balancesResult.status === "fulfilled";
      const balanceAssetCount = Object.keys(balances).length;
      const nonZeroBalanceAssets = getNonZeroKrakenBalanceAssets(balances);
      const openOrdersCount = openOrdersResult.status === "fulfilled"
        ? Object.keys(openOrdersResult.value.open ?? {}).length
        : null;
      const permissionsStatus = inferKrakenPermissionsStatus({
        balanceAvailable: connected,
        openOrdersAvailable: openOrdersResult.status === "fulfilled",
        tradeBalanceAvailable: tradeBalanceResult.status === "fulfilled",
        openOrdersError,
        tradeBalanceError,
      });
      const serverTime = serverTimeResult.status === "fulfilled"
        ? sanitizeKrakenServerTime(serverTimeResult.value)
        : null;
      const balanceMessage = connected && nonZeroBalanceAssets.length === 0
        ? "Connected successfully. No funded spot balances detected."
        : null;
      const openOrdersMessage = openOrdersCount === 0
        ? "No open Kraken orders detected."
        : null;

      logger.info("Kraken read-only admin connectivity test completed.", {
        userId: request.auth.uid,
        connected,
        provider: "kraken",
        mode: "read_only",
        balanceAssetCount,
        nonZeroBalanceAssetCount: nonZeroBalanceAssets.length,
        openOrdersCount,
        permissionsStatus,
        serverTimeAvailable: serverTime !== null,
        lastCheckedAt,
        warning: "Read-only check only. Live execution remains disabled.",
        balanceStatus: balancesResult.status,
        openOrdersStatus: openOrdersResult.status,
        tradeBalanceStatus: tradeBalanceResult.status,
        serverTimeStatus: serverTimeResult.status,
        balanceErrorCategory: balanceError?.category ?? null,
        openOrdersErrorCategory: openOrdersError?.category ?? null,
        tradeBalanceErrorCategory: tradeBalanceError?.category ?? null,
        serverTimeErrorCategory: serverTimeError?.category ?? null,
      });

      return {
        ok: connected,
        connected,
        provider: "kraken",
        mode: "read_only",
        balanceAssetCount,
        nonZeroBalanceAssets,
        openOrdersCount,
        permissionsStatus,
        serverTime,
        responseTimestamp: lastCheckedAt,
        lastCheckedAt,
        messages: {
          balance: balanceMessage,
          openOrders: openOrdersMessage,
          warning: "Read-only check only. Live execution remains disabled.",
        },
        diagnostics: {
          balance: {
            available: connected,
            error: sanitizeKrakenErrorForClient(balanceError),
          },
          openOrders: {
            available: openOrdersResult.status === "fulfilled",
            error: sanitizeKrakenErrorForClient(openOrdersError),
          },
          tradeBalance: {
            available: tradeBalanceResult.status === "fulfilled",
            error: sanitizeKrakenErrorForClient(tradeBalanceError),
          },
          serverTime: {
            available: serverTimeResult.status === "fulfilled",
            error: sanitizeKrakenErrorForClient(serverTimeError),
          },
        },
      };
    } catch (error) {
      const sanitizedError = toSanitizedKrakenError(error);
      const lastCheckedAt = new Date().toISOString();

      logger.error("Kraken read-only admin connectivity test failed.", {
        userId: request.auth.uid,
        connected: false,
        provider: "kraken",
        mode: "read_only",
        permissionsStatus: "unavailable",
        lastCheckedAt,
        errorCategory: sanitizedError.category,
        krakenErrors: sanitizedError.krakenErrors,
        warning: "Read-only check only. Live execution remains disabled.",
      });

      return {
        ok: false,
        connected: false,
        provider: "kraken",
        mode: "read_only",
        balanceAssetCount: 0,
        nonZeroBalanceAssets: [],
        openOrdersCount: null,
        permissionsStatus: "unavailable",
        serverTime: null,
        responseTimestamp: lastCheckedAt,
        lastCheckedAt,
        messages: {
          balance: null,
          openOrders: null,
          warning: "Read-only check only. Live execution remains disabled.",
        },
        diagnostics: {
          balance: {
            available: false,
            error: sanitizeKrakenErrorForClient(sanitizedError),
          },
          openOrders: {
            available: false,
            error: null,
          },
          tradeBalance: {
            available: false,
            error: null,
          },
          serverTime: {
            available: false,
            error: null,
          },
        },
        error: sanitizeKrakenErrorForClient(sanitizedError),
      };
    }
  }
);

export const runAdminKrakenLiveRiskCheck = onCall(
  {
    secrets: [krakenApiKeySecret, krakenApiSecretSecret],
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "You must be signed in to run the Kraken live risk check.");
    }

    const { db } = await assertAdmin(request.auth.uid);
    const storedAutomationSettings = await getAutomationSettings(db, request.auth.uid);
    const liveSettings = normalizeAutomationSettings({
      ...storedAutomationSettings,
      provider: storedAutomationSettings.provider,
      mode: storedAutomationSettings.mode,
    });
    const requestedSymbol = typeof request.data?.symbol === "string"
      ? request.data.symbol
      : "BTCUSD";
    const requestedSide = typeof request.data?.side === "string"
      ? request.data.side
      : "long";
    const diagnosticTrade = {
      tradeId: `admin_kraken_live_risk_check_${Date.now()}`,
      signalId: null,
      symbol: requestedSymbol,
      side: requestedSide as NormalizedTradeRecord["side"],
      entryPrice: 100000,
      stopPrice: 98000,
      targetPrice: 104000,
      isArchived: false,
      isTest: true,
      isValid: true,
      executionProvider: "kraken",
      executionMode: "live",
      brokerVenue: "kraken",
      brokerPair: "BTC/USD",
      brokerAccountType: "live",
      marginEnabled: request.data?.marginEnabled === true,
      leverage: typeof request.data?.leverage === "number" ? request.data.leverage : 1,
    } as NormalizedTradeRecord;
    const policy = buildKrakenLiveRiskPolicy();
    let availableUsd: number | null = null;
    let balanceDiagnostics: {
      available: boolean;
      error: ReturnType<typeof sanitizeKrakenErrorForClient>;
    } = {
      available: false,
      error: null,
    };

    try {
      const client = createKrakenReadOnlyClient({
        apiKey: krakenApiKeySecret.value(),
        apiSecret: krakenApiSecretSecret.value(),
      });
      const balances = await client.getAccountBalance();
      availableUsd = getKrakenUsdBalance(balances);
      balanceDiagnostics = {
        available: true,
        error: null,
      };
    } catch (error) {
      balanceDiagnostics = {
        available: false,
        error: sanitizeKrakenErrorForClient(toSanitizedKrakenError(error)),
      };
    }

    const validation = await validateKrakenLiveRiskPolicy({
      db,
      trade: diagnosticTrade,
      automationSettings: liveSettings,
      executionUid: request.auth.uid,
      availableUsd,
    });

    logger.info("Admin Kraken live risk check completed.", {
      userId: request.auth.uid,
      allowed: validation.allowed,
      reason: validation.reason,
      liveEnabled: policy.liveEnabled,
      allowedSymbols: policy.allowedSymbols,
      maxNotionalUsd: policy.maxNotionalUsd,
      killSwitch: liveSettings.killSwitch,
      maxOpenPositions: policy.maxOpenPositions,
      maxTradesPerDay: policy.maxTradesPerDay,
      noLiveOrderEndpointsCalled: true,
      blockedEndpoints: policy.blockedEndpoints,
    });

    return {
      ok: true,
      provider: "kraken",
      mode: "live",
      liveEnabled: policy.liveEnabled,
      allowedSymbols: policy.allowedSymbols,
      maxNotionalUsd: policy.maxNotionalUsd,
      killSwitch: liveSettings.killSwitch,
      maxOpenPositions: policy.maxOpenPositions,
      maxTradesPerDay: policy.maxTradesPerDay,
      validation: {
        allowed: validation.allowed,
        reason: validation.reason,
        summary: validation.summary,
      },
      diagnostics: {
        balance: balanceDiagnostics,
        availableUsd,
        noLiveOrderEndpointsCalled: true,
        blockedEndpoints: policy.blockedEndpoints,
      },
    };
  }
);

export const runAdminPaperExecutionTest = onCall(
  {
    secrets: [alpacaApiKeySecret, alpacaSecretKeySecret],
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "You must be signed in to run the paper execution test.");
    }

    const { db } = await assertAdmin(request.auth.uid);
    const requestedTradeId = normalizeTradeIdInput(request.data?.tradeId);
    const tradeId = requestedTradeId ?? `admin_paper_test_${Date.now()}`;
    const tradeReference = db.collection("trades").doc(tradeId);
    const executionId = buildExecutionId(tradeId);
    const fallbackPaperSettings = getExecutionAutomationSettings();
    const storedAutomationSettings = await getAutomationSettings(db, request.auth.uid);
    const paperSettings = normalizeAutomationSettings({
      ...fallbackPaperSettings,
      ...storedAutomationSettings,
      provider: "alpaca",
      mode: "paper",
    });

    logger.info("Admin paper execution test started.", {
      userId: request.auth.uid,
      tradeId,
      executionId,
      requestedTradeId,
      provider: paperSettings.provider,
      mode: paperSettings.mode,
      loadedAutomationSettings: paperSettings,
    });

    const existingTradeSnapshot = await tradeReference.get();
    const tradePayload = existingTradeSnapshot.exists
      ? {
        tradeId,
        ...(existingTradeSnapshot.data() as Record<string, unknown>),
      } as NormalizedTradeRecord
      : buildAdminPaperTestTrade(tradeId);
    const validation = validatePaperExecutionEligibility(tradePayload, paperSettings);

    logger.info("Admin paper execution test validation complete.", {
      userId: request.auth.uid,
      tradeId,
      executionId,
      validation,
    });

    let executionResult:
      | Awaited<ReturnType<typeof executeTradeThroughAlpacaPaper>>
      | { status: "queued"; reason: string; executionId: string }
      | null = null;

    if (!existingTradeSnapshot.exists) {
      logger.info("Admin paper execution test creating trade document.", {
        userId: request.auth.uid,
        tradeId,
        executionId,
      });
      await tradeReference.set(tradePayload);
      executionResult = await executeTradeThroughAlpacaPaper({
        db,
        trade: tradePayload,
        automationSettings: paperSettings,
        executionUid: request.auth.uid,
        accessContext: "admin-paper-test",
      });
    } else {
      const existingExecutionSnapshot = await db.collection("executions").doc(executionId).get();

      if (existingExecutionSnapshot.exists) {
        executionResult = {
          status: "duplicate",
          reason: "execution-document-exists",
          executionId,
        };
      } else {
        logger.info("Admin paper execution test reusing trade and invoking execution directly.", {
          userId: request.auth.uid,
          tradeId,
          executionId,
        });
        executionResult = await executeTradeThroughAlpacaPaper({
          db,
          trade: tradePayload,
          automationSettings: paperSettings,
          executionUid: request.auth.uid,
          accessContext: "admin-paper-test",
        });
      }
    }

    const executionDocument = await waitForExecutionDocument({
      db,
      executionId,
    });

    logger.info("Admin paper execution test completed.", {
      userId: request.auth.uid,
      tradeId,
      executionId,
      executionStatus: executionDocument?.status ?? executionResult?.status ?? "not-created",
      alpacaOrderId: executionDocument?.alpacaOrderId ?? null,
    });

    return {
      ok: true,
      tradeId,
      executionId,
      validation,
      execution: {
        status: executionDocument?.status ?? executionResult?.status ?? "not-created",
        skipped: (executionDocument?.status ?? executionResult?.status) === "skipped",
        submitted:
          (executionDocument?.status ?? executionResult?.status) === "submitted"
          || (executionDocument?.status ?? executionResult?.status) === "accepted"
          || (executionDocument?.status ?? executionResult?.status) === "filled"
          || (executionDocument?.status ?? executionResult?.status) === "partially_filled",
        reason:
          executionDocument?.errorMessage
          ?? getExecutionResultReason(executionResult),
        alpacaOrderId: executionDocument?.alpacaOrderId ?? null,
      },
      tradeCreated: !existingTradeSnapshot.exists,
      reusedTrade: existingTradeSnapshot.exists,
    };
  }
);

export const runAdminKrakenPaperExecutionTest = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "You must be signed in to run the Kraken paper execution test.");
  }

  const { db } = await assertAdmin(request.auth.uid);
  const requestedTradeId = normalizeTradeIdInput(request.data?.tradeId);
  const side = normalizeKrakenPaperTestSide(request.data?.side);
  const tradeId = requestedTradeId ?? `admin_kraken_paper_test_${side}_${Date.now()}`;
  const tradeReference = db.collection("trades").doc(tradeId);
  const executionId = `kraken_paper_${tradeId}`;
  const storedAutomationSettings = await getAutomationSettings(db, request.auth.uid);
  const paperSettings = normalizeAutomationSettings({
    ...storedAutomationSettings,
    enabled: true,
    provider: "kraken",
    mode: "paper",
    symbolAllowlist: ["BTCUSD"],
    longsEnabled: true,
    shortsEnabled: true,
    maxOpenPositions: storedAutomationSettings.maxOpenPositions,
    maxTradesPerDay: storedAutomationSettings.maxTradesPerDay,
    sizingMode: "fixed_notional",
    notionalUsd: getAdminKrakenPaperNotionalUsd(storedAutomationSettings),
    killSwitch: false,
    allowUnprotectedMarketEntry: false,
  });

  logger.info("Admin Kraken paper execution test started.", {
    userId: request.auth.uid,
    tradeId,
    executionId,
    side,
    notionalUsd: paperSettings.notionalUsd,
  });

  const existingTradeSnapshot = await tradeReference.get();
  const tradePayload = existingTradeSnapshot.exists
    ? {
      tradeId,
      ...(existingTradeSnapshot.data() as Record<string, unknown>),
      executionProvider: "kraken",
      executionMode: "paper",
    } as NormalizedTradeRecord
    : buildAdminKrakenPaperTestTrade(tradeId, side);

  if (!existingTradeSnapshot.exists) {
    await tradeReference.set(tradePayload);
  }

  const executionResult = await executeKrakenPaperTrade({
    db,
    trade: tradePayload,
    automationSettings: paperSettings,
    executionUid: request.auth.uid,
    accessContext: "admin-paper-test",
  });

  const executionDocument = await waitForExecutionDocument({
    db,
    executionId,
  });

  return {
    ok: true,
    tradeId,
    status: executionDocument?.status ?? executionResult.status,
    executionProvider: "kraken",
    executionMode: "paper",
    brokerOrderId: executionDocument?.brokerOrderId ?? `paper_kraken_${tradeId}_ENTRY`,
    stopOrderId: executionDocument?.stopOrderId ?? `paper_kraken_${tradeId}_STOP`,
    takeProfitOrderId: executionDocument?.takeProfitOrderId ?? `paper_kraken_${tradeId}_TP`,
    protectionStatus: executionDocument?.protectionStatus ?? null,
  };
});

export const runAdminKrakenPaperCloseTest = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "You must be signed in to run the Kraken paper close test.");
  }

  const { db } = await assertAdmin(request.auth.uid);
  const side = normalizeKrakenPaperTestSide(request.data?.side);
  const scenario = normalizeKrakenPaperCloseScenario(request.data?.scenario);
  const requestedTradeId = normalizeTradeIdInput(request.data?.tradeId);
  const tradeId = requestedTradeId ?? `admin_kraken_paper_close_test_${side}_${scenario}_${Date.now()}`;
  const tradeReference = db.collection("trades").doc(tradeId);

  if (!requestedTradeId) {
    const storedAutomationSettings = await getAutomationSettings(db, request.auth.uid);
    const paperSettings = normalizeAutomationSettings({
      ...storedAutomationSettings,
      enabled: true,
      provider: "kraken",
      mode: "paper",
      symbolAllowlist: ["BTCUSD"],
      longsEnabled: true,
      shortsEnabled: true,
      notionalUsd: getAdminKrakenPaperNotionalUsd(storedAutomationSettings),
      killSwitch: false,
      allowUnprotectedMarketEntry: false,
    });
    const tradePayload = withAdminKrakenPaperCloseSeedFill(
      buildAdminKrakenPaperTestTrade(tradeId, side)
    );

    await tradeReference.set(tradePayload);
    await executeKrakenPaperTrade({
      db,
      trade: tradePayload,
      automationSettings: paperSettings,
      executionUid: request.auth.uid,
      accessContext: "admin-paper-test",
    });
    await tradeReference.set({
      quantity: 0.00025,
      qty: "0.00025000",
      filledQty: "0.00025000",
      brokerFilledQty: "0.00025000",
      brokerFilledAvgPrice: "100000.00",
    }, { merge: true });
  }

  const closeResult = await closeKrakenPaperTrade({
    db,
    tradeId,
    scenario,
  });

  return {
    ok: true,
    ...closeResult,
  };
});

export const runAdminKrakenPaperTakeProfitTest = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "You must be signed in to run the Kraken paper take-profit test.");
  }

  const { db } = await assertAdmin(request.auth.uid);
  const tradeId = `admin_kraken_paper_take_profit_test_long_${Date.now()}`;
  const tradeReference = db.collection("trades").doc(tradeId);
  const storedAutomationSettings = await getAutomationSettings(db, request.auth.uid);
  const paperSettings = normalizeAutomationSettings({
    ...storedAutomationSettings,
    enabled: true,
    provider: "kraken",
    mode: "paper",
    symbolAllowlist: ["BTCUSD"],
    longsEnabled: true,
    shortsEnabled: true,
    sizingMode: "fixed_notional",
    notionalUsd: 25,
    killSwitch: false,
    allowUnprotectedMarketEntry: false,
  });
  const tradePayload = withAdminKrakenPaperCloseSeedFill(
    buildAdminKrakenPaperTestTrade(tradeId, "long")
  );

  await tradeReference.set(tradePayload);
  await executeKrakenPaperTrade({
    db,
    trade: tradePayload,
    automationSettings: paperSettings,
    executionUid: request.auth.uid,
    accessContext: "admin-paper-test",
  });
  await tradeReference.set({
    quantity: 0.00025,
    qty: "0.00025000",
    filledQty: "0.00025000",
    brokerFilledQty: "0.00025000",
    brokerFilledAvgPrice: "100000.00",
  }, { merge: true });

  const closeResult = await closeKrakenPaperTrade({
    db,
    tradeId,
    scenario: "take_profit",
  });

  return {
    ok: true,
    expected: {
      pnlDollar: 1,
      pnlPercent: 4,
      rrActual: 2,
    },
    ...closeResult,
  };
});

const runAdminKrakenPaperShortLifecycleTest = async ({
  uid,
  scenario,
}: {
  uid: string;
  scenario: "stop" | "take_profit";
}) => {
  const { db } = await assertAdmin(uid);
  const tradeId = `admin_kraken_paper_short_${scenario}_test_${Date.now()}`;
  const tradeReference = db.collection("trades").doc(tradeId);
  const storedAutomationSettings = await getAutomationSettings(db, uid);
  const paperSettings = normalizeAutomationSettings({
    ...storedAutomationSettings,
    enabled: true,
    provider: "kraken",
    mode: "paper",
    symbolAllowlist: ["BTCUSD"],
    longsEnabled: true,
    shortsEnabled: true,
    sizingMode: "fixed_notional",
    notionalUsd: 25,
    killSwitch: false,
    allowUnprotectedMarketEntry: false,
  });
  const tradePayload = withAdminKrakenPaperCloseSeedFill(
    buildAdminKrakenPaperTestTrade(tradeId, "short")
  );

  await tradeReference.set(tradePayload);
  await executeKrakenPaperTrade({
    db,
    trade: tradePayload,
    automationSettings: paperSettings,
    executionUid: uid,
    accessContext: "admin-paper-test",
  });
  await tradeReference.set({
    quantity: 0.00025,
    qty: "0.00025000",
    filledQty: "0.00025000",
    brokerFilledQty: "0.00025000",
    brokerFilledAvgPrice: "100000.00",
  }, { merge: true });

  const closeResult = await closeKrakenPaperTrade({
    db,
    tradeId,
    scenario,
  });

  return {
    ok: true,
    expected: scenario === "take_profit"
      ? {
        exitPrice: 96000,
        pnlDollar: 1,
        pnlPercent: 4,
        rrActual: 2,
        result: "win",
      }
      : {
        exitPrice: 102000,
        pnlDollar: -0.5,
        pnlPercent: -2,
        rrActual: -1,
        result: "loss",
      },
    ...closeResult,
  };
};

export const runAdminKrakenPaperShortEntryTest = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "You must be signed in to run the Kraken paper short entry test.");
  }

  const { db } = await assertAdmin(request.auth.uid);
  const tradeId = `admin_kraken_paper_short_entry_test_${Date.now()}`;
  const executionId = `kraken_paper_${tradeId}`;
  const tradeReference = db.collection("trades").doc(tradeId);
  const storedAutomationSettings = await getAutomationSettings(db, request.auth.uid);
  const paperSettings = normalizeAutomationSettings({
    ...storedAutomationSettings,
    enabled: true,
    provider: "kraken",
    mode: "paper",
    symbolAllowlist: ["BTCUSD"],
    longsEnabled: true,
    shortsEnabled: true,
    sizingMode: "fixed_notional",
    notionalUsd: 25,
    killSwitch: false,
    allowUnprotectedMarketEntry: false,
  });
  const tradePayload = withAdminKrakenPaperCloseSeedFill(
    buildAdminKrakenPaperTestTrade(tradeId, "short")
  );

  await tradeReference.set(tradePayload);
  const executionResult = await executeKrakenPaperTrade({
    db,
    trade: tradePayload,
    automationSettings: paperSettings,
    executionUid: request.auth.uid,
    accessContext: "admin-paper-test",
  });
  await tradeReference.set({
    quantity: 0.00025,
    qty: "0.00025000",
    filledQty: "0.00025000",
    brokerFilledQty: "0.00025000",
    brokerFilledAvgPrice: "100000.00",
  }, { merge: true });

  const [executionDocument, tradeSnapshot] = await Promise.all([
    waitForExecutionDocument({ db, executionId }),
    tradeReference.get(),
  ]);
  const trade = tradeSnapshot.data() as Record<string, unknown> | undefined;

  return {
    ok: true,
    tradeId,
    executionId,
    status: trade?.status ?? null,
    tradeResult: trade?.tradeResult ?? null,
    result: trade?.result ?? null,
    executionStatus: trade?.executionStatus ?? executionDocument?.status ?? executionResult.status,
    executionProvider: trade?.executionProvider ?? "kraken",
    executionMode: trade?.executionMode ?? "paper",
    brokerVenue: trade?.brokerVenue ?? "kraken",
    brokerPair: trade?.brokerPair ?? "BTC/USD",
    brokerStatus: trade?.brokerStatus ?? executionDocument?.rawStatus ?? null,
    protectionStatus: trade?.protectionStatus ?? executionDocument?.protectionStatus ?? null,
    protectionMode: trade?.protectionMode ?? executionDocument?.protectionMode ?? null,
    stopOrderId: trade?.stopOrderId ?? executionDocument?.stopOrderId ?? null,
    takeProfitOrderId: trade?.takeProfitOrderId ?? executionDocument?.takeProfitOrderId ?? null,
  };
});

export const runAdminKrakenPaperShortStopTest = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "You must be signed in to run the Kraken paper short stop test.");
  }

  return runAdminKrakenPaperShortLifecycleTest({
    uid: request.auth.uid,
    scenario: "stop",
  });
});

export const runAdminKrakenPaperShortTakeProfitTest = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "You must be signed in to run the Kraken paper short take-profit test.");
  }

  return runAdminKrakenPaperShortLifecycleTest({
    uid: request.auth.uid,
    scenario: "take_profit",
  });
});
