import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import {
  saveSignalToFirestore,
  validateSignalPayload,
} from "./signalIngestion.js";
import { runAutoCloseTrades } from "./autoCloseTrades.js";
import { closeTrade } from "./tradeClose.js";
import { syncSignalToTrade } from "./tradeSync.js";
import { enforceRateLimit, getRequestId, getRequestIp } from "./security/rateLimit.js";
export { closeTradeFromWebhook } from "./webhooks/closeTradeFromWebhook.js";

initializeApp();

const signalSecret = defineSecret("SIGNAL_INGEST_SECRET");
const REQUEST_RATE_LIMIT_WINDOW_MS = Number(process.env.REQUEST_RATE_LIMIT_WINDOW_MS ?? 60 * 1000);
const SIGNAL_INGEST_RATE_LIMIT_MAX = Number(process.env.SIGNAL_INGEST_RATE_LIMIT_MAX ?? 180);
const CLOSE_TRADE_TEST_RATE_LIMIT_MAX = Number(process.env.CLOSE_TRADE_TEST_RATE_LIMIT_MAX ?? 60);

export const ingestSignal = onRequest(
  {
    cors: false,
    secrets: [signalSecret],
  },
  async (request, response) => {
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
    await runAutoCloseTrades(getFirestore());
  }
);

export const closeTradeForTest = onRequest(
  {
    cors: false,
    secrets: [signalSecret],
  },
  async (request, response) => {
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
  "signals/{signalId}",
  async (event) => {
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
  "signals/{signalId}",
  async (event) => {
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

export {
  createCheckoutSession,
  createBillingPortalSession,
  stripeWebhook,
} from "./billing";
export { saveAutomationSettings } from "./automation.js";
export { deliverSignalToSubscribers } from "./triggers/deliverSignalToSubscribers";
export { retryPendingWebhooks } from "./jobs/retryPendingWebhooks";
export { executePaperTradeFromTrade } from "./execution/index.js";
export {
  runAdminPaperExecutionTest,
  saveAlpacaPaperAutomationSettings,
  testAlpacaConnection,
} from "./execution/admin.js";
export { reconcileAlpacaPaperExecutions } from "./execution/reconcile.js";
