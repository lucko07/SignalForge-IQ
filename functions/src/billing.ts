import Stripe from "stripe";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

type ManagedPlan = "pro" | "elite";
type UserPlan = "free" | "pro" | "elite" | "admin";
type UserRole = "member" | "admin";

type BillingProfile = {
  uid?: string;
  email?: string;
  plan?: UserPlan;
  currentPlan?: UserPlan;
  role?: UserRole;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  billingStatus?: string;
  cancelAtPeriodEnd?: boolean;
  subscriptionEndsAt?: Timestamp | null;
  stripeSubscriptionStatus?: string;
};

const getStripeClient = () => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }

  return new Stripe(stripeSecretKey);
};

export const createCheckoutSession = onCall(
  {},
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "You must be signed in to start checkout.");
    }

    const selectedPlan = normalizeManagedPlan(request.data?.plan);
    const appUrl = normalizeAppUrl(request.data?.returnUrl);

    if (!selectedPlan || !appUrl) {
      throw new HttpsError("invalid-argument", "Select a valid paid plan.");
    }

    const db = getFirestore();
    const userReference = db.collection("users").doc(request.auth.uid);
    const userSnapshot = await userReference.get();

    if (!userSnapshot.exists) {
      throw new HttpsError("not-found", "User profile not found.");
    }

    const profile = userSnapshot.data() as BillingProfile;
    const currentPlan = normalizeUserPlan(profile.plan);
    const currentRole = normalizeUserRole(profile.role);

    if (currentRole === "admin") {
      throw new HttpsError("failed-precondition", "Admin users are not managed through Stripe.");
    }

    if (currentPlan === selectedPlan) {
      throw new HttpsError("failed-precondition", `You are already on the ${selectedPlan} plan.`);
    }

    if (currentPlan === "elite" && selectedPlan === "pro") {
      throw new HttpsError("failed-precondition", "Elite accounts cannot downgrade through checkout.");
    }

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      client_reference_id: request.auth.uid,
      customer: profile.stripeCustomerId,
      customer_email: profile.stripeCustomerId ? undefined : profile.email ?? request.auth.token.email,
      line_items: [
        {
          price: getStripePriceId(selectedPlan),
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/upgrade/success?plan=${selectedPlan}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/upgrade/cancel?plan=${selectedPlan}`,
      metadata: {
        firebaseUid: request.auth.uid,
        selectedPlan,
      },
      subscription_data: {
        metadata: {
          firebaseUid: request.auth.uid,
          selectedPlan,
        },
      },
      allow_promotion_codes: true,
    });

    if (!session.id) {
      throw new HttpsError("internal", "Stripe checkout session creation failed.");
    }

    return {
      sessionId: session.id,
      publishableKeyConfigured: true,
    };
  }
);

export const createBillingPortalSession = onCall({}, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "You must be signed in to manage billing.");
  }

  const appUrl = normalizeAppUrl(request.data?.returnUrl);

  if (!appUrl) {
    throw new HttpsError("invalid-argument", "A valid return URL is required.");
  }

  const db = getFirestore();
  const userReference = db.collection("users").doc(request.auth.uid);
  const userSnapshot = await userReference.get();

  if (!userSnapshot.exists) {
    throw new HttpsError("not-found", "User profile not found.");
  }

  const profile = userSnapshot.data() as BillingProfile;
  const currentRole = normalizeUserRole(profile.role);
  const currentPlan = normalizeUserPlan(profile.plan);

  if (currentRole === "admin") {
    throw new HttpsError("failed-precondition", "Admin users do not use Stripe billing.");
  }

  if (!profile.stripeCustomerId || currentPlan === "free") {
    throw new HttpsError("failed-precondition", "No active Stripe-managed subscription was found.");
  }

  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripeCustomerId,
    return_url: `${appUrl}/dashboard`,
  });

  return { url: session.url };
});

export const stripeWebhook = onRequest(
  {
    secrets: [stripeWebhookSecret],
  },
  async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).json({ error: "Method not allowed." });
      return;
    }

    const signature = request.header("stripe-signature");

    if (!signature) {
      response.status(400).json({ error: "Missing Stripe signature." });
      return;
    }

    try {
      const stripe = getStripeClient();
      const event = stripe.webhooks.constructEvent(
        request.rawBody,
        signature,
        stripeWebhookSecret.value()
      );

      logger.info("stripeWebhook received event.", {
        eventType: event.type,
      });

      switch (event.type) {
        case "checkout.session.completed":
          await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
          break;
        case "customer.subscription.created":
          await handleSubscriptionStateChange(
            event.type,
            event.data.object as Stripe.Subscription
          );
          break;
        case "customer.subscription.updated":
          await handleSubscriptionStateChange(
            event.type,
            event.data.object as Stripe.Subscription
          );
          break;
        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;
        case "invoice.payment_failed":
          await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;
        case "invoice.payment_succeeded":
          await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;
        default:
          break;
      }

      response.status(200).json({ received: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Webhook handling failed.";
      response.status(400).json({ error: message });
    }
  }
);

const handleCheckoutSessionCompleted = async (session: Stripe.Checkout.Session) => {
  const selectedPlan = normalizeManagedPlan(session.metadata?.selectedPlan);
  const stripeCustomerId = getStripeId(session.customer);
  const stripeSubscriptionId = getStripeId(session.subscription);

  if (!selectedPlan) {
    await logWebhookSync("checkout.session.completed", {
      stripeCustomerId,
      stripeSubscriptionId,
      matchedUid: undefined,
      updatedFields: undefined,
      skippedReason: "No paid plan could be resolved from session metadata.",
    });
    return;
  }

  const result = await updateUserBillingProfile({
    firebaseUid: session.metadata?.firebaseUid ?? session.client_reference_id ?? undefined,
    stripeCustomerId,
    stripeSubscriptionId,
  }, {
    plan: selectedPlan,
    stripeCustomerId,
    stripeSubscriptionId,
    billingStatus: session.payment_status === "paid" ? "active" : session.payment_status ?? "pending",
    cancelAtPeriodEnd: false,
    subscriptionEndsAt: null,
    stripeSubscriptionStatus: "active",
  });

  await logWebhookSync("checkout.session.completed", {
    stripeCustomerId,
    stripeSubscriptionId,
    matchedUid: result?.matchedUid,
    updatedFields: result?.updatedFields,
    skippedReason: result?.skippedReason,
  });
};

const handleSubscriptionStateChange = async (
  eventType: "customer.subscription.created" | "customer.subscription.updated",
  subscription: Stripe.Subscription
) => {
  const selectedPlan =
    normalizeManagedPlan(subscription.metadata?.selectedPlan)
    ?? getPlanFromPriceId(subscription.items.data[0]?.price?.id);
  const stripeCustomerId = getStripeId(subscription.customer);
  const stripeSubscriptionId = subscription.id;

  if (!selectedPlan) {
    await logWebhookSync(eventType, {
      stripeCustomerId,
      stripeSubscriptionId,
      matchedUid: undefined,
      updatedFields: undefined,
      skippedReason: "No paid plan could be resolved from subscription.",
    });
    return;
  }

  logger.info("stripeWebhook handling subscription lifecycle event.", {
    eventType,
    stripeCustomerId,
    stripeSubscriptionId,
    plan: selectedPlan,
    billingStatus: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    stripeCurrentPeriodEnd: getSubscriptionCurrentPeriodEnd(subscription),
  });

  const result = await updateUserBillingProfile({
    firebaseUid: subscription.metadata?.firebaseUid,
    stripeCustomerId,
    stripeSubscriptionId,
  }, {
    plan: selectedPlan,
    stripeCustomerId,
    stripeSubscriptionId,
    billingStatus: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    subscriptionEndsAt: getScheduledCancellationEndsAt(subscription),
    stripeSubscriptionStatus: subscription.status,
  });

  await logWebhookSync(eventType, {
    stripeCustomerId,
    stripeSubscriptionId,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    stripeCancelAt: subscription.cancel_at ?? null,
    stripeCurrentPeriodEnd: getSubscriptionCurrentPeriodEnd(subscription),
    subscriptionEndsAt: getSubscriptionEndsAt(subscription)?.toDate().toISOString() ?? null,
    matchedUid: result?.matchedUid,
    updatedFields: result?.updatedFields,
    skippedReason: result?.skippedReason,
  });
};

const handleSubscriptionDeleted = async (subscription: Stripe.Subscription) => {
  const stripeCustomerId = getStripeId(subscription.customer);
  const stripeSubscriptionId = subscription.id;

  logger.info("stripeWebhook handling subscription lifecycle event.", {
    eventType: "customer.subscription.deleted",
    stripeCustomerId,
    stripeSubscriptionId,
    billingStatus: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    stripeCurrentPeriodEnd: getSubscriptionCurrentPeriodEnd(subscription),
  });

  const result = await updateUserBillingProfile({
    firebaseUid: subscription.metadata?.firebaseUid,
    stripeCustomerId,
    stripeSubscriptionId,
  }, {
    plan: "free",
    stripeCustomerId,
    stripeSubscriptionId,
    billingStatus: "canceled",
    cancelAtPeriodEnd: false,
    subscriptionEndsAt: null,
    stripeSubscriptionStatus: subscription.status,
  });

  await logWebhookSync("customer.subscription.deleted", {
    stripeCustomerId,
    stripeSubscriptionId,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    stripeCancelAt: subscription.cancel_at ?? null,
    stripeCurrentPeriodEnd: getSubscriptionCurrentPeriodEnd(subscription),
    subscriptionEndsAt: getSubscriptionEndsAt(subscription)?.toDate().toISOString() ?? null,
    matchedUid: result?.matchedUid,
    updatedFields: result?.updatedFields,
    skippedReason: result?.skippedReason,
  });
};

const handleInvoicePaymentFailed = async (invoice: Stripe.Invoice) => {
  const subscriptionId = getStripeId(invoice.parent?.subscription_details?.subscription ?? null);
  const stripeCustomerId = getStripeId(invoice.customer);

  if (!subscriptionId) {
    await logWebhookSync("invoice.payment_failed", {
      stripeCustomerId,
      stripeSubscriptionId: undefined,
      matchedUid: undefined,
      updatedFields: undefined,
      skippedReason: "Invoice did not include a subscription reference.",
    });
    return;
  }

  const context = await getSubscriptionBillingContext(subscriptionId);

  if (!context) {
    await logWebhookSync("invoice.payment_failed", {
      stripeCustomerId,
      stripeSubscriptionId: subscriptionId,
      matchedUid: undefined,
      updatedFields: undefined,
      skippedReason: "No subscription billing context could be resolved.",
    });
    return;
  }

  const result = await updateUserBillingProfile({
    firebaseUid: context.firebaseUid,
    stripeCustomerId: context.stripeCustomerId,
    stripeSubscriptionId: context.stripeSubscriptionId,
  }, {
    plan: context.selectedPlan,
    stripeCustomerId: context.stripeCustomerId,
    stripeSubscriptionId: context.stripeSubscriptionId,
    billingStatus: context.billingStatus === "active" ? "past_due" : context.billingStatus ?? "past_due",
    cancelAtPeriodEnd: context.cancelAtPeriodEnd,
    subscriptionEndsAt: context.subscriptionEndsAt,
    stripeSubscriptionStatus: context.stripeSubscriptionStatus,
  });

  await logWebhookSync("invoice.payment_failed", {
    stripeCustomerId: context.stripeCustomerId,
    stripeSubscriptionId: context.stripeSubscriptionId,
    cancelAtPeriodEnd: context.cancelAtPeriodEnd,
    stripeCancelAt: context.stripeCancelAt,
    stripeCurrentPeriodEnd: context.stripeCurrentPeriodEnd,
    subscriptionEndsAt: context.subscriptionEndsAt?.toDate().toISOString() ?? null,
    matchedUid: result?.matchedUid,
    updatedFields: result?.updatedFields,
    skippedReason: result?.skippedReason,
  });
};

const handleInvoicePaymentSucceeded = async (invoice: Stripe.Invoice) => {
  const subscriptionId = getStripeId(invoice.parent?.subscription_details?.subscription ?? null);
  const stripeCustomerId = getStripeId(invoice.customer);

  if (!subscriptionId) {
    await logWebhookSync("invoice.payment_succeeded", {
      stripeCustomerId,
      stripeSubscriptionId: undefined,
      matchedUid: undefined,
      updatedFields: undefined,
      skippedReason: "Invoice did not include a subscription reference.",
    });
    return;
  }

  const context = await getSubscriptionBillingContext(subscriptionId);

  if (!context) {
    await logWebhookSync("invoice.payment_succeeded", {
      stripeCustomerId,
      stripeSubscriptionId: subscriptionId,
      matchedUid: undefined,
      updatedFields: undefined,
      skippedReason: "No subscription billing context could be resolved.",
    });
    return;
  }

  const result = await updateUserBillingProfile({
    firebaseUid: context.firebaseUid,
    stripeCustomerId: context.stripeCustomerId,
    stripeSubscriptionId: context.stripeSubscriptionId,
  }, {
    plan: context.selectedPlan,
    stripeCustomerId: context.stripeCustomerId,
    stripeSubscriptionId: context.stripeSubscriptionId,
    billingStatus: context.billingStatus ?? "active",
    cancelAtPeriodEnd: context.cancelAtPeriodEnd,
    subscriptionEndsAt: context.subscriptionEndsAt,
    stripeSubscriptionStatus: context.stripeSubscriptionStatus,
  });

  await logWebhookSync("invoice.payment_succeeded", {
    stripeCustomerId: context.stripeCustomerId,
    stripeSubscriptionId: context.stripeSubscriptionId,
    cancelAtPeriodEnd: context.cancelAtPeriodEnd,
    stripeCancelAt: context.stripeCancelAt,
    stripeCurrentPeriodEnd: context.stripeCurrentPeriodEnd,
    subscriptionEndsAt: context.subscriptionEndsAt?.toDate().toISOString() ?? null,
    matchedUid: result?.matchedUid,
    updatedFields: result?.updatedFields,
    skippedReason: result?.skippedReason,
  });
};

const updateUserBillingProfile = async (
  identifiers: {
    firebaseUid?: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
  },
  updates: {
    plan: UserPlan;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    billingStatus?: string;
    cancelAtPeriodEnd?: boolean;
    subscriptionEndsAt?: Timestamp | null;
    stripeSubscriptionStatus?: string;
  }
) => {
  const matchedUser = await findUserByBillingIdentifiers(identifiers);

  if (!matchedUser) {
    return {
      matchedUid: undefined,
      updatedFields: undefined,
      skippedReason: "No matching Firestore user was found for the Stripe identifiers.",
    };
  }

  const currentRole = normalizeUserRole(matchedUser.profile.role);

  if (currentRole === "admin") {
    return {
      matchedUid: matchedUser.uid,
      updatedFields: undefined,
      skippedReason: "Matched user is an admin. Stripe billing updates were skipped.",
    };
  }

  const normalizedBillingStatus = normalizeBillingStatus(updates.billingStatus);
  const nextPlan = getEffectivePlanForBillingState(
    normalizeUserPlan(updates.plan),
    normalizedBillingStatus
  );
  const billingPayload =
    nextPlan === "free"
      ? {
        plan: "free",
        currentPlan: "free",
        billingStatus: normalizedBillingStatus ?? "canceled",
        stripeCustomerId: updates.stripeCustomerId ?? matchedUser.profile.stripeCustomerId ?? null,
        stripeSubscriptionId:
          updates.stripeSubscriptionId ?? matchedUser.profile.stripeSubscriptionId ?? null,
        cancelAtPeriodEnd: false,
        subscriptionEndsAt: null,
        stripeSubscriptionStatus: updates.stripeSubscriptionStatus ?? normalizedBillingStatus ?? "canceled",
      }
      : {
        plan: nextPlan,
        currentPlan: nextPlan,
        billingStatus: nextPlan === "pro" || nextPlan === "elite"
          ? normalizedBillingStatus ?? "active"
          : normalizedBillingStatus,
        stripeCustomerId: updates.stripeCustomerId ?? matchedUser.profile.stripeCustomerId ?? null,
        stripeSubscriptionId:
          updates.stripeSubscriptionId ?? matchedUser.profile.stripeSubscriptionId ?? null,
        cancelAtPeriodEnd: updates.cancelAtPeriodEnd ?? false,
        subscriptionEndsAt:
          updates.cancelAtPeriodEnd
            ? updates.subscriptionEndsAt ?? matchedUser.profile.subscriptionEndsAt ?? null
            : null,
        stripeSubscriptionStatus: updates.stripeSubscriptionStatus ?? normalizedBillingStatus ?? "active",
      };

  const currentPayload = {
    plan: normalizeUserPlan(matchedUser.profile.plan),
    currentPlan: matchedUser.profile.currentPlan
      ? normalizeUserPlan(matchedUser.profile.currentPlan)
      : normalizeUserPlan(matchedUser.profile.plan),
    billingStatus: normalizeBillingStatus(matchedUser.profile.billingStatus) ?? null,
    stripeCustomerId: matchedUser.profile.stripeCustomerId ?? null,
    stripeSubscriptionId: matchedUser.profile.stripeSubscriptionId ?? null,
    cancelAtPeriodEnd: matchedUser.profile.cancelAtPeriodEnd ?? false,
    subscriptionEndsAt: matchedUser.profile.subscriptionEndsAt ?? null,
    stripeSubscriptionStatus: matchedUser.profile.stripeSubscriptionStatus ?? null,
  };

  if (JSON.stringify(currentPayload) === JSON.stringify(billingPayload)) {
    return {
      matchedUid: matchedUser.uid,
      updatedFields: undefined,
      skippedReason: "Firestore billing state already matched the Stripe event.",
    };
  }

  await matchedUser.reference.set(billingPayload, { merge: true });

  return {
    matchedUid: matchedUser.uid,
    updatedFields: billingPayload,
  };
};

const getStripePriceId = (plan: ManagedPlan) => {
  const elitePriceId = process.env.STRIPE_PRICE_ID_ELITE;
  const proPriceId = process.env.STRIPE_PRICE_ID_PRO;

  if (!elitePriceId || !proPriceId) {
    throw new Error("Missing Stripe price ID environment variables.");
  }

  if (plan === "elite") {
    return elitePriceId;
  }

  return proPriceId;
};

const getPlanFromPriceId = (priceId?: string | null): ManagedPlan | undefined => {
  const elitePriceId = process.env.STRIPE_PRICE_ID_ELITE;
  const proPriceId = process.env.STRIPE_PRICE_ID_PRO;

  if (!priceId) {
    return undefined;
  }

  if (elitePriceId && priceId === elitePriceId) {
    return "elite";
  }

  if (proPriceId && priceId === proPriceId) {
    return "pro";
  }

  return undefined;
};

const normalizeManagedPlan = (value: unknown): ManagedPlan | undefined => {
  if (value === "elite") {
    return "elite";
  }

  if (value === "pro") {
    return "pro";
  }

  return undefined;
};

const normalizeAppUrl = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue.startsWith("http://") && !trimmedValue.startsWith("https://")) {
    return undefined;
  }

  return trimmedValue.replace(/\/$/, "");
};

const normalizeUserPlan = (value: unknown): UserPlan => {
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

const normalizeUserRole = (value: unknown): UserRole => {
  return value === "admin" ? "admin" : "member";
};

const normalizeBillingStatus = (value: unknown) => {
  return typeof value === "string" ? value.trim().toLowerCase() : undefined;
};

const getEffectivePlanForBillingState = (
  requestedPlan: UserPlan,
  billingStatus?: string
): UserPlan => {
  if (requestedPlan === "admin") {
    return "admin";
  }

  if (requestedPlan === "free") {
    return "free";
  }

  if (!billingStatus) {
    return requestedPlan;
  }

  if (billingStatus === "active") {
    return requestedPlan;
  }

  if (billingStatus === "trialing") {
    return requestedPlan;
  }

  return "free";
};

const getSubscriptionBillingContext = async (subscriptionId: string) => {
  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const firebaseUid = subscription.metadata?.firebaseUid;
  const selectedPlan =
    normalizeManagedPlan(subscription.metadata?.selectedPlan)
    ?? getPlanFromPriceId(subscription.items.data[0]?.price?.id);

  if (!firebaseUid || !selectedPlan) {
    return null;
  }

  return {
    firebaseUid,
    selectedPlan,
    stripeCustomerId: getStripeId(subscription.customer),
    stripeSubscriptionId: subscription.id,
    billingStatus: normalizeBillingStatus(subscription.status),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    subscriptionEndsAt: getSubscriptionEndsAt(subscription),
    stripeSubscriptionStatus: subscription.status,
    stripeCancelAt: subscription.cancel_at ?? null,
    stripeCurrentPeriodEnd: getSubscriptionCurrentPeriodEnd(subscription),
  };
};

const getStripeId = (
  value: string | Stripe.Customer | Stripe.DeletedCustomer | Stripe.Subscription | null
) => {
  if (!value) {
    return undefined;
  }

  return typeof value === "string" ? value : value.id;
};

const findUserByBillingIdentifiers = async (identifiers: {
  firebaseUid?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}) => {
  const db = getFirestore();

  if (identifiers.stripeCustomerId) {
    const customerSnapshot = await db
      .collection("users")
      .where("stripeCustomerId", "==", identifiers.stripeCustomerId)
      .limit(1)
      .get();

    if (!customerSnapshot.empty) {
      const document = customerSnapshot.docs[0];

      return {
        uid: document.id,
        reference: document.ref,
        profile: document.data() as BillingProfile,
      };
    }
  }

  if (identifiers.stripeSubscriptionId) {
    const subscriptionSnapshot = await db
      .collection("users")
      .where("stripeSubscriptionId", "==", identifiers.stripeSubscriptionId)
      .limit(1)
      .get();

    if (!subscriptionSnapshot.empty) {
      const document = subscriptionSnapshot.docs[0];

      return {
        uid: document.id,
        reference: document.ref,
        profile: document.data() as BillingProfile,
      };
    }
  }

  if (identifiers.firebaseUid) {
    const userReference = db.collection("users").doc(identifiers.firebaseUid);
    const userSnapshot = await userReference.get();

    if (userSnapshot.exists) {
      return {
        uid: userSnapshot.id,
        reference: userReference,
        profile: userSnapshot.data() as BillingProfile,
      };
    }
  }

  return null;
};

const logWebhookSync = async (
  eventType: string,
  details: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    cancelAtPeriodEnd?: boolean;
    stripeCancelAt?: number | null;
    stripeCurrentPeriodEnd?: number | null;
    subscriptionEndsAt?: string | null;
    matchedUid?: string;
    updatedFields?: Record<string, unknown>;
    skippedReason?: string;
  }
) => {
  logger.info("stripeWebhook processed billing event.", {
    eventType,
    stripeCustomerId: details.stripeCustomerId ?? null,
    stripeSubscriptionId: details.stripeSubscriptionId ?? null,
    cancelAtPeriodEnd: details.cancelAtPeriodEnd ?? null,
    stripeCancelAt: details.stripeCancelAt ?? null,
    stripeCurrentPeriodEnd: details.stripeCurrentPeriodEnd ?? null,
    subscriptionEndsAt: details.subscriptionEndsAt ?? null,
    matchedUid: details.matchedUid ?? null,
    updatedFields: details.updatedFields ?? null,
    skippedReason: details.skippedReason ?? null,
  });
};

const getSubscriptionEndsAt = (subscription: Stripe.Subscription) => {
  const endTimestamp = subscription.cancel_at ?? getSubscriptionCurrentPeriodEnd(subscription);

  if (!endTimestamp) {
    return null;
  }

  return Timestamp.fromMillis(endTimestamp * 1000);
};

const getScheduledCancellationEndsAt = (subscription: Stripe.Subscription) => {
  if (!subscription.cancel_at_period_end) {
    return null;
  }

  const currentPeriodEnd = getSubscriptionCurrentPeriodEnd(subscription);

  if (!currentPeriodEnd) {
    return null;
  }

  return Timestamp.fromMillis(currentPeriodEnd * 1000);
};

const getSubscriptionCurrentPeriodEnd = (subscription: Stripe.Subscription) => {
  const periodEnds = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value): value is number => typeof value === "number");

  if (periodEnds.length === 0) {
    return null;
  }

  return Math.max(...periodEnds);
};
