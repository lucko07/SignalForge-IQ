import type { User } from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

export const userRoles = ["user", "admin"] as const;
export type UserRole = (typeof userRoles)[number];

export const userPlans = ["free", "pro", "admin"] as const;
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

export const normalizeEmail = (value: string) => value.trim().toLowerCase();

export const normalizeUserRole = (value: unknown): UserRole => (
  value === "admin" ? "admin" : "user"
);

export const normalizeUserPlan = (value: unknown): UserPlan => {
  if (value === "admin") {
    return "admin";
  }

  if (value === "pro" || value === "elite") {
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

const hasLegacySubscriptionAccess = (data: Record<string, unknown>) => {
  const role = normalizeUserRole(data.role);
  const plan = normalizeUserPlan(data.plan);
  const currentPlan = normalizeManagedPlan(data.currentPlan ?? data.plan);
  const billingStatus =
    typeof data.billingStatus === "string" ? data.billingStatus.trim().toLowerCase() : "";

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
    billingStatus:
      typeof normalizedData.billingStatus === "string"
        ? normalizedData.billingStatus.trim().toLowerCase()
        : undefined,
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

const buildDefaultProfilePayload = (user: User) => ({
  email: normalizeEmail(user.email ?? ""),
  role: "user" as const,
  plan: "free" as const,
  subscriptionActive: false,
  phoneVerified: Boolean(user.phoneNumber),
  approved: true,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

export const getUserProfile = async (uid: string) => {
  const snapshot = await getDoc(doc(db, "users", uid));

  if (!snapshot.exists()) {
    return null;
  }

  return mapUserProfileDocument(snapshot.id, snapshot.data());
};

export const getOrCreateUserProfile = async (user: User) => {
  const userReference = doc(db, "users", user.uid);
  const snapshot = await getDoc(userReference);
  const normalizedEmail = normalizeEmail(user.email ?? "");
  const nextPhoneVerified = Boolean(user.phoneNumber);

  if (!snapshot.exists()) {
    const defaultProfile = buildDefaultProfilePayload(user);

    await setDoc(userReference, defaultProfile);

    return mapUserProfileDocument(user.uid, {
      ...defaultProfile,
      email: normalizedEmail,
      phoneVerified: nextPhoneVerified,
    });
  }

  const existingProfile = mapUserProfileDocument(snapshot.id, snapshot.data());
  const updates: Record<string, unknown> = {};

  // Keep Firestore metadata aligned with Firebase Auth without allowing the client
  // to mutate role or plan fields directly.
  if (normalizedEmail && existingProfile.email !== normalizedEmail) {
    updates.email = normalizedEmail;
  }

  if (nextPhoneVerified && !existingProfile.phoneVerified) {
    updates.phoneVerified = true;
  }

  if (snapshot.data().approved === undefined) {
    updates.approved = true;
  }

  if (snapshot.data().createdAt === undefined) {
    updates.createdAt = serverTimestamp();
  }

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = serverTimestamp();
    await updateDoc(userReference, updates);
  }

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

  return profile.role === "admin" || profile.plan === "admin" || profile.subscriptionActive;
};

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
  await setDoc(
    doc(db, "users", uid),
    {
      termsAccepted: true,
      termsAcceptedAt: serverTimestamp(),
      termsVersion,
      privacyAccepted: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
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

  return profile.role !== "admin" && profile.currentPlan !== "free";
};
