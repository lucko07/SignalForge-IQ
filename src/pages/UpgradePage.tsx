import { useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import LegalConsentField from "../components/LegalConsentField";
import { useAuth } from "../context/auth-context";
import { isSecureCheckoutReady, startStripeCheckout } from "../lib/billing";
import {
  acceptLegalDocuments,
  CURRENT_TERMS_VERSION,
  normalizeManagedPlan,
} from "../lib/userProfiles";

type ManagedPlan = "pro" | "elite";

type UpgradeModule = {
  title: string;
  description: string;
  state: "included" | "locked";
};

const planDetails: Record<
  ManagedPlan,
  {
    label: string;
    priceLabel: string;
    summary: string;
    recommendation: string;
    features: string[];
    lockedModules: UpgradeModule[];
  }
> = {
  pro: {
    label: "Decision Engine",
    priceLabel: "$49 / month",
    summary:
      "Pro is built for traders who want clarity before action through signals, confidence, analytics, and market context.",
    recommendation:
      "Choose Pro when your priority is making better decisions inside a disciplined daily workflow.",
    features: [
      "Live BTC Precision Engine access with disciplined signal monitoring",
      "Confidence score to help frame conviction",
      "Analytics and trade history for disciplined review",
      "Market context throughout the day, plus visibility into the upcoming BTC Momentum module",
    ],
    lockedModules: [
      {
        title: "Automation",
        description: "Visible in the platform, but activation is reserved for Elite.",
        state: "locked",
      },
      {
        title: "Delivery controls",
        description: "Advanced delivery settings stay locked until execution access is enabled.",
        state: "locked",
      },
      {
        title: "Routing readiness",
        description: "Execution-oriented routing belongs to the Elite operating layer.",
        state: "locked",
      },
    ],
  },
  elite: {
    label: "Execution System",
    priceLabel: "$99 / month",
    summary:
      "Elite turns SignalForge IQ from insight into operation with automation, delivery controls, and execution-ready routing.",
    recommendation:
      "Most serious users choose Elite when they want SignalForge IQ to support faster, more consistent operational workflows.",
    features: [
      "Everything in the Decision Engine",
      "Execution-ready delivery and routing controls",
      "Automation activation from the dashboard",
      "Stronger fit for accounts built around speed and consistency",
    ],
    lockedModules: [
      {
        title: "Automation",
        description: "Included and ready to activate from the automation workspace.",
        state: "included",
      },
      {
        title: "Delivery controls",
        description: "Included for members who need execution-ready delivery.",
        state: "included",
      },
      {
        title: "Routing readiness",
        description: "Included as part of the Elite execution layer.",
        state: "included",
      },
    ],
  },
};

function UpgradePage() {
  const location = useLocation();
  const { currentUser, loading, profile, hasLegalConsent, refreshProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [error, setError] = useState("");

  const requestedPlan = normalizeRequestedPlan(searchParams.get("plan"));
  const currentPlan = normalizeManagedPlan(profile?.currentPlan ?? profile?.plan ?? "free");
  const billingStatus = profile?.billingStatus ?? "";
  const fromAutomation = useMemo(() => {
    const ref = searchParams.get("from");
    if (ref === "automation") {
      return true;
    }

    return location.state !== null && typeof location.state === "object" && "from" in location.state
      ? (location.state as { from?: string }).from === "automation"
      : false;
  }, [location.state, searchParams]);

  const isAlreadyOnRequestedPlan = currentPlan === requestedPlan;
  const isDowngradeBlocked = currentPlan === "elite" && requestedPlan === "pro";
  const canCheckout =
    isSecureCheckoutReady
    && !loading
    && !isAlreadyOnRequestedPlan
    && !isDowngradeBlocked
    && (hasLegalConsent || acceptedLegal);

  const headerTitle = requestedPlan === "elite"
    ? "Move from insight into execution."
    : "Upgrade into clearer decision support.";
  const primaryCtaLabel = fromAutomation && requestedPlan === "elite"
    ? "Unlock Elite Execution Access"
    : `Continue with ${capitalizeLabel(requestedPlan)}`;

  const contextualBanner = getContextualBanner(currentPlan, requestedPlan, fromAutomation);

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
    <section style={pageStyle}>
      <div style={heroCardStyle}>
        <span style={eyebrowStyle}>Membership Upgrade</span>
        <h1 style={heroTitleStyle}>{headerTitle}</h1>
        <p style={heroBodyStyle}>
          {planDetails[requestedPlan].summary}
        </p>
        <p style={heroSubBodyStyle}>
          SignalForge IQ is structured to stay valuable every day through signal monitoring, confidence framing,
          and qualified setup visibility even when no trade is active. BTC Precision Engine is live today, while BTC Momentum remains visible as a future-facing module.
        </p>
      </div>

      {contextualBanner ? (
        <div style={contextualBannerStyle(contextualBanner.tone)}>
          <strong>{contextualBanner.title}</strong>
          <p style={{ margin: 0 }}>{contextualBanner.body}</p>
        </div>
      ) : null}

      {fromAutomation && requestedPlan === "elite" ? (
        <div style={automationFocusCardStyle}>
          <span style={recommendationEyebrowStyle}>Automation Access</span>
          <h2 style={automationFocusTitleStyle}>Automation is part of the Elite Execution System.</h2>
          <p style={automationFocusBodyStyle}>
            The automation workspace is reserved for members who need execution-ready operation. Elite unlocks
            delivery controls, routing, and a faster operating flow built for accounts that move beyond signal review.
          </p>
          <p style={automationFocusSubBodyStyle}>
            Pro remains the Decision Engine. Elite is the layer that turns SignalForge IQ into an execution-oriented workspace.
          </p>
        </div>
      ) : null}

      <div style={summaryCardStyle}>
        <div style={summaryGridStyle}>
          <SummaryItem label="Current plan" value={loading ? "Loading..." : capitalizeLabel(currentPlan)} />
          <SummaryItem label="Target plan" value={capitalizeLabel(requestedPlan)} />
          <SummaryItem label="Role" value={planDetails[requestedPlan].label} />
          <SummaryItem label="Price" value={planDetails[requestedPlan].priceLabel} />
          <SummaryItem label="Billing status" value={billingStatus || "Not subscribed"} />
        </div>
      </div>

      <div style={contentGridStyle}>
        <article style={contentCardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>What unlocks on {capitalizeLabel(requestedPlan)}</h2>
            <p style={sectionBodyStyle}>{planDetails[requestedPlan].recommendation}</p>
          </div>

          <div style={featureListStyle}>
            {planDetails[requestedPlan].features.map((feature) => (
              <div key={feature} style={featureRowStyle}>
                <span aria-hidden="true" style={featurePlusStyle}>+</span>
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </article>

        <article style={contentCardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>Visible modules and locked access</h2>
            <p style={sectionBodyStyle}>
              The product keeps important capabilities visible so members understand what the next tier unlocks.
            </p>
          </div>

          <div style={moduleGridStyle}>
            {planDetails[requestedPlan].lockedModules.map((module) => (
              <div key={module.title} style={moduleCardStyle(module.state === "locked")}>
                <div style={moduleHeaderStyle}>
                  <strong style={moduleTitleStyle}>{module.title}</strong>
                  <span style={modulePillStyle(module.state === "locked")}>
                    {module.state === "locked" ? "Locked" : "Included"}
                  </span>
                </div>
                <p style={moduleBodyStyle}>{module.description}</p>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div style={recommendationCardStyle}>
        <div>
          <span style={recommendationEyebrowStyle}>Plan Recommendation</span>
          <h2 style={recommendationTitleStyle}>
            {requestedPlan === "elite"
              ? "Elite exists for members who need the execution layer."
              : "Pro is the right starting point when your priority is decision quality."}
          </h2>
          <p style={recommendationBodyStyle}>
            {requestedPlan === "elite"
              ? "If automation, delivery controls, or routing matter to your workflow, Elite is the correct plan. It is built to help members operate faster and more consistently."
              : "If you want live BTC Precision Engine access, confidence, analytics, and market context without moving into execution routing yet, Pro is a strong fit."}
          </p>
        </div>

        {requestedPlan === "pro" ? (
          <div style={eliteTeaserStyle}>
            <strong style={{ color: "#0f172a" }}>Momentum roadmap</strong>
            <p style={{ margin: 0, color: "#475467", lineHeight: 1.65 }}>
              BTC Momentum Engine is still being refined. Members can expect visible roadmap treatment now and a cleaner activation path once the product is production-ready.
            </p>
          </div>
        ) : null}
      </div>

      {isAlreadyOnRequestedPlan ? (
        <div style={successBannerStyle}>
          You are already on the {capitalizeLabel(requestedPlan)} plan.
        </div>
      ) : null}

      {isDowngradeBlocked ? (
        <div style={warningBannerStyle}>
          Your account is already on Elite. Downgrade handling will be added through billing management.
        </div>
      ) : null}

      {!isSecureCheckoutReady ? (
        <div style={warningBannerStyle}>
          Secure payment is temporarily unavailable. Please try again later.
        </div>
      ) : null}

      {!isAlreadyOnRequestedPlan && !isDowngradeBlocked && isSecureCheckoutReady ? (
        <div style={noticeBannerStyle}>
          Continue to secure payment to activate the {capitalizeLabel(requestedPlan)} membership. Access updates automatically after confirmation.
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

      <div style={actionsCardStyle}>
        <button
          type="button"
          onClick={handleCheckout}
          disabled={!canCheckout || isSubmitting}
          style={primaryButtonStyle(!canCheckout || isSubmitting)}
        >
          {isSubmitting ? "Redirecting to payment..." : primaryCtaLabel}
        </button>
        <Link to="/pricing" style={secondaryLinkStyle}>
          Back to pricing
        </Link>
      </div>
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={summaryItemStyle}>
      <span style={summaryLabelStyle}>{label}</span>
      <strong style={summaryValueStyle}>{value}</strong>
    </div>
  );
}

const getContextualBanner = (
  currentPlan: string,
  requestedPlan: ManagedPlan,
  fromAutomation: boolean
) => {
  if (fromAutomation && requestedPlan === "elite") {
    return {
      tone: "info" as const,
      title: "Automation is available on Elite",
      body:
        "You are trying to access the execution layer. Elite unlocks automation, delivery controls, routing, and execution-ready operation for members who need a faster workflow.",
    };
  }

  if (currentPlan === "pro" && requestedPlan === "elite") {
    return {
      tone: "info" as const,
      title: "Move from decision support into operation",
      body:
        "Pro helps with clarity before action. Elite adds the operational layer for members who want execution-ready delivery and routing.",
    };
  }

  if (currentPlan === "free" && requestedPlan === "pro") {
    return {
      tone: "neutral" as const,
      title: "Step into the Decision Engine",
      body:
        "Pro is the clean starting point for users who want qualified setups, confidence, analytics, and market context in one disciplined member environment.",
    };
  }

  return null;
};

const normalizeRequestedPlan = (value: string | null): ManagedPlan => (
  value === "elite" ? "elite" : "pro"
);

const capitalizeLabel = (value: string) => `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

const pageStyle = {
  maxWidth: "960px",
  margin: "0 auto",
  display: "grid",
  gap: "1rem",
};

const heroCardStyle = {
  display: "grid",
  gap: "0.6rem",
  padding: "1.75rem",
  border: "1px solid #d7dde7",
  borderRadius: "24px",
  background:
    "radial-gradient(circle at top left, rgba(185, 214, 247, 0.22), transparent 30%), linear-gradient(135deg, #0f172a 0%, #172033 52%, #213753 100%)",
};

const eyebrowStyle = {
  color: "#d8e1ee",
  fontSize: "0.82rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
};

const heroTitleStyle = {
  margin: 0,
  color: "#f8fafc",
  fontSize: "clamp(2rem, 3vw, 3rem)",
  lineHeight: 1.08,
};

const heroBodyStyle = {
  margin: 0,
  color: "#d9e3ef",
  lineHeight: 1.7,
  maxWidth: "65ch",
};

const heroSubBodyStyle = {
  margin: 0,
  color: "#bcc9d8",
  lineHeight: 1.65,
  maxWidth: "62ch",
};

const contextualBannerStyle = (tone: "info" | "neutral") => ({
  display: "grid",
  gap: "0.35rem",
  padding: "1rem 1.1rem",
  borderRadius: "16px",
  border: tone === "info" ? "1px solid #b2ddff" : "1px solid #d0d5dd",
  backgroundColor: tone === "info" ? "#eff8ff" : "#f8fafc",
  color: tone === "info" ? "#175cd3" : "#344054",
});

const summaryCardStyle = {
  padding: "1.25rem",
  border: "1px solid #d7dde7",
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

const summaryLabelStyle = {
  color: "#475467",
  fontSize: "0.85rem",
  fontWeight: 600,
};

const summaryValueStyle = {
  color: "#101828",
};

const contentGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "1rem",
};

const contentCardStyle = {
  display: "grid",
  gap: "1rem",
  padding: "1.4rem",
  border: "1px solid #d7dde7",
  borderRadius: "20px",
  backgroundColor: "#ffffff",
};

const sectionHeaderStyle = {
  display: "grid",
  gap: "0.35rem",
};

const sectionTitleStyle = {
  margin: 0,
  color: "#101828",
};

const sectionBodyStyle = {
  margin: 0,
  color: "#475467",
  lineHeight: 1.7,
};

const featureListStyle = {
  display: "grid",
  gap: "0.65rem",
};

const featureRowStyle = {
  display: "flex",
  gap: "0.6rem",
  color: "#344054",
  lineHeight: 1.6,
};

const featurePlusStyle = {
  fontWeight: 700,
  color: "#1f3a5b",
};

const moduleGridStyle = {
  display: "grid",
  gap: "0.75rem",
};

const moduleCardStyle = (isLocked: boolean) => ({
  display: "grid",
  gap: "0.4rem",
  padding: "1rem",
  borderRadius: "16px",
  border: isLocked ? "1px solid #f7b267" : "1px solid #cde2d3",
  backgroundColor: isLocked ? "#fff7ed" : "#ecfdf3",
});

const moduleHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "0.75rem",
  alignItems: "center",
};

const moduleTitleStyle = {
  color: "#101828",
};

const modulePillStyle = (isLocked: boolean) => ({
  padding: "0.3rem 0.55rem",
  borderRadius: "999px",
  backgroundColor: isLocked ? "#fed7aa" : "#abefc6",
  color: isLocked ? "#9a3412" : "#027a48",
  fontSize: "0.76rem",
  fontWeight: 700,
});

const moduleBodyStyle = {
  margin: 0,
  color: "#475467",
  lineHeight: 1.65,
};

const recommendationCardStyle = {
  display: "grid",
  gap: "1rem",
  padding: "1.4rem",
  border: "1px solid #d7dde7",
  borderRadius: "20px",
  background: "linear-gradient(135deg, #f8fafc 0%, #eef3f9 100%)",
};

const automationFocusCardStyle = {
  display: "grid",
  gap: "0.5rem",
  padding: "1.4rem",
  border: "1px solid #c7d7eb",
  borderRadius: "20px",
  background: "linear-gradient(135deg, #eff6ff 0%, #f8fbff 100%)",
};

const automationFocusTitleStyle = {
  margin: 0,
  color: "#101828",
};

const automationFocusBodyStyle = {
  margin: 0,
  color: "#36506d",
  lineHeight: 1.7,
  maxWidth: "66ch",
};

const automationFocusSubBodyStyle = {
  margin: 0,
  color: "#475467",
  lineHeight: 1.65,
  maxWidth: "62ch",
};

const recommendationEyebrowStyle = {
  color: "#365c8c",
  fontWeight: 700,
  fontSize: "0.8rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
};

const recommendationTitleStyle = {
  margin: "0.25rem 0 0",
  color: "#101828",
};

const recommendationBodyStyle = {
  margin: "0.45rem 0 0",
  color: "#475467",
  lineHeight: 1.7,
  maxWidth: "64ch",
};

const eliteTeaserStyle = {
  display: "grid",
  gap: "0.35rem",
  padding: "1rem",
  borderRadius: "16px",
  border: "1px solid #d7dde7",
  backgroundColor: "#ffffff",
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

const actionsCardStyle = {
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap" as const,
};

const primaryButtonStyle = (isDisabled: boolean) => ({
  border: 0,
  borderRadius: "12px",
  padding: "0.95rem 1.15rem",
  backgroundColor: isDisabled ? "#98a2b3" : "#101828",
  color: "#ffffff",
  fontWeight: 700,
  cursor: isDisabled ? "not-allowed" : "pointer",
});

const secondaryLinkStyle = {
  textDecoration: "none",
  padding: "0.95rem 1.15rem",
  borderRadius: "12px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#ffffff",
  color: "#344054",
  fontWeight: 700,
};

export default UpgradePage;
