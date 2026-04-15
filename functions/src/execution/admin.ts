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

const alpacaApiKeySecret = defineSecret("ALPACA_API_KEY");
const alpacaSecretKeySecret = defineSecret("ALPACA_SECRET_KEY");

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

const buildAdminPaperTestTrade = (tradeId: string): NormalizedTradeRecord & Record<string, unknown> => {
  const entryPrice = 100000;
  const stopPrice = 98000;
  const targetPrice = 104000;
  const entryTime = Timestamp.now();
  const createdAt = Timestamp.now();
  const updatedAt = Timestamp.now();

  return {
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
    result: "open",
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
    status: "open",
    source: "admin-paper-test",
  };
};

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
