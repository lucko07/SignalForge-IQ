import { getApps, initializeApp } from "firebase-admin/app";
import { logger } from "firebase-functions";
import { onCall, onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";

if (!getApps().length) {
  initializeApp();
}

console.log("Functions module loaded");

const signalSecret = defineSecret("SIGNAL_INGEST_SECRET");
const closeTradeWebhookSecret = defineSecret("CLOSE_TRADE_WEBHOOK_SECRET");
const alpacaApiKeySecret = defineSecret("ALPACA_API_KEY");
const alpacaSecretKeySecret = defineSecret("ALPACA_SECRET_KEY");
const googleSheetsClientEmailSecret = defineSecret("GOOGLE_SHEETS_CLIENT_EMAIL");
const googleSheetsPrivateKeySecret = defineSecret("GOOGLE_SHEETS_PRIVATE_KEY");
const REQUEST_RATE_LIMIT_WINDOW_MS = Number(process.env.REQUEST_RATE_LIMIT_WINDOW_MS ?? 60 * 1000);
const SIGNAL_INGEST_RATE_LIMIT_MAX = Number(process.env.SIGNAL_INGEST_RATE_LIMIT_MAX ?? 180);
const CLOSE_TRADE_TEST_RATE_LIMIT_MAX = Number(process.env.CLOSE_TRADE_TEST_RATE_LIMIT_MAX ?? 60);

const loadFirestore = () => import("firebase-admin/firestore");
const loadRateLimit = () => import("./security/rateLimit.js");
const loadSignalIngestion = () => import("./signalIngestion.js");
const loadTradeClose = () => import("./tradeClose.js");
const loadTradeSync = () => import("./tradeSync.js");
const loadAutoCloseTrades = () => import("./autoCloseTrades.js");
const loadCloseTradeWebhook = () => import("./webhooks/closeTradeFromWebhook.js");
const loadExecutionModule = () => import("./execution/index.js");
const loadBillingModule = () => import("./billing.js");
const loadExecutionAdminModule = () => import("./execution/admin.js");
const loadExecutionReconcileModule = () => import("./execution/reconcile.js");

export const ingestSignal = onRequest(
  {
    cors: false,
    secrets: [signalSecret],
  },
  async (request, response) => {
    const [{ getRequestId, getRequestIp, enforceRateLimit }, { validateSignalPayload, saveSignalToFirestore }] = await Promise.all([
      loadRateLimit(),
      loadSignalIngestion(),
    ]);
    const requestId = getRequestId(request);
    const clientIp = getRequestIp(request);
    logger.info("Signal ingestion request received.", {
      requestId,
      method: request.method,
      ip: clientIp,
    });

    if (request.method !== "POST") {
      response.status(405).json({ error: "Method not allowed. Use POST." });
      return;
    }

    const rateLimit = await enforceRateLimit({
      route: "functions/ingestSignal",
      identifier: clientIp,
      limit: SIGNAL_INGEST_RATE_LIMIT_MAX,
      windowMs: REQUEST_RATE_LIMIT_WINDOW_MS,
    });

    if (!rateLimit.allowed) {
      response.set("Retry-After", String(rateLimit.retryAfterSeconds));
      response.status(429).json({ error: "Too many requests. Please wait and try again." });
      return;
    }

    const providedSecret = request.header("x-signal-secret")
      ?? request.body?.secret
      ?? request.body?.signalSecret;
    const expectedSecret = signalSecret.value();

    if (!providedSecret || providedSecret !== expectedSecret) {
      logger.warn("Unauthorized signal ingestion attempt.", { requestId, ip: clientIp });
      response.status(401).json({ error: "Unauthorized." });
      return;
    }

    const validation = validateSignalPayload(request.body);

    if (!validation.valid) {
      logger.warn("Signal payload validation failed.", {
        requestId,
        errorCount: validation.errors.length,
      });
      response.status(400).json({
        error: "Invalid signal payload.",
      });
      return;
    }

    try {
      const result = await saveSignalToFirestore(request.body);

      logger.info("Signal saved successfully.", {
        requestId,
        id: result.id,
        collection: result.collectionName,
      });
      response.status(200).json({
        ok: true,
        id: result.id,
        collection: result.collectionName,
      });
    } catch (error) {
      logger.error("Signal ingestion failed.", {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      response.status(500).json({ error: "Failed to save signal." });
    }
  }
);

export const scheduledSignalMaintenance = onSchedule(
  {
    schedule: "every 24 hours",
  },
  async () => {
    logger.info("Scheduled signal maintenance stub invoked.");
    return;
  }
);

export const autoCloseTrades = onSchedule(
  {
    schedule: "* * * * *",
  },
  async () => {
    const [{ getFirestore }, { runAutoCloseTrades }] = await Promise.all([
      loadFirestore(),
      loadAutoCloseTrades(),
    ]);
    await runAutoCloseTrades(getFirestore());
  }
);

export const closeTradeForTest = onRequest(
  {
    cors: false,
    secrets: [signalSecret],
  },
  async (request, response) => {
    const [{ getRequestId, getRequestIp, enforceRateLimit }, { closeTrade }, { getFirestore }] = await Promise.all([
      loadRateLimit(),
      loadTradeClose(),
      loadFirestore(),
    ]);
    const requestId = getRequestId(request);
    const clientIp = getRequestIp(request);
    logger.info("Trade close test request received.", {
      requestId,
      method: request.method,
      ip: clientIp,
    });

    if (request.method !== "POST") {
      response.status(405).json({ error: "Method not allowed. Use POST." });
      return;
    }

    const rateLimit = await enforceRateLimit({
      route: "functions/closeTradeForTest",
      identifier: clientIp,
      limit: CLOSE_TRADE_TEST_RATE_LIMIT_MAX,
      windowMs: REQUEST_RATE_LIMIT_WINDOW_MS,
    });

    if (!rateLimit.allowed) {
      response.set("Retry-After", String(rateLimit.retryAfterSeconds));
      response.status(429).json({ error: "Too many requests. Please wait and try again." });
      return;
    }

    const providedSecret = request.header("x-signal-secret")
      ?? request.body?.secret
      ?? request.body?.signalSecret;
    const expectedSecret = signalSecret.value();

    if (!providedSecret || providedSecret !== expectedSecret) {
      logger.warn("Unauthorized trade close test attempt.", { requestId, ip: clientIp });
      response.status(401).json({ error: "Unauthorized." });
      return;
    }

    const tradeId = request.body?.tradeId;
    const signalId = request.body?.signalId;
    const exitPrice = request.body?.exitPrice;
    const exitTime = request.body?.exitTime;
    const closeReason = request.body?.closeReason;

    if ((!tradeId && !signalId) || exitPrice === undefined || !exitTime) {
      response.status(400).json({
        error: "tradeId or signalId, exitPrice, and exitTime are required.",
      });
      return;
    }

    try {
      const result = await closeTrade({
        db: getFirestore(),
        tradeId,
        signalId,
        exitPrice,
        exitTime,
        closeReason,
      });

      if (result.status === "not-found") {
        response.status(404).json({ ok: false, ...result });
        return;
      }

      response.status(200).json({ ok: true, ...result });
    } catch (error) {
      logger.error("Trade close test request failed.", {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      response.status(500).json({ error: "Failed to close trade." });
    }
  }
);

export const createTradeFromSignal = onDocumentCreated(
  {
    document: "signals/{signalId}",
    memory: "256MiB",
    maxInstances: 1,
    concurrency: 1,
  },
  async (event) => {
    const [{ getFirestore }, { syncSignalToTrade }] = await Promise.all([
      loadFirestore(),
      loadTradeSync(),
    ]);
    const snapshot = event.data;
    const signalId = event.params.signalId;

    if (!snapshot) {
      logger.warn("Signal creation trigger fired without document data.", {
        signalId,
      });
      return;
    }

    logger.info("Signal create event received for trade sync.", {
      signalId,
    });

    await syncSignalToTrade(getFirestore(), snapshot.id, snapshot.data());
  }
);

export const updateTradeFromSignal = onDocumentUpdated(
  {
    document: "signals/{signalId}",
    memory: "256MiB",
    maxInstances: 1,
    concurrency: 1,
  },
  async (event) => {
    const [{ getFirestore }, { syncSignalToTrade }] = await Promise.all([
      loadFirestore(),
      loadTradeSync(),
    ]);
    const afterSnapshot = event.data?.after;
    const signalId = event.params.signalId;

    if (!afterSnapshot) {
      logger.warn("Signal update trigger fired without document data.", {
        signalId,
      });
      return;
    }

    logger.info("Signal update event received for trade sync.", {
      signalId,
    });

    await syncSignalToTrade(getFirestore(), afterSnapshot.id, afterSnapshot.data());
  }
);

export const closeTradeFromWebhook = onRequest(
  {
    cors: false,
    memory: "256MiB",
    maxInstances: 1,
    concurrency: 1,
    secrets: [
      closeTradeWebhookSecret,
      alpacaApiKeySecret,
      alpacaSecretKeySecret,
      googleSheetsClientEmailSecret,
      googleSheetsPrivateKeySecret,
    ],
  },
  async (request, response) => {
    const module = await loadCloseTradeWebhook();
    return module.closeTradeFromWebhook(request, response);
  }
);

export const executePaperTradeFromTrade = onDocumentCreated(
  {
    document: "trades/{tradeId}",
    memory: "256MiB",
    maxInstances: 1,
    concurrency: 1,
    secrets: [alpacaApiKeySecret, alpacaSecretKeySecret],
  },
  async (event) => {
    const module = await loadExecutionModule();
    return module.handleExecutePaperTradeFromTrade(event);
  }
);

export const createCheckoutSession = onCall({}, async (request) => {
  const module = await loadBillingModule();
  return module.createCheckoutSession(request as never, undefined as never);
});

export const createBillingPortalSession = onCall({}, async (request) => {
  const module = await loadBillingModule();
  return module.createBillingPortalSession(request as never, undefined as never);
});

export const stripeWebhook = onRequest(
  {
    secrets: [defineSecret("STRIPE_WEBHOOK_SECRET")],
  },
  async (request, response) => {
    const module = await loadBillingModule();
    return module.stripeWebhook(request, response);
  }
);
export { saveAutomationSettings } from "./automation.js";
export { deliverSignalToSubscribers } from "./triggers/deliverSignalToSubscribers";
export { retryPendingWebhooks } from "./jobs/retryPendingWebhooks";
export const runAdminPaperExecutionTest = onCall({}, async (request) => {
  const module = await loadExecutionAdminModule();
  return module.runAdminPaperExecutionTest(request as never, undefined as never);
});

export {
  runAdminKrakenPaperCloseTest,
  runAdminKrakenPaperExecutionTest,
  runAdminKrakenPaperShortEntryTest,
  runAdminKrakenPaperShortStopTest,
  runAdminKrakenPaperShortTakeProfitTest,
  runAdminKrakenPaperTakeProfitTest,
  runAdminKrakenLiveRiskCheck,
  runAdminKrakenReadOnlyTest,
} from "./execution/admin.js";

export const saveAlpacaPaperAutomationSettings = onCall({}, async (request) => {
  const module = await loadExecutionAdminModule();
  return module.saveAlpacaPaperAutomationSettings(request as never, undefined as never);
});

export const testAlpacaConnection = onCall(
  {
    secrets: [alpacaApiKeySecret, alpacaSecretKeySecret],
  },
  async (request) => {
    const module = await loadExecutionAdminModule();
    return module.testAlpacaConnection(request as never, undefined as never);
  }
);

export const reconcileAlpacaPaperExecutions = onSchedule(
  {
    schedule: "every 5 minutes",
    secrets: [alpacaApiKeySecret, alpacaSecretKeySecret],
  },
  async (event) => {
    const module = await loadExecutionReconcileModule();
    return module.reconcileAlpacaPaperExecutions(event as never, undefined as never);
  }
);
export {
  clearFailedEmailLogin,
  getEmailLoginAttemptStatus,
  recordFailedEmailLogin,
} from "./authSecurity.js";
