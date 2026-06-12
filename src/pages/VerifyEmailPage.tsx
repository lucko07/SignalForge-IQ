import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { applyActionCode, checkActionCode, reload } from "firebase/auth";
import { useAuth } from "../context/auth-context";
import {
  getAuthErrorMessage,
  reloadCurrentUser,
  resetPassword,
  sendCurrentUserVerificationEmail,
  signOut,
} from "../lib/auth";
import { auth } from "../lib/firebase";
import {
  getEmailActionParams,
  getSafeRedirectTarget,
  hasEmailActionParams,
} from "../lib/authActionLinks";

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
  const [actionStatus, setActionStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const actionHandledRef = useRef(false);
  const redirectTimeoutRef = useRef<number | null>(null);
  const currentHref = typeof window === "undefined"
    ? "https://signalforgeiq.com/verify-email"
    : window.location.href;
  const actionParams = getEmailActionParams(currentHref);
  const hasActionRequest = hasEmailActionParams(actionParams);
  const nextPath = getSafeRedirectTarget({
    next: searchParams.get("next"),
    continueUrl: searchParams.get("continueUrl"),
  });
  const actionRedirectPath = getSafeRedirectTarget({
    next: actionParams.next,
    continueUrl: actionParams.continueUrl,
  });
  const mode = searchParams.get("mode");

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current !== null) {
        window.clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (hasActionRequest) {
      return;
    }

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
  }, [currentUser, hasActionRequest, isEmailVerified, loading, navigate, nextPath]);

  useEffect(() => {
    if (!hasActionRequest || actionHandledRef.current) {
      return;
    }

    actionHandledRef.current = true;

    if (actionParams.normalizedMode !== "verifyEmail") {
      setActionStatus("error");
      setActionError("This verification link is not supported. Request a new verification email and try again.");
      return;
    }

    if (!actionParams.oobCode) {
      setActionStatus("error");
      setActionError("This verification link is invalid or has expired.");
      return;
    }

    let isCancelled = false;

    const verifyEmailAction = async () => {
      setActionStatus("loading");
      setActionMessage("Verifying your email...");
      setActionError("");

      try {
        await checkActionCode(auth, actionParams.oobCode as string);
        await applyActionCode(auth, actionParams.oobCode as string);

        if (auth.currentUser) {
          await reload(auth.currentUser);
        }

        await refreshAuthState().catch(() => undefined);

        if (isCancelled) {
          return;
        }

        setActionStatus("success");
        setActionMessage("Your email has been verified. Redirecting to your dashboard...");
        redirectTimeoutRef.current = window.setTimeout(() => {
          navigate(actionRedirectPath, { replace: true });
        }, 1400);
      } catch (verificationError) {
        const details = verificationError as { code?: unknown; message?: unknown };
        console.error("[verify-email] action failed", {
          code: typeof details.code === "string" ? details.code : undefined,
          message: typeof details.message === "string" ? details.message : String(verificationError),
          mode: actionParams.mode,
        });

        if (isCancelled) {
          return;
        }

        setActionStatus("error");
        setActionError(getEmailActionErrorMessage(verificationError));
      }
    };

    void verifyEmailAction();

    return () => {
      isCancelled = true;
    };
  }, [
    actionParams.mode,
    actionParams.normalizedMode,
    actionParams.oobCode,
    actionRedirectPath,
    hasActionRequest,
    navigate,
    refreshAuthState,
  ]);

  const handleResend = async () => {
    setError("");
    setMessage("");
    setActionError("");
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

  const handleReturnToVerificationGate = () => {
    navigate(`/verify-email?next=${encodeURIComponent(actionRedirectPath)}`, { replace: true });
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

  if (hasActionRequest) {
    return (
      <section style={pageStyle}>
        <div style={heroStyle}>
          <p style={eyebrowStyle}>SignalForge IQ</p>
          <h1 style={titleStyle}>Email verification</h1>
          <p style={bodyStyle}>
            We&apos;re confirming your email so you can continue into your account securely.
          </p>
        </div>

        <div style={cardStyle}>
          {actionStatus === "loading" || actionStatus === "idle" ? (
            <div style={statusBlockStyle}>
              <p style={statusTitleStyle}>Verifying your email...</p>
              <p style={statusBodyStyle}>
                {actionMessage || "Please wait while we confirm your access and prepare your next step."}
              </p>
            </div>
          ) : null}

          {actionStatus === "success" ? (
            <div style={successNoticeStyle}>
              <p style={statusTitleStyle}>Your email has been verified.</p>
              <p style={statusBodyStyle}>
                {actionMessage || "Redirecting to your dashboard..."}
              </p>
            </div>
          ) : null}

          {actionMessage && actionStatus === "error" ? (
            <p style={successBannerStyle}>{actionMessage}</p>
          ) : null}

          {actionStatus === "error" ? (
            <>
              <p style={errorBannerStyle}>{actionError}</p>
              <div style={actionsGridStyle}>
                <button
                  type="button"
                  onClick={currentUser ? handleResend : handleReturnToVerificationGate}
                  disabled={isResending}
                  style={primaryButtonStyle(isResending)}
                >
                  {isResending ? "Sending..." : "Resend verification email"}
                </button>
                <Link to={`/login?next=${encodeURIComponent(actionRedirectPath)}`} style={linkButtonStyle}>
                  Back to login
                </Link>
              </div>
            </>
          ) : null}
        </div>
      </section>
    );
  }

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
            Check your inbox for the verification email, confirm your address, then return here and refresh your status.
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

const getEmailActionErrorMessage = (error: unknown) => {
  const code = (error as { code?: string } | undefined)?.code;

  switch (code) {
    case "auth/expired-action-code":
    case "auth/invalid-action-code":
      return "This verification link is invalid or has expired.";
    case "auth/user-disabled":
      return "This account is currently unavailable. Please contact support if you need help.";
    case "auth/user-not-found":
      return "We could not find the account for this verification link.";
    default:
      return "We couldn't complete email verification right now. Request a new verification email and try again.";
  }
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

const statusBlockStyle = {
  display: "grid",
  gap: "0.5rem",
  padding: "1.25rem",
  borderRadius: "16px",
  border: "1px solid #eaecf0",
  backgroundColor: "#f8fafc",
};

const successNoticeStyle = {
  display: "grid",
  gap: "0.5rem",
  padding: "1.25rem",
  borderRadius: "16px",
  border: "1px solid #abefc6",
  backgroundColor: "#ecfdf3",
};

const statusTitleStyle = {
  margin: 0,
  color: "#101828",
  fontSize: "1.05rem",
  fontWeight: 700,
};

const statusBodyStyle = {
  margin: 0,
  color: "#475467",
  lineHeight: 1.7,
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

const linkButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #d0d5dd",
  borderRadius: "12px",
  padding: "0.95rem 1rem",
  backgroundColor: "#ffffff",
  color: "#344054",
  fontWeight: 700,
  textDecoration: "none",
};

export default VerifyEmailPage;
