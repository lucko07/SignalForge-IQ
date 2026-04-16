import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import {
  getAuthErrorMessage,
  reloadCurrentUser,
  resetPassword,
  sendCurrentUserVerificationEmail,
  signOut,
} from "../lib/auth";

function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser, loading, isEmailVerified, refreshAuthState } = useAuth();
  const [error, setError] = useState("");
  const [message, setMessage] = useState(getInitialMessage(searchParams.get("sent")));
  const [isResending, setIsResending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const nextPath = normalizeNextPath(searchParams.get("next"));
  const mode = searchParams.get("mode");

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!currentUser) {
      navigate(`/login?next=${encodeURIComponent(nextPath)}`, { replace: true });
      return;
    }

    if (isEmailVerified) {
      navigate(nextPath, { replace: true });
    }
  }, [currentUser, isEmailVerified, loading, navigate, nextPath]);

  const handleResend = async () => {
    setError("");
    setMessage("");
    setIsResending(true);

    try {
      await sendCurrentUserVerificationEmail();
      setMessage("Verification email sent. Check your inbox and spam folder.");
    } catch (resendError) {
      setError(getAuthErrorMessage(resendError));
    } finally {
      setIsResending(false);
    }
  };

  const handleRefresh = async () => {
    setError("");
    setMessage("");
    setIsRefreshing(true);

    try {
      const refreshedUser = await reloadCurrentUser();
      await refreshAuthState();

      if (refreshedUser?.emailVerified === true) {
        navigate(nextPath, { replace: true });
        return;
      }

      setMessage("Verification status is still pending. After you verify, click refresh again.");
    } catch (refreshError) {
      setError(getAuthErrorMessage(refreshError));
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!currentUser?.email) {
      setError("We could not find your email address for password reset.");
      return;
    }

    setError("");
    setMessage("");
    setIsSendingReset(true);

    try {
      await resetPassword(currentUser.email);
      setMessage("Password reset email sent. Check your inbox for the reset link.");
    } catch (resetError) {
      setError(getAuthErrorMessage(resetError));
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleSignOut = async () => {
    setError("");
    setIsSigningOut(true);

    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (signOutError) {
      setError(getAuthErrorMessage(signOutError));
    } finally {
      setIsSigningOut(false);
    }
  };

  if (loading) {
    return <section style={{ maxWidth: "720px", margin: "0 auto" }}>Checking your account...</section>;
  }

  return (
    <section style={pageStyle}>
      <div style={heroStyle}>
        <p style={eyebrowStyle}>Email Verification Required</p>
        <h1 style={titleStyle}>Verify your email before opening SignalForge IQ.</h1>
        <p style={bodyStyle}>
          We&apos;ve created your account and saved your profile details. Please verify{" "}
          <strong>{currentUser?.email ?? "your email address"}</strong> to continue.
        </p>
        {mode === "signup" ? (
          <p style={subtleBodyStyle}>
            After verification, you&apos;ll continue into the same legal-consent and access checks the app already uses.
          </p>
        ) : null}
      </div>

      <div style={cardStyle}>
        <div style={noticeStyle}>
          <strong style={{ color: "#101828" }}>What to do next</strong>
          <p style={{ margin: 0, color: "#475467", lineHeight: 1.7 }}>
            Open the verification email from Firebase Auth, confirm your address, then return here and refresh your status.
          </p>
        </div>

        {error ? <p style={errorBannerStyle}>{error}</p> : null}
        {message ? <p style={successBannerStyle}>{message}</p> : null}

        <div style={actionsGridStyle}>
          <button type="button" onClick={handleResend} disabled={isResending} style={primaryButtonStyle(isResending)}>
            {isResending ? "Sending..." : "Resend verification email"}
          </button>
          <button type="button" onClick={handleRefresh} disabled={isRefreshing} style={secondaryButtonStyle(isRefreshing)}>
            {isRefreshing ? "Refreshing..." : "Refresh verification status"}
          </button>
          <button type="button" onClick={handlePasswordReset} disabled={isSendingReset} style={secondaryButtonStyle(isSendingReset)}>
            {isSendingReset ? "Sending reset..." : "Send password reset"}
          </button>
          <button type="button" onClick={handleSignOut} disabled={isSigningOut} style={secondaryButtonStyle(isSigningOut)}>
            {isSigningOut ? "Signing out..." : "Sign out"}
          </button>
        </div>

        <p style={{ margin: 0, color: "#475467", lineHeight: 1.7 }}>
          Need a different account? <Link to="/signup" style={inlineLinkStyle}>Create another account</Link>.
        </p>
      </div>
    </section>
  );
}

const getInitialMessage = (sentFlag: string | null) => {
  if (sentFlag === "1") {
    return "Verification email sent. Check your inbox and spam folder.";
  }

  if (sentFlag === "0") {
    return "Your account is ready, but the verification email may need to be resent from this page.";
  }

  return "";
};

const normalizeNextPath = (value: string | null) => {
  if (!value || !value.startsWith("/")) {
    return "/dashboard";
  }

  if (value === "/verify-email") {
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

const bodyStyle = {
  margin: 0,
  color: "#475467",
  lineHeight: 1.7,
};

const subtleBodyStyle = {
  margin: 0,
  color: "#667085",
  lineHeight: 1.7,
};

const cardStyle = {
  display: "grid",
  gap: "1rem",
  padding: "1.5rem",
  borderRadius: "20px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#ffffff",
};

const noticeStyle = {
  display: "grid",
  gap: "0.45rem",
  padding: "1rem",
  borderRadius: "16px",
  backgroundColor: "#f8fafc",
  border: "1px solid #eaecf0",
};

const actionsGridStyle = {
  display: "grid",
  gap: "0.75rem",
};

const primaryButtonStyle = (isDisabled: boolean): CSSProperties => ({
  border: 0,
  borderRadius: "12px",
  padding: "0.95rem 1rem",
  backgroundColor: isDisabled ? "#98a2b3" : "#101828",
  color: "#ffffff",
  fontWeight: 700,
  cursor: isDisabled ? "not-allowed" : "pointer",
});

const secondaryButtonStyle = (isDisabled: boolean): CSSProperties => ({
  border: "1px solid #d0d5dd",
  borderRadius: "12px",
  padding: "0.95rem 1rem",
  backgroundColor: "#ffffff",
  color: isDisabled ? "#98a2b3" : "#344054",
  fontWeight: 700,
  cursor: isDisabled ? "not-allowed" : "pointer",
});

const errorBannerStyle = {
  margin: 0,
  padding: "0.85rem 1rem",
  borderRadius: "12px",
  backgroundColor: "#fef3f2",
  color: "#b42318",
};

const successBannerStyle = {
  margin: 0,
  padding: "0.85rem 1rem",
  borderRadius: "12px",
  backgroundColor: "#ecfdf3",
  color: "#027a48",
};

const inlineLinkStyle = {
  color: "#101828",
  fontWeight: 700,
};

export default VerifyEmailPage;
