import { httpsCallable } from "firebase/functions";
import { loadStripe } from "@stripe/stripe-js";
import { functions } from "./firebase";

type CreateCheckoutSessionPayload = {
  plan: "pro" | "elite";
  returnUrl: string;
};

type CreateCheckoutSessionResponse = {
  sessionId: string;
};

type CreateBillingPortalSessionPayload = {
  returnUrl: string;
};

type CreateBillingPortalSessionResponse = {
  url: string;
};

const createCheckoutSessionCallable = httpsCallable<
  CreateCheckoutSessionPayload,
  CreateCheckoutSessionResponse
>(functions, "createCheckoutSession");

const createBillingPortalSessionCallable = httpsCallable<
  CreateBillingPortalSessionPayload,
  CreateBillingPortalSessionResponse
>(functions, "createBillingPortalSession");

export const startStripeCheckout = async (plan: "pro" | "elite") => {
  const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

  if (!publishableKey) {
    throw new Error("Missing Stripe publishable key.");
  }

  const stripe = await loadStripe(publishableKey);

  if (!stripe) {
    throw new Error("Unable to initialize Stripe Checkout.");
  }

  const response = await createCheckoutSessionCallable({
    plan,
    returnUrl: window.location.origin,
  });
  const sessionId = response.data.sessionId;

  if (!sessionId) {
    throw new Error("Checkout session was not created.");
  }

  const result = await stripe.redirectToCheckout({ sessionId });

  if (result.error) {
    throw new Error(result.error.message);
  }
};

export const openBillingPortal = async () => {
  const response = await createBillingPortalSessionCallable({
    returnUrl: window.location.origin,
  });

  if (!response.data.url) {
    throw new Error("Billing portal session was not created.");
  }

  window.location.assign(response.data.url);
};
