import { FieldValue, Timestamp, getFirestore, type DocumentData, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { sendWebhookDelivery, type WebhookDeliveryRecord } from "../services/webhookDelivery.js";

const WEBHOOK_DELIVERIES_COLLECTION = "webhookDeliveries";
const USERS_COLLECTION = "users";
const DEFAULT_WEBHOOK_ID = "default";
const MAX_RECORDS_PER_STATUS = 200;

type RetryableDeliveryDocument = WebhookDeliveryRecord & {
  nextRetryAt?: Timestamp | Date | string | number | null;
};

const toComparableMillis = (value: unknown) => {
  if (value instanceof Timestamp) {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.getTime();
  }

  if (
    typeof value === "object"
    && value !== null
    && "toMillis" in value
    && typeof value.toMillis === "function"
  ) {
    return value.toMillis();
  }

  if (
    typeof value === "object"
    && value !== null
    && "toDate" in value
    && typeof value.toDate === "function"
  ) {
    const convertedValue = value.toDate();
    return convertedValue instanceof Date ? convertedValue.getTime() : null;
  }

  return null;
};

const getScheduledRetryTime = (delivery: RetryableDeliveryDocument) => (
  toComparableMillis(delivery.nextRetryAt) ?? toComparableMillis(delivery.nextAttemptAt)
);

const isDueForDelivery = (delivery: RetryableDeliveryDocument, nowMillis: number) => {
  const status = delivery.status;
  const scheduledTime = getScheduledRetryTime(delivery);

  if (status === "pending") {
    return scheduledTime === null || scheduledTime <= nowMillis;
  }

  if (status === "retry_scheduled") {
    return scheduledTime !== null && scheduledTime <= nowMillis;
  }

  return false;
};

const markDeliveryFailed = async (
  document: QueryDocumentSnapshot<DocumentData>,
  reason: string
) => {
  await document.ref.set({
    status: "failed",
    lastErrorAt: FieldValue.serverTimestamp(),
    lastErrorCode: "invalid_delivery_record",
    lastErrorMessage: reason,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
};

const processDeliveryDocument = async (
  document: QueryDocumentSnapshot<DocumentData>
) => {
  const delivery = document.data() as RetryableDeliveryDocument;

  if (delivery.payload === undefined) {
    await markDeliveryFailed(document, "Webhook delivery record is missing payload.");
    logger.error("Retry job found delivery record without payload.", {
      deliveryId: document.id,
      signalId: delivery.signalId ?? null,
      subscriberId: delivery.subscriberId ?? null,
    });
    return false;
  }

  const subscriberId = typeof delivery.subscriberId === "string"
    ? delivery.subscriberId.trim()
    : "";

  if (!subscriberId) {
    await markDeliveryFailed(document, "Webhook delivery record is missing subscriberId.");
    logger.error("Retry job found delivery record without subscriberId.", {
      deliveryId: document.id,
      signalId: delivery.signalId ?? null,
    });
    return false;
  }

  const db = getFirestore();
  const webhookSnapshot = await db
    .collection(USERS_COLLECTION)
    .doc(subscriberId)
    .collection("webhooks")
    .doc(DEFAULT_WEBHOOK_ID)
    .get();

  if (!webhookSnapshot.exists) {
    await markDeliveryFailed(document, "Webhook delivery retry could not find subscriber webhook config.");
    logger.error("Retry job could not find subscriber webhook config.", {
      deliveryId: document.id,
      signalId: delivery.signalId ?? null,
      subscriberId,
    });
    return false;
  }

  const signingSecret = typeof webhookSnapshot.get("secret") === "string"
    ? webhookSnapshot.get("secret").trim()
    : "";

  if (!signingSecret) {
    await markDeliveryFailed(document, "Webhook delivery retry could not resolve signing secret.");
    logger.error("Retry job could not resolve subscriber webhook secret.", {
      deliveryId: document.id,
      signalId: delivery.signalId ?? null,
      subscriberId,
    });
    return false;
  }

  await sendWebhookDelivery({
    deliveryReference: document.ref,
    delivery,
    payload: delivery.payload,
    signingSecret,
  });

  return true;
};

export const retryPendingWebhooks = onSchedule(
  {
    schedule: "* * * * *",
  },
  async () => {
    const db = getFirestore();
    const nowMillis = Date.now();
    const [pendingSnapshot, retrySnapshot] = await Promise.all([
      db
        .collection(WEBHOOK_DELIVERIES_COLLECTION)
        .where("status", "==", "pending")
        .limit(MAX_RECORDS_PER_STATUS)
        .get(),
      db
        .collection(WEBHOOK_DELIVERIES_COLLECTION)
        .where("status", "==", "retry_scheduled")
        .limit(MAX_RECORDS_PER_STATUS)
        .get(),
    ]);

    const dueDocuments = [...pendingSnapshot.docs, ...retrySnapshot.docs]
      .filter((document) => isDueForDelivery(document.data() as RetryableDeliveryDocument, nowMillis));

    if (dueDocuments.length === 0) {
      logger.info("Webhook retry job found no due deliveries.");
      return;
    }

    const results = await Promise.allSettled(
      dueDocuments.map((document) => processDeliveryDocument(document))
    );

    const processedCount = results.filter(
      (result) => result.status === "fulfilled" && result.value === true
    ).length;
    const invalidRecordCount = results.filter(
      (result) => result.status === "fulfilled" && result.value === false
    ).length;
    const unexpectedErrorCount = results.filter((result) => result.status === "rejected").length;

    logger.info("Webhook retry job processed due deliveries.", {
      dueCount: dueDocuments.length,
      processedCount,
      invalidRecordCount,
      unexpectedErrorCount,
      pendingScanned: pendingSnapshot.size,
      retryScheduledScanned: retrySnapshot.size,
    });
  }
);
