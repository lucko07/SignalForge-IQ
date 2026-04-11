import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getEffectiveManagedPlan, isAutomationDeliveryEligible } from "../access.js";
import { buildSignalWebhookPayload } from "../services/payloadBuilder.js";
import { sendWebhookDelivery, type WebhookDeliveryRecord } from "../services/webhookDelivery.js";

const USERS_COLLECTION = "users";
const WEBHOOK_DELIVERIES_COLLECTION = "webhookDeliveries";
const DEFAULT_WEBHOOK_ID = "default";

type ManagedPlan = "free" | "pro" | "elite" | "admin";

type SignalDocument = {
  symbol?: string;
  assetType?: string;
  direction?: string;
  entry?: string;
  stopLoss?: string;
  target?: string;
  thesis?: string;
  status?: string;
  source?: string;
  timeframe?: string;
  confidence?: string;
  strategyName?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  reviewStatus?: string;
  notes?: string;
  tags?: unknown;
  checklist?: unknown;
  analyst?: string;
  riskRewardRatio?: string | number;
  marketContext?: string;
  invalidationReason?: string;
};

type UserWebhookEndpoint = {
  url?: string;
  secret?: string;
  delaySeconds?: number | string;
  enabled?: boolean;
  assetFilters?: unknown;
};

type UserProfile = {
  subscriptionActive?: boolean;
  approved?: boolean;
  webhookEnabled?: boolean;
  status?: string;
  role?: string;
  plan?: string;
  currentPlan?: string;
  billingStatus?: string;
  cancelAtPeriodEnd?: boolean;
  subscriptionEndsAt?: Timestamp | null;
  termsAccepted?: boolean;
  privacyAccepted?: boolean;
  termsVersion?: string;
};

const toTrimmedText = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue || null;
};

const normalizeDelaySeconds = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }

  if (typeof value === "string") {
    const parsedValue = Number(value.trim());
    return Number.isFinite(parsedValue) && parsedValue >= 0 ? Math.floor(parsedValue) : 0;
  }

  return 0;
};

const normalizeStringList = (value: unknown) => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalizedItems = value
    .map((item) => toTrimmedText(item))
    .filter((item): item is string => item !== null);

  return normalizedItems.length > 0 ? normalizedItems : undefined;
};

const normalizeTimestampString = (value: unknown) => {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();
    return trimmedValue || undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  if (
    typeof value === "object"
    && value !== null
    && "toDate" in value
    && typeof value.toDate === "function"
  ) {
    const convertedValue = value.toDate();
    return convertedValue instanceof Date ? convertedValue.toISOString() : undefined;
  }

  return undefined;
};

const normalizeEndpoint = (
  endpoint: UserWebhookEndpoint,
  fallbackPlan: ManagedPlan
) => {
  const destinationUrl = toTrimmedText(endpoint.url);
  const signingSecret = toTrimmedText(endpoint.secret);
  const enabled = endpoint.enabled === true;
  const plan = fallbackPlan;
  const delaySeconds = normalizeDelaySeconds(endpoint.delaySeconds);
  const assetFilters = normalizeStringList(endpoint.assetFilters);

  if (!destinationUrl || !signingSecret || !enabled) {
    return null;
  }

  return {
    destinationUrl,
    signingSecret,
    plan,
    delaySeconds,
    assetFilters,
  };
};

const buildSignalInput = (signalId: string, signal: SignalDocument) => ({
  signalId,
  symbol: toTrimmedText(signal.symbol) ?? "",
  assetType: toTrimmedText(signal.assetType) ?? "",
  direction: toTrimmedText(signal.direction) ?? "LONG",
  entry: toTrimmedText(signal.entry) ?? "",
  stopLoss: toTrimmedText(signal.stopLoss) ?? "",
  target: toTrimmedText(signal.target) ?? "",
  thesis: toTrimmedText(signal.thesis) ?? "",
  status: toTrimmedText(signal.status) ?? "ACTIVE",
  source: toTrimmedText(signal.source) ?? "signalforge",
  timeframe: toTrimmedText(signal.timeframe) ?? undefined,
  confidence: toTrimmedText(signal.confidence) ?? undefined,
  strategyName: toTrimmedText(signal.strategyName) ?? undefined,
  createdAt: normalizeTimestampString(signal.createdAt),
  updatedAt: normalizeTimestampString(signal.updatedAt),
  reviewStatus: toTrimmedText(signal.reviewStatus) ?? undefined,
  notes: toTrimmedText(signal.notes) ?? undefined,
  tags: normalizeStringList(signal.tags),
  checklist: normalizeStringList(signal.checklist),
  analyst: toTrimmedText(signal.analyst) ?? undefined,
  riskRewardRatio: signal.riskRewardRatio ?? undefined,
  marketContext: toTrimmedText(signal.marketContext) ?? undefined,
  invalidationReason: toTrimmedText(signal.invalidationReason) ?? undefined,
});

export const deliverSignalToSubscribers = onDocumentCreated(
  "signals/{signalId}",
  async (event) => {
    const snapshot = event.data;
    const signalId = event.params.signalId;

    logger.info("deliverSignalToSubscribers trigger started.", {
      signalId,
      path: `signals/${signalId}`,
    });

    if (!snapshot) {
      logger.warn("Signal delivery trigger fired without document data.", {
        signalId,
      });
      return;
    }

    const signal = snapshot.data() as SignalDocument;
    const normalizedSignal = buildSignalInput(signalId, signal);
    const normalizedSymbol = normalizedSignal.symbol.toUpperCase();
    logger.info("Signal data loaded for subscriber delivery.", {
      signalId,
      symbol: normalizedSignal.symbol,
      assetType: normalizedSignal.assetType,
      status: normalizedSignal.status,
      strategyName: normalizedSignal.strategyName ?? null,
    });

    const db = getFirestore();
    const usersSnapshot = await db
      .collection(USERS_COLLECTION)
      .where("webhookEnabled", "==", true)
      .get();
    logger.info("User query completed for subscriber delivery.", {
      signalId,
      usersMatchedByQuery: usersSnapshot.size,
      query: "webhookEnabled == true",
    });

    const immediateDeliveries: Array<{
      referencePath: string;
      payload: unknown;
      signingSecret: string;
    }> = [];
    let createdDeliveryCount = 0;

    for (const userDocument of usersSnapshot.docs) {
      const profile = userDocument.data() as UserProfile;
      const normalizedPlan = getEffectiveManagedPlan(profile);
      const normalizedStatus = toTrimmedText(profile.status)?.toLowerCase() ?? null;

      logger.info("Evaluating user for signal delivery.", {
        signalId,
        userId: userDocument.id,
        plan: normalizedPlan,
        approved: profile.approved ?? null,
        subscriptionActive: profile.subscriptionActive ?? null,
        webhookEnabled: profile.webhookEnabled ?? null,
        status: normalizedStatus,
      });

      if (!isAutomationDeliveryEligible(profile)) {
        logger.warn("User skipped before webhook lookup because profile gates did not pass.", {
          signalId,
          userId: userDocument.id,
          plan: normalizedPlan,
          approved: profile.approved ?? null,
          billingStatus: profile.billingStatus ?? null,
          cancelAtPeriodEnd: profile.cancelAtPeriodEnd ?? null,
          webhookEnabled: profile.webhookEnabled ?? null,
          status: normalizedStatus,
        });
        continue;
      }

      logger.info("User passed profile gating checks.", {
        signalId,
        userId: userDocument.id,
        plan: normalizedPlan,
      });

      const webhookReference = userDocument.ref
        .collection("webhooks")
        .doc(DEFAULT_WEBHOOK_ID);
      const webhookSnapshot = await webhookReference.get();

      logger.info("Webhook config lookup completed.", {
        signalId,
        userId: userDocument.id,
        webhookPath: webhookReference.path,
        exists: webhookSnapshot.exists,
      });

      if (!webhookSnapshot.exists) {
        logger.warn("User skipped because default webhook config does not exist.", {
          signalId,
          userId: userDocument.id,
          webhookPath: webhookReference.path,
        });
        continue;
      }

      const endpoint = normalizeEndpoint(
        webhookSnapshot.data() as UserWebhookEndpoint,
        normalizedPlan
      );

      logger.info("Webhook config fields evaluated.", {
        signalId,
        userId: userDocument.id,
        webhookPath: webhookReference.path,
        enabled: webhookSnapshot.get("enabled") ?? null,
        hasUrl: Boolean(toTrimmedText(webhookSnapshot.get("url"))),
        hasSecret: Boolean(toTrimmedText(webhookSnapshot.get("secret"))),
        delaySeconds: normalizeDelaySeconds(webhookSnapshot.get("delaySeconds")),
      });

      if (!endpoint) {
        logger.warn("User skipped because webhook config is incomplete or disabled.", {
          signalId,
          userId: userDocument.id,
          webhookPath: webhookReference.path,
        });
        continue;
      }

      if (endpoint.plan === "free") {
        logger.warn("User skipped because normalized plan does not qualify for delivery.", {
          signalId,
          userId: userDocument.id,
          plan: endpoint.plan,
        });
        continue;
      }

      const normalizedAssetFilters = endpoint.assetFilters?.map((value) => value.toUpperCase()) ?? [];
      const symbolMatchesFilter = normalizedAssetFilters.length === 0
        || normalizedAssetFilters.includes(normalizedSymbol);

      logger.info("Webhook asset filters evaluated.", {
        signalId,
        userId: userDocument.id,
        webhookPath: webhookReference.path,
        assetFilters: endpoint.assetFilters ?? [],
        normalizedAssetFilters,
        signalSymbol: normalizedSymbol,
        symbolMatchesFilter,
      });

      if (!symbolMatchesFilter) {
        logger.warn("User skipped because signal symbol did not match webhook asset filters.", {
          signalId,
          userId: userDocument.id,
          signalSymbol: normalizedSymbol,
          normalizedAssetFilters,
        });
        continue;
      }

      const payload = buildSignalWebhookPayload(normalizedSignal, endpoint.plan);
      const deliveryReference = db.collection(WEBHOOK_DELIVERIES_COLLECTION).doc();
      const nextAttemptAt = endpoint.delaySeconds > 0
        ? Timestamp.fromMillis(Date.now() + endpoint.delaySeconds * 1_000)
        : null;

      await deliveryReference.set({
        signalId,
        subscriberId: userDocument.id,
        userId: userDocument.id,
        destinationUrl: endpoint.destinationUrl,
        plan: endpoint.plan,
        delaySeconds: endpoint.delaySeconds,
        payload,
        status: "pending",
        attemptCount: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        queuedAt: FieldValue.serverTimestamp(),
        nextRetryAt: nextAttemptAt,
        nextAttemptAt,
      });

      createdDeliveryCount += 1;
      logger.info("Delivery document created for subscriber.", {
        signalId,
        userId: userDocument.id,
        deliveryId: deliveryReference.id,
        delaySeconds: endpoint.delaySeconds,
        plan: endpoint.plan,
      });

      if (endpoint.delaySeconds === 0) {
        immediateDeliveries.push({
          referencePath: deliveryReference.path,
          payload,
          signingSecret: endpoint.signingSecret,
        });
      }
    }

    if (immediateDeliveries.length > 0) {
      await Promise.all(
        immediateDeliveries.map(async (delivery) => {
          const deliveryReference = db.doc(delivery.referencePath);
          const deliverySnapshot = await deliveryReference.get();

          if (!deliverySnapshot.exists) {
            logger.warn("Immediate delivery skipped because delivery document was missing.", {
              signalId,
              deliveryPath: delivery.referencePath,
            });
            return;
          }

          logger.info("Attempting immediate webhook send.", {
            signalId,
            deliveryId: deliveryReference.id,
            deliveryPath: delivery.referencePath,
          });

          await sendWebhookDelivery({
            deliveryReference,
            delivery: deliverySnapshot.data() as WebhookDeliveryRecord,
            payload: delivery.payload,
            signingSecret: delivery.signingSecret,
          });
        })
      );
    }

    logger.info("Signal subscriber delivery records created.", {
      signalId,
      createdDeliveryCount,
      immediateDeliveryCount: immediateDeliveries.length,
    });
  }
);
