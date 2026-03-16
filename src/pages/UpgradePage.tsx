import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import { startStripeCheckout } from "../lib/billing";
import { getUserProfile } from "../lib/firestore";
import type { UserPlan } from "../lib/firestore";

type ManagedPlan = "pro" | "elite";

const planDetails: Record<ManagedPlan, { priceLabel: string; summary: string; features: string[] }> = {
  pro: {
    priceLabel: "$49 / month",
    summary: "Full dashboard access for active members.",
    features: [
      "Full protected dashboard",
      "Live approved signals",
      "Closed trade history",
      "Performance summary",
    ],
  },
  elite: {
    priceLabel: "$99 / month",
    summary: "Everything in Pro, plus future premium tier access.",
    features: [
      "Everything in Pro",
      "Future premium feature access",
      "Premium-ready account tier",
    ],
  },
};

function UpgradePage() {
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [currentPlan, setCurrentPlan] = useState<UserPlan>("free");
  const [billingStatus, setBillingStatus] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const requestedPlan = normalizeRequestedPlan(searchParams.get("plan"));

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      if (!currentUser) {
        if (isMounted) {
          setIsLoading(false);
        }

        return;
      }

      try {
        const profile = await getUserProfile(currentUser.uid);

        if (isMounted) {
          setCurrentPlan(profile?.plan ?? "free");
          setBillingStatus(profile?.billingStatus ?? "");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const isAlreadyOnRequestedPlan = currentPlan === requestedPlan;
  const isDowngradeBlocked = currentPlan === "elite" && requestedPlan === "pro";
  const canCheckout = !isLoading && !isAlreadyOnRequestedPlan && !isDowngradeBlocked;

  const handleCheckout = async () => {
    setError("");
    setIsSubmitting(true);

    try {
      await startStripeCheckout(requestedPlan);
    } catch (checkoutError) {
      const message =
        checkoutError instanceof Error && checkoutError.message.trim()
          ? checkoutError.message.trim()
          : "Unable to start checkout right now.";
      setError(message);
      setIsSubmitting(false);
    }
  };

  return (
    <section style={{ maxWidth: "760px", margin: "0 auto", display: "grid", gap: "1rem" }}>
      <div style={heroCardStyle}>
        <h1 style={{ margin: 0 }}>Upgrade to {capitalizePlan(requestedPlan)}</h1>
        <p style={{ margin: 0, color: "#475467" }}>
          Secure Stripe Checkout is ready. Your plan access will update automatically
          after the Stripe webhook writes the new plan into Firestore.
        </p>
      </div>

      <div style={contentCardStyle}>
        <div style={summaryGridStyle}>
          <SummaryItem label="Current plan" value={isLoading ? "Loading..." : currentPlan} />
          <SummaryItem label="Requested plan" value={requestedPlan} />
          <SummaryItem label="Price" value={planDetails[requestedPlan].priceLabel} />
          <SummaryItem label="Billing status" value={billingStatus || "Not subscribed"} />
        </div>

        <div style={{ display: "grid", gap: "0.5rem" }}>
          <h2 style={{ margin: 0, color: "#101828" }}>What you get</h2>
          <p style={{ margin: 0, color: "#475467" }}>{planDetails[requestedPlan].summary}</p>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {planDetails[requestedPlan].features.map((feature) => (
              <div key={feature} style={{ display: "flex", gap: "0.6rem", color: "#344054" }}>
                <span aria-hidden="true" style={{ fontWeight: 700 }}>
                  +
                </span>
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {isAlreadyOnRequestedPlan ? (
          <div style={successBannerStyle}>
            You are already on the {capitalizePlan(requestedPlan)} plan.
          </div>
        ) : null}

        {isDowngradeBlocked ? (
          <div style={warningBannerStyle}>
            Your account is already on Elite. Downgrade handling will be added through a
            future billing portal flow.
          </div>
        ) : null}

        {!isAlreadyOnRequestedPlan && !isDowngradeBlocked ? (
          <div style={noticeBannerStyle}>
            Clicking continue sends you to Stripe Checkout. Plan access updates when the
            Stripe webhook confirms the subscription in Firestore.
          </div>
        ) : null}

        {error ? <div style={errorBannerStyle}>{error}</div> : null}

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleCheckout}
            disabled={!canCheckout || isSubmitting}
            style={primaryButtonStyle(!canCheckout || isSubmitting)}
          >
            {isSubmitting ? "Redirecting to Stripe..." : "Continue to checkout"}
          </button>
          <Link to="/pricing" style={secondaryLinkStyle}>
            Back to pricing
          </Link>
        </div>
      </div>
    </section>
  );
}

type SummaryItemProps = {
  label: string;
  value: string;
};

function SummaryItem({ label, value }: SummaryItemProps) {
  return (
    <div style={summaryItemStyle}>
      <span style={{ color: "#475467", fontSize: "0.85rem", fontWeight: 600 }}>{label}</span>
      <strong style={{ color: "#101828" }}>{capitalizePlan(value)}</strong>
    </div>
  );
}

const normalizeRequestedPlan = (value: string | null): ManagedPlan => {
  return value === "elite" ? "elite" : "pro";
};

const capitalizePlan = (value: string) => `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

const heroCardStyle = {
  padding: "1.5rem",
  border: "1px solid #d0d5dd",
  borderRadius: "20px",
  backgroundColor: "#f8fafc",
  display: "grid",
  gap: "0.5rem",
};

const contentCardStyle = {
  display: "grid",
  gap: "1rem",
  padding: "1.5rem",
  border: "1px solid #d0d5dd",
  borderRadius: "20px",
  backgroundColor: "#ffffff",
};

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "0.75rem",
};

const summaryItemStyle = {
  display: "grid",
  gap: "0.3rem",
  padding: "1rem",
  borderRadius: "14px",
  border: "1px solid #eaecf0",
  backgroundColor: "#f8fafc",
};

const successBannerStyle = {
  padding: "0.9rem 1rem",
  borderRadius: "14px",
  backgroundColor: "#ecfdf3",
  color: "#027a48",
  border: "1px solid #abefc6",
  fontWeight: 700,
};

const warningBannerStyle = {
  padding: "0.9rem 1rem",
  borderRadius: "14px",
  backgroundColor: "#fffaeb",
  color: "#b54708",
  border: "1px solid #fedf89",
  fontWeight: 700,
};

const noticeBannerStyle = {
  padding: "0.9rem 1rem",
  borderRadius: "14px",
  backgroundColor: "#eff8ff",
  color: "#175cd3",
  border: "1px solid #b2ddff",
};

const errorBannerStyle = {
  padding: "0.9rem 1rem",
  borderRadius: "14px",
  backgroundColor: "#fef3f2",
  color: "#b42318",
  border: "1px solid #fecdca",
  fontWeight: 700,
};

const primaryButtonStyle = (isDisabled: boolean) => ({
  border: 0,
  borderRadius: "12px",
  padding: "0.9rem 1.1rem",
  backgroundColor: isDisabled ? "#98a2b3" : "#101828",
  color: "#ffffff",
  fontWeight: 700,
  cursor: isDisabled ? "not-allowed" : "pointer",
});

const secondaryLinkStyle = {
  textDecoration: "none",
  padding: "0.9rem 1.1rem",
  borderRadius: "12px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#ffffff",
  color: "#344054",
  fontWeight: 700,
};

export default UpgradePage;
