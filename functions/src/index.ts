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
export { closeTradeFromWebhook } from "./webhooks/closeTradeFromWebhook.js";

initializeApp();

const signalSecret = defineSecret("SIGNAL_INGEST_SECRET");

export const ingestSignal = onRequest(
  {
    cors: false,
    secrets: [signalSecret],
  },
  async (request, response) => {
    logger.info("Signal ingestion request received.", {
      method: request.method,
      ip: request.ip,
    });

    if (request.method !== "POST") {
      response.status(405).json({ error: "Method not allowed. Use POST." });
      return;
    }

    const providedSecret = request.header("x-signal-secret")
      ?? request.body?.secret
      ?? request.body?.signalSecret;
    const expectedSecret = signalSecret.value();

    if (!providedSecret || providedSecret !== expectedSecret) {
      logger.warn("Unauthorized signal ingestion attempt.");
      response.status(401).json({ error: "Unauthorized." });
      return;
    }

    const validation = validateSignalPayload(request.body);

    if (!validation.valid) {
      logger.warn("Signal payload validation failed.", {
        errors: validation.errors,
      });
      response.status(400).json({
        error: "Invalid signal payload.",
        details: validation.errors,
      });
      return;
    }

    try {
      const result = await saveSignalToFirestore(request.body);

      logger.info("Signal saved successfully.", result);
      response.status(200).json({
        ok: true,
        id: result.id,
        collection: result.collectionName,
      });
    } catch (error) {
      logger.error("Signal ingestion failed.", error);
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
    logger.info("Trade close test request received.", {
      method: request.method,
      ip: request.ip,
    });

    if (request.method !== "POST") {
      response.status(405).json({ error: "Method not allowed. Use POST." });
      return;
    }

    const providedSecret = request.header("x-signal-secret")
      ?? request.body?.secret
      ?? request.body?.signalSecret;
    const expectedSecret = signalSecret.value();

    if (!providedSecret || providedSecret !== expectedSecret) {
      logger.warn("Unauthorized trade close test attempt.");
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
      logger.error("Trade close test request failed.", error);
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
export { deliverSignalToSubscribers } from "./triggers/deliverSignalToSubscribers";
export { retryPendingWebhooks } from "./jobs/retryPendingWebhooks";
