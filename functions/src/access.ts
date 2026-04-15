import type { Timestamp } from "firebase-admin/firestore";
import { CURRENT_TERMS_VERSION } from "./legal.js";

export type ManagedPlan = "free" | "pro" | "elite" | "admin";
export type UserRole = "user" | "admin";

export type AccessProfile = {
  role?: string;
  plan?: string;
  currentPlan?: string;
  subscriptionActive?: boolean;
  billingStatus?: string;
  approved?: boolean;
  cancelAtPeriodEnd?: boolean;
  subscriptionEndsAt?: Timestamp | Date | { toDate: () => Date } | null;
  termsAccepted?: boolean;
  privacyAccepted?: boolean;
  termsVersion?: string;
  webhookEnabled?: boolean;
  status?: string;
};

const ACTIVE_BILLING_STATUSES = new Set(["active", "trialing", "past_due"]);

export const normalizeUserRole = (value: unknown): UserRole => (
  value === "admin" ? "admin" : "user"
);

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

export const getEffectiveManagedPlan = (profile: AccessProfile | null | undefined): ManagedPlan => (
  normalizeManagedPlan(profile?.currentPlan ?? profile?.plan)
);

export const isAdminProfile = (profile: AccessProfile | null | undefined) => (
  normalizeUserRole(profile?.role) === "admin"
  || getEffectiveManagedPlan(profile) === "admin"
);

const toMillis = (value: AccessProfile["subscriptionEndsAt"]) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (
    typeof value === "object"
    && value !== null
    && "toDate" in value
    && typeof value.toDate === "function"
  ) {
    return value.toDate().getTime();
  }

  return null;
};

export const hasAcceptedLegal = (profile: AccessProfile | null | undefined) => (
  profile?.termsAccepted === true
  && profile?.privacyAccepted === true
  && profile?.termsVersion === CURRENT_TERMS_VERSION
);

export const hasPremiumAccess = (profile: AccessProfile | null | undefined) => {
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

  const effectivePlan = getEffectiveManagedPlan(profile);

  if (effectivePlan !== "pro" && effectivePlan !== "elite") {
    return false;
  }

  const billingStatus = normalizeBillingStatus(profile.billingStatus);

  if (!billingStatus) {
    return true;
  }

  if (ACTIVE_BILLING_STATUSES.has(billingStatus)) {
    return true;
  }

  if (profile.cancelAtPeriodEnd === true) {
    const endsAtMillis = toMillis(profile.subscriptionEndsAt);
    return endsAtMillis !== null && endsAtMillis > Date.now();
  }

  return false;
};

export const canUseAutomation = (profile: AccessProfile | null | undefined) => (
  hasAcceptedLegal(profile)
  && hasPremiumAccess(profile)
);

export const isAutomationDeliveryEligible = (profile: AccessProfile | null | undefined) => (
  canUseAutomation(profile)
  && profile?.webhookEnabled === true
  && `${profile?.status ?? ""}`.trim().toLowerCase() === "active"
);

export type AutomationExecutionAccessResult =
  | { allowed: true; reason: null; isAdmin: boolean; effectivePlan: ManagedPlan }
  | {
    allowed: false;
    reason: "not-elite" | "inactive-subscription" | "not-approved" | "admin-only-paper-testing";
    isAdmin: boolean;
    effectivePlan: ManagedPlan;
  };

export const evaluateAutomationExecutionAccess = (
  profile: AccessProfile | null | undefined,
  options?: { adminOnly?: boolean }
): AutomationExecutionAccessResult => {
  const isAdmin = isAdminProfile(profile);
  const effectivePlan = getEffectiveManagedPlan(profile);

  if (options?.adminOnly) {
    if (isAdmin) {
      return { allowed: true, reason: null, isAdmin, effectivePlan };
    }

    return {
      allowed: false,
      reason: "admin-only-paper-testing",
      isAdmin,
      effectivePlan,
    };
  }

  if (isAdmin) {
    return { allowed: true, reason: null, isAdmin, effectivePlan };
  }

  if (profile?.approved === false) {
    return {
      allowed: false,
      reason: "not-approved",
      isAdmin,
      effectivePlan,
    };
  }

  if (profile?.subscriptionActive !== true) {
    return {
      allowed: false,
      reason: "inactive-subscription",
      isAdmin,
      effectivePlan,
    };
  }

  if (effectivePlan !== "elite") {
    return {
      allowed: false,
      reason: "not-elite",
      isAdmin,
      effectivePlan,
    };
  }

  return { allowed: true, reason: null, isAdmin, effectivePlan };
};
