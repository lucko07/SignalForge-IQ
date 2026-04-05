import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import LegalConsentField from "../components/LegalConsentField";
import { useAuth } from "../context/auth-context";
import { isSecureCheckoutReady, startStripeCheckout } from "../lib/billing";
import {
  acceptLegalDocuments,
  CURRENT_TERMS_VERSION,
  normalizeManagedPlan,
} from "../lib/userProfiles";

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
  const { currentUser, loading, profile, hasLegalConsent, refreshProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [error, setError] = useState("");
  const requestedPlan = normalizeRequestedPlan(searchParams.get("plan"));
  const currentPlan = normalizeManagedPlan(profile?.currentPlan ?? profile?.plan ?? "free");
  const billingStatus = profile?.billingStatus ?? "";

  const isAlreadyOnRequestedPlan = currentPlan === requestedPlan;
  const isDowngradeBlocked = currentPlan === "elite" && requestedPlan === "pro";
  const canCheckout =
    isSecureCheckoutReady
    && !loading
    && !isAlreadyOnRequestedPlan
    && !isDowngradeBlocked
    && (hasLegalConsent || acceptedLegal);

  const handleCheckout = async () => {
    setError("");

    if (!hasLegalConsent && !acceptedLegal) {
      setError("You must accept Terms to continue");
      return;
    }

    if (!currentUser) {
      setError("Sign in to continue.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (!hasLegalConsent) {
        await acceptLegalDocuments(currentUser.uid, CURRENT_TERMS_VERSION);
        await refreshProfile();
      }

      await startStripeCheckout(requestedPlan);
    } catch (checkoutError) {
      const message =
        checkoutError instanceof Error && checkoutError.message.trim()
          ? checkoutError.message.trim()
          : "Unable to start payment right now.";
      setError(message);
      setIsSubmitting(false);
    }
  };

  return (
    <section style={{ maxWidth: "760px", margin: "0 auto", display: "grid", gap: "1rem" }}>
      <div style={heroCardStyle}>
        <h1 style={{ margin: 0 }}>Upgrade to {capitalizePlan(requestedPlan)}</h1>
        <p style={{ margin: 0, color: "#475467" }}>
          Secure payment is ready. Your access will update automatically after your membership is confirmed.
        </p>
      </div>

      <div style={contentCardStyle}>
        <div style={summaryGridStyle}>
          <SummaryItem label="Current plan" value={loading ? "Loading..." : currentPlan} />
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
            future account billing update.
          </div>
        ) : null}

        {!isSecureCheckoutReady ? (
          <div style={warningBannerStyle}>
            Secure payment is temporarily unavailable. Please try again later.
          </div>
        ) : null}

        {!isAlreadyOnRequestedPlan && !isDowngradeBlocked && isSecureCheckoutReady ? (
          <div style={noticeBannerStyle}>
            Clicking continue takes you to secure payment. Your access updates automatically after your membership is confirmed.
          </div>
        ) : null}

        {!hasLegalConsent ? (
          <LegalConsentField
            checked={acceptedLegal}
            onChange={(nextValue) => {
              setAcceptedLegal(nextValue);
              if (error === "You must accept Terms to continue") {
                setError("");
              }
            }}
            error={error === "You must accept Terms to continue" ? error : ""}
          />
        ) : null}

        {error && error !== "You must accept Terms to continue" ? (
          <div style={errorBannerStyle}>{error}</div>
        ) : null}

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleCheckout}
            disabled={!canCheckout || isSubmitting}
            style={primaryButtonStyle(!canCheckout || isSubmitting)}
          >
            {isSubmitting ? "Redirecting to payment..." : "Continue to payment"}
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
