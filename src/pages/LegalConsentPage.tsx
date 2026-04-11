import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import LegalConsentField from "../components/LegalConsentField";
import { acceptLegalDocuments, CURRENT_TERMS_VERSION } from "../lib/userProfiles";

function LegalConsentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser, hasLegalConsent, loading, refreshProfile } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nextPath = normalizeNextPath(searchParams.get("next"));

  useEffect(() => {
    if (!loading && currentUser && hasLegalConsent) {
      navigate(nextPath, { replace: true });
    }
  }, [currentUser, hasLegalConsent, loading, navigate, nextPath]);

  const handleSubmit = async () => {
    setError("");

    if (!accepted) {
      setError("You must accept Terms to continue");
      return;
    }

    if (!currentUser) {
      setError("Sign in to continue.");
      return;
    }

    setIsSubmitting(true);

    try {
      await acceptLegalDocuments(currentUser.uid, CURRENT_TERMS_VERSION);
      await refreshProfile();
      navigate(nextPath, { replace: true });
    } catch (error) {
      setError("We could not record your legal acceptance. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <section style={pageStyle}>
      <div style={heroStyle}>
        <p style={eyebrowStyle}>Legal Consent Required</p>
        <h1 style={titleStyle}>Accept the current Terms and Privacy Policy to continue.</h1>
        <p style={heroBodyStyle}>
          SignalForge IQ requires an active record of your acceptance before protected account
          access and paid membership flows can continue.
        </p>
      </div>

      <div style={cardStyle}>
        <div style={{ display: "grid", gap: "0.65rem" }}>
          <h2 style={sectionTitleStyle}>Terms summary</h2>
          <p style={bodyStyle}>
            SignalForge IQ provides trading signals, dashboards, and educational content for
            informational use only. Trading involves risk, results are not guaranteed, and you
            remain responsible for your own decisions and account use.
          </p>
        </div>

        <div style={{ display: "grid", gap: "0.65rem" }}>
          <h2 style={sectionTitleStyle}>Privacy summary</h2>
          <p style={bodyStyle}>
            SignalForge IQ uses account, billing, support, and service activity information to run
            the service, protect accounts, support subscriptions, and improve the member experience.
          </p>
        </div>

        <LegalConsentField checked={accepted} onChange={setAccepted} error={error} />

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          style={primaryButtonStyle(isSubmitting)}
        >
          {isSubmitting ? "Saving acceptance..." : "Accept and continue"}
        </button>
      </div>
    </section>
  );
}

const normalizeNextPath = (value: string | null) => {
  if (!value || !value.startsWith("/")) {
    return "/dashboard";
  }

  if (value === "/legal-consent") {
    return "/dashboard";
  }

  return value;
};

const pageStyle = {
  maxWidth: "760px",
  margin: "0 auto",
  display: "grid",
  gap: "1rem",
};

const heroStyle = {
  display: "grid",
  gap: "0.75rem",
  padding: "1.75rem",
  borderRadius: "22px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#f8fafc",
};

const eyebrowStyle = {
  margin: 0,
  color: "#475467",
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  fontSize: "0.82rem",
};

const titleStyle = {
  margin: 0,
  color: "#101828",
};

const heroBodyStyle = {
  margin: 0,
  color: "#475467",
  lineHeight: 1.7,
};

const cardStyle = {
  display: "grid",
  gap: "1.1rem",
  padding: "1.5rem",
  borderRadius: "20px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#ffffff",
};

const sectionTitleStyle = {
  margin: 0,
  color: "#101828",
  fontSize: "1.05rem",
};

const bodyStyle = {
  margin: 0,
  color: "#475467",
  lineHeight: 1.7,
};

const primaryButtonStyle = (isDisabled: boolean) => ({
  border: 0,
  borderRadius: "12px",
  padding: "0.95rem 1rem",
  backgroundColor: isDisabled ? "#98a2b3" : "#101828",
  color: "#ffffff",
  fontWeight: 700,
  cursor: isDisabled ? "not-allowed" : "pointer",
});

export default LegalConsentPage;
