import { useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import LegalConsentField from "../components/LegalConsentField";
import { useAuth } from "../context/auth-context";
import { getAuthErrorMessage, signUp } from "../lib/auth";
import { CURRENT_TERMS_VERSION } from "../lib/userProfiles";

function SignupPage() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const requestedPlan = searchParams.get("plan")?.trim().toLowerCase();
  const requestedPlanLabel =
    requestedPlan === "pro" || requestedPlan === "elite" ? requestedPlan : null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!fullName.trim()) {
      setError("Enter your full name.");
      return;
    }

    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }

    if (!password) {
      setError("Enter your password.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!acceptedLegal) {
      setError("You must accept Terms to continue");
      return;
    }

    setIsSubmitting(true);

    try {
      await signUp(email.trim(), password, fullName.trim(), {
        acceptLegal: true,
        termsVersion: CURRENT_TERMS_VERSION,
      });
      await refreshProfile();
      navigate("/dashboard");
    } catch (signupError) {
      setError(getAuthErrorMessage(signupError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section style={{ maxWidth: "520px", margin: "0 auto" }}>
      <h1>Signup</h1>
      <p>Create your account to access your dashboard and future member features.</p>
      {requestedPlanLabel ? (
        <p style={{ color: "#475467" }}>
          Selected plan: <strong>{requestedPlanLabel}</strong>. Account creation still starts on
          the Free plan until membership activation is completed.
        </p>
      ) : null}

      <form
        onSubmit={handleSubmit}
        style={{
          display: "grid",
          gap: "1rem",
          padding: "1.5rem",
          border: "1px solid #d0d5dd",
          borderRadius: "16px",
          backgroundColor: "#f8fafc",
        }}
      >
        <label style={{ display: "grid", gap: "0.4rem" }}>
          <span style={{ color: "#344054", fontWeight: 600 }}>Full name</span>
          <input
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Jane Smith"
            autoComplete="name"
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: "0.4rem" }}>
          <span style={{ color: "#344054", fontWeight: 600 }}>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: "0.4rem" }}>
          <span style={{ color: "#344054", fontWeight: 600 }}>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 6 characters"
            autoComplete="new-password"
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: "0.4rem" }}>
          <span style={{ color: "#344054", fontWeight: 600 }}>Confirm password</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Re-enter your password"
            autoComplete="new-password"
            style={inputStyle}
          />
        </label>

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

        {error && error !== "You must accept Terms to continue" ? (
          <p
            style={{
              margin: 0,
              padding: "0.85rem 1rem",
              borderRadius: "12px",
              backgroundColor: "#fef3f2",
              color: "#b42318",
            }}
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting || !acceptedLegal}
          style={{
            border: 0,
            borderRadius: "12px",
            padding: "0.95rem 1rem",
            backgroundColor: isSubmitting || !acceptedLegal ? "#98a2b3" : "#101828",
            color: "#ffffff",
            fontWeight: 700,
            cursor: isSubmitting || !acceptedLegal ? "not-allowed" : "pointer",
          }}
        >
          {isSubmitting ? "Creating account..." : "Create account"}
        </button>

        <p style={{ margin: 0 }}>
          Already have an account?{" "}
          <Link
            to={requestedPlanLabel ? `/login?plan=${requestedPlanLabel}` : "/login"}
            style={{ color: "#101828", fontWeight: 700 }}
          >
            Log in
          </Link>
        </p>
      </form>
    </section>
  );
}

const inputStyle = {
  width: "100%",
  padding: "0.85rem 0.9rem",
  borderRadius: "12px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#ffffff",
  fontSize: "1rem",
} satisfies CSSProperties;

export default SignupPage;
