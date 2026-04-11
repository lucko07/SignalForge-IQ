import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { canUseAutomation } from "./access.js";

type AutomationProfile = {
  role?: string;
  plan?: string;
  currentPlan?: string;
  subscriptionActive?: boolean;
  billingStatus?: string;
  approved?: boolean;
  cancelAtPeriodEnd?: boolean;
  subscriptionEndsAt?: null;
  termsAccepted?: boolean;
  privacyAccepted?: boolean;
  termsVersion?: string;
};

const DEFAULT_WEBHOOK_ID = "default";

const normalizeUrl = (value: unknown) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

const normalizeSecret = (value: unknown) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

const normalizeAssetFilters = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  const normalizedFilters = value
    .map((item) => (typeof item === "string" ? item.trim().toUpperCase() : ""))
    .filter((item) => item !== "");

  return [...new Set(normalizedFilters)];
};

export const saveAutomationSettings = onCall({}, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "You must be signed in to manage automation.");
  }

  const automationEnabled = request.data?.automationEnabled === true;
  const destinationUrl = normalizeUrl(request.data?.destinationUrl);
  const verificationSecret = normalizeSecret(request.data?.verificationSecret);
  const assetFilters = normalizeAssetFilters(request.data?.assetFilters);

  if (automationEnabled && !destinationUrl) {
    throw new HttpsError("invalid-argument", "A destination URL is required to enable automation.");
  }

  if (automationEnabled && !verificationSecret) {
    throw new HttpsError("invalid-argument", "A verification secret is required to enable automation.");
  }

  if (assetFilters.length > 100) {
    throw new HttpsError("invalid-argument", "Asset filters cannot exceed 100 symbols.");
  }

  const db = getFirestore();
  const userReference = db.collection("users").doc(request.auth.uid);
  const profileSnapshot = await userReference.get();

  if (!profileSnapshot.exists) {
    throw new HttpsError("not-found", "User profile not found.");
  }

  const profile = profileSnapshot.data() as AutomationProfile;

  if (!canUseAutomation(profile)) {
    throw new HttpsError(
      "permission-denied",
      "Your account does not have access to automation settings."
    );
  }

  const webhookReference = userReference.collection("webhooks").doc(DEFAULT_WEBHOOK_ID);

  await Promise.all([
    userReference.set({
      webhookEnabled: automationEnabled,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true }),
    webhookReference.set({
      enabled: automationEnabled,
      url: destinationUrl,
      secret: verificationSecret,
      assetFilters,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true }),
  ]);

  return {
    ok: true,
    automationEnabled,
    hasDestinationUrl: destinationUrl.length > 0,
    hasVerificationSecret: verificationSecret.length > 0,
    assetFilterCount: assetFilters.length,
  };
});
