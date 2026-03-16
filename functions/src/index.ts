import { initializeApp } from "firebase-admin/app";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  saveSignalToFirestore,
  validateSignalPayload,
} from "./signalIngestion.js";

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

export {
  createCheckoutSession,
  createBillingPortalSession,
  stripeWebhook,
} from "./billing";