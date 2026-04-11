import type { User } from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

export const userRoles = ["user", "admin"] as const;
export type UserRole = (typeof userRoles)[number];

export const userPlans = ["free", "pro", "elite", "admin"] as const;
export type UserPlan = (typeof userPlans)[number];

export const managedPlans = ["free", "pro", "elite", "admin"] as const;
export type ManagedPlan = (typeof managedPlans)[number];

export type UserProfile = {
  uid: string;
  email: string;
  role: UserRole;
  plan: UserPlan;
  subscriptionActive: boolean;
  phoneVerified: boolean;
  approved: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
  currentPlan?: ManagedPlan;
  billingStatus?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  cancelAtPeriodEnd?: boolean;
  subscriptionEndsAt?: Timestamp | null;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  termsVersion?: string;
  termsAcceptedAt?: Timestamp | null;
};

export const CURRENT_TERMS_VERSION = "v1.0";

type CreateProfileOptions = {
  acceptLegal?: boolean;
  termsVersion?: string;
};

export const normalizeEmail = (value: string) => value.trim().toLowerCase();

export const normalizeUserRole = (value: unknown): UserRole => (
  value === "admin" ? "admin" : "user"
);

export const normalizeUserPlan = (value: unknown): UserPlan => {
  if (value === "admin") {
    return "admin";
  }

  if (value === "elite") {
    return "elite";
  }

  if (value === "pro") {
    return "pro";
  }

  return "free";
};

export const normalizeManagedPlan = (value: unknown): ManagedPlan => {
  if (value === "admin") {
    return "admin";
  }

  if (value === "elite") {
    return "elite";
  }

  if (value === "pro") {
    return "pro";
  }

  return "free";
};

export const normalizeBillingStatus = (value: unknown) => (
  typeof value === "string" && value.trim() ? value.trim().toLowerCase() : undefined
);

const activeBillingStatuses = ["active", "trialing", "past_due"] as const;

export const getEffectiveManagedPlan = (profile: UserProfile | null) => (
  normalizeManagedPlan(profile?.currentPlan ?? profile?.plan)
);

export const isAdminProfile = (profile: UserProfile | null) => (
  profile?.role === "admin" || profile?.plan === "admin" || profile?.currentPlan === "admin"
);

const hasLegacySubscriptionAccess = (data: Record<string, unknown>) => {
  const role = normalizeUserRole(data.role);
  const plan = normalizeUserPlan(data.plan);
  const currentPlan = normalizeManagedPlan(data.currentPlan ?? data.plan);
  const billingStatus =
    normalizeBillingStatus(data.billingStatus) ?? "";

  if (role === "admin" || plan === "admin") {
    return true;
  }

  if (typeof data.subscriptionActive === "boolean") {
    return data.subscriptionActive;
  }

  if (currentPlan === "pro" || currentPlan === "elite" || plan === "pro") {
    return billingStatus
      ? ["active", "trialing", "past_due"].includes(billingStatus)
      : true;
  }

  if (plan === "elite") {
    return billingStatus
      ? ["active", "trialing", "past_due"].includes(billingStatus)
      : true;
  }

  return false;
};

export const mapUserProfileDocument = (
  uid: string,
  data: Record<string, unknown> | undefined
): UserProfile => {
  const normalizedData = data ?? {};
  const role = normalizeUserRole(normalizedData.role);
  const plan = role === "admin" ? "admin" : normalizeUserPlan(normalizedData.plan);

  return {
    uid,
    email: typeof normalizedData.email === "string" ? normalizeEmail(normalizedData.email) : "",
    role,
    plan,
    subscriptionActive: hasLegacySubscriptionAccess(normalizedData),
    phoneVerified: normalizedData.phoneVerified === true,
    approved: normalizedData.approved !== false,
    createdAt: normalizedData.createdAt,
    updatedAt: normalizedData.updatedAt,
    currentPlan: normalizeManagedPlan(normalizedData.currentPlan ?? normalizedData.plan),
    billingStatus: normalizeBillingStatus(normalizedData.billingStatus),
    stripeCustomerId:
      typeof normalizedData.stripeCustomerId === "string"
        ? normalizedData.stripeCustomerId
        : undefined,
    stripeSubscriptionId:
      typeof normalizedData.stripeSubscriptionId === "string"
        ? normalizedData.stripeSubscriptionId
        : undefined,
    cancelAtPeriodEnd: normalizedData.cancelAtPeriodEnd === true,
    subscriptionEndsAt:
      normalizedData.subscriptionEndsAt instanceof Timestamp
        ? normalizedData.subscriptionEndsAt
        : null,
    termsAccepted: normalizedData.termsAccepted === true,
    privacyAccepted: normalizedData.privacyAccepted === true,
    termsVersion:
      typeof normalizedData.termsVersion === "string" && normalizedData.termsVersion.trim()
        ? normalizedData.termsVersion.trim()
        : undefined,
    termsAcceptedAt:
      normalizedData.termsAcceptedAt instanceof Timestamp
        ? normalizedData.termsAcceptedAt
        : null,
  };
};

const buildDefaultProfilePayload = (
  user: User,
  options?: CreateProfileOptions
) => {
  const payload: Record<string, unknown> = {
    email: normalizeEmail(user.email ?? ""),
    role: "user" as const,
    plan: "free" as const,
    subscriptionActive: false,
    phoneVerified: Boolean(user.phoneNumber),
    approved: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (options?.acceptLegal) {
    payload.termsAccepted = true;
    payload.privacyAccepted = true;
    payload.termsVersion = options.termsVersion ?? CURRENT_TERMS_VERSION;
    payload.termsAcceptedAt = serverTimestamp();
  }

  return payload;
};

const buildProfileRepairPayload = (
  existingData: Record<string, unknown> | undefined,
  user: User,
  options?: CreateProfileOptions
) => {
  const updates: Record<string, unknown> = {};
  const normalizedEmail = normalizeEmail(user.email ?? "");
  const nextPhoneVerified = Boolean(user.phoneNumber);
  const currentTermsVersion = options?.termsVersion ?? CURRENT_TERMS_VERSION;

  if (normalizedEmail && existingData?.email !== normalizedEmail) {
    updates.email = normalizedEmail;
  }

  if (existingData?.phoneVerified !== nextPhoneVerified) {
    updates.phoneVerified = nextPhoneVerified;
  }

  if (existingData?.approved === undefined) {
    updates.approved = true;
  }

  if (options?.acceptLegal) {
    if (existingData?.termsAccepted !== true) {
      updates.termsAccepted = true;
    }

    if (existingData?.privacyAccepted !== true) {
      updates.privacyAccepted = true;
    }

    if (existingData?.termsVersion !== currentTermsVersion) {
      updates.termsVersion = currentTermsVersion;
    }

    if (!(existingData?.termsAcceptedAt instanceof Timestamp)) {
      updates.termsAcceptedAt = serverTimestamp();
    }
  }

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = serverTimestamp();
  }

  return updates;
};

export const getUserProfile = async (uid: string) => {
  let snapshot;

  try {
    snapshot = await getDoc(doc(db, "users", uid));
  } catch (error) {
    throw error;
  }

  if (!snapshot.exists()) {
    return null;
  }

  return mapUserProfileDocument(snapshot.id, snapshot.data());
};

export const getOrCreateUserProfile = async (
  user: User,
  options?: CreateProfileOptions
) => {
  const userReference = doc(db, "users", user.uid);

  let snapshot;

  try {
    snapshot = await getDoc(userReference);
  } catch (error) {
    throw error;
  }
  const normalizedEmail = normalizeEmail(user.email ?? "");
  const nextPhoneVerified = Boolean(user.phoneNumber);

  if (!snapshot.exists()) {
    const defaultProfile = buildDefaultProfilePayload(user, options);

    try {
      await setDoc(userReference, defaultProfile);
    } catch (error) {
      throw error;
    }

    return mapUserProfileDocument(user.uid, {
      ...defaultProfile,
      email: normalizedEmail,
      phoneVerified: nextPhoneVerified,
    });
  }

  const existingData = snapshot.data();
  const repairPayload = buildProfileRepairPayload(existingData, user, options);

  if (Object.keys(repairPayload).length > 0) {
    await setDoc(userReference, repairPayload, { merge: true });
  }

  const existingProfile = mapUserProfileDocument(snapshot.id, {
    ...existingData,
    ...repairPayload,
    email: normalizedEmail || existingData.email,
    phoneVerified: nextPhoneVerified,
  });

  return {
    ...existingProfile,
    email: normalizedEmail || existingProfile.email,
    phoneVerified: existingProfile.phoneVerified || nextPhoneVerified,
    approved: existingProfile.approved,
  };
};

export const hasSubscriptionAccess = (profile: UserProfile | null) => {
  if (!profile) {
    return false;
  }

  if (isAdminProfile(profile)) {
    return true;
  }

  if (profile.approved === false) {
    return false;
  }

  if (profile.subscriptionActive !== true) {
    return false;
  }

  const currentPlan = getEffectiveManagedPlan(profile);

  if (currentPlan !== "pro" && currentPlan !== "elite") {
    return false;
  }

  const billingStatus = normalizeBillingStatus(profile.billingStatus);

  if (!billingStatus) {
    return true;
  }

  if (activeBillingStatuses.includes(billingStatus as (typeof activeBillingStatuses)[number])) {
    return true;
  }

  if (profile.cancelAtPeriodEnd === true && profile.subscriptionEndsAt instanceof Timestamp) {
    return profile.subscriptionEndsAt.toMillis() > Date.now();
  }

  return false;
};

export const hasProAccess = (profile: UserProfile | null) => (
  hasSubscriptionAccess(profile)
);

export const hasEliteAccess = (profile: UserProfile | null) => {
  if (!hasSubscriptionAccess(profile)) {
    return false;
  }

  return getEffectiveManagedPlan(profile) === "elite" || isAdminProfile(profile);
};

export const canUseAutomation = (profile: UserProfile | null) => (
  hasEliteAccess(profile)
);

export const hasAcceptedLegal = (profile: UserProfile | null) => {
  if (!profile) {
    return false;
  }

  return (
    profile.termsAccepted
    && profile.privacyAccepted
    && profile.termsVersion === CURRENT_TERMS_VERSION
  );
};

export const acceptLegalDocuments = async (
  uid: string,
  termsVersion = CURRENT_TERMS_VERSION
) => {
  const payload = {
    termsAccepted: true,
    termsAcceptedAt: serverTimestamp(),
    termsVersion,
    privacyAccepted: true,
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(
      doc(db, "users", uid),
      payload,
      { merge: true }
    );
  } catch (error) {
    throw error;
  }
};

export const getUserLegalConsentStatus = async (uid: string) => {
  const profile = await getUserProfile(uid);

  return {
    profile,
    hasAcceptedCurrentTerms: hasAcceptedLegal(profile),
  };
};

export const isStripeManagedUser = (profile: UserProfile | null) => {
  if (!profile) {
    return false;
  }

  return !isAdminProfile(profile) && getEffectiveManagedPlan(profile) !== "free";
};
