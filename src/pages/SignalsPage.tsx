import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SignalCard from "../components/SignalCard";
import { useAuth } from "../context/auth-context";
import { subscribeToSignals } from "../lib/firestore";
import type { Signal } from "../lib/firestore";

const PUBLIC_PREVIEW_LIMIT = 3;

function SignalsPage() {
  const { currentUser, hasSubscriptionAccess, isAdmin } = useAuth();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const isSignedIn = Boolean(currentUser);
  const hasPremiumAccess = isAdmin || hasSubscriptionAccess;

  useEffect(() => {
    const unsubscribe = subscribeToSignals(
      (loadedSignals) => {
        setSignals(loadedSignals);
        setLoadError("");
        setIsLoading(false);
      },
      PUBLIC_PREVIEW_LIMIT,
      () => {
        setSignals([]);
        setLoadError("Recent signals are temporarily unavailable.");
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const hasSignals = signals.length > 0;

  return (
    <section
      style={{
        display: "grid",
        gap: "1.5rem",
        padding: "2rem 0",
      }}
    >
      <div
        style={{
          padding: "2rem",
          border: "1px solid #d6d9e0",
          borderRadius: "24px",
          backgroundColor: "#f8fafc",
        }}
      >
        <p
          style={{
            margin: "0 0 0.75rem",
            color: "#475467",
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            fontSize: "0.85rem",
          }}
        >
          Public signal preview
        </p>
        <h1 style={{ margin: "0 0 1rem", fontSize: "2.5rem" }}>Signals</h1>
        <p style={{ margin: 0, maxWidth: "720px" }}>
          A preview of recent trading signals. BTC Precision Engine remains selective by design, so signal flow
          depends on market conditions, setup quality, and confirmation rather than a fixed posting schedule.
        </p>
      </div>

      <div style={{ display: "grid", gap: "1rem" }}>
        <div>
          <h2 style={{ margin: "0 0 0.35rem", color: "#101828" }}>Recent Preview</h2>
          <p style={{ margin: 0, color: "#475467" }}>
            Showing up to {PUBLIC_PREVIEW_LIMIT} recent signals when available.
          </p>
        </div>

        {isLoading ? <p style={{ margin: 0 }}>Loading recent signals...</p> : null}

        {!isLoading && hasSignals ? (
          <div style={{ display: "grid", gap: "1rem" }}>
            {signals.map((signal) => (
              <SignalCard key={signal.id} signal={signal} />
            ))}
          </div>
        ) : null}

        {!isLoading && !hasSignals ? (
          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              padding: "1.5rem",
              border: "1px solid #d0d5dd",
              borderRadius: "20px",
              backgroundColor: "#ffffff",
            }}
          >
            <h2 style={{ margin: 0, color: "#101828" }}>No qualified setup detected.</h2>
            <p style={{ margin: 0, color: "#475467" }}>
              BTC Precision Engine is actively monitoring BTC. Signals appear when structure, trend, and
              confirmation align with the required quality threshold.
            </p>
            {loadError ? (
              <p style={{ margin: 0, color: "#b42318" }}>{loadError}</p>
            ) : null}
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              {hasPremiumAccess ? (
                <Link
                  to="/dashboard"
                  style={{
                    textDecoration: "none",
                    backgroundColor: "#101828",
                    color: "#ffffff",
                    padding: "0.9rem 1.2rem",
                    borderRadius: "12px",
                    fontWeight: 700,
                  }}
                >
                  Open dashboard
                </Link>
              ) : null}
              {isSignedIn && !hasPremiumAccess ? (
                <Link
                  to="/pricing"
                  style={{
                    textDecoration: "none",
                    backgroundColor: "#101828",
                    color: "#ffffff",
                    padding: "0.9rem 1.2rem",
                    borderRadius: "12px",
                    fontWeight: 700,
                  }}
                >
                  Unlock member access
                </Link>
              ) : null}
              {!isSignedIn ? (
                <>
                  <Link
                    to="/signup"
                    style={{
                      textDecoration: "none",
                      backgroundColor: "#101828",
                      color: "#ffffff",
                      padding: "0.9rem 1.2rem",
                      borderRadius: "12px",
                      fontWeight: 700,
                    }}
                  >
                    Sign up
                  </Link>
                  <Link
                    to="/login"
                    style={{
                      textDecoration: "none",
                      backgroundColor: "#ffffff",
                      color: "#101828",
                      padding: "0.9rem 1.2rem",
                      borderRadius: "12px",
                      border: "1px solid #d0d5dd",
                      fontWeight: 700,
                    }}
                  >
                    Log in
                  </Link>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div
        style={{
          padding: "1.5rem",
          border: "1px solid #d0d5dd",
          borderRadius: "20px",
          backgroundColor: "#101828",
          color: "#ffffff",
        }}
      >
        <h2 style={{ margin: "0 0 0.75rem", color: "#ffffff" }}>Members-Only Access</h2>
        <p style={{ margin: "0 0 1.25rem", color: "#d0d5dd" }}>
          Pro includes BTC Precision Engine, the protected dashboard, closed trade history, and performance tracking.
          Elite adds the execution layer with automation, routing, and delivery controls while BTC Momentum remains visible as an upcoming module.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {hasPremiumAccess ? (
            <Link
              to="/dashboard"
              style={{
                textDecoration: "none",
                backgroundColor: "#ffffff",
                color: "#101828",
                padding: "0.9rem 1.2rem",
                borderRadius: "12px",
                fontWeight: 700,
              }}
            >
              Open dashboard
            </Link>
          ) : null}
          {isSignedIn && !hasPremiumAccess ? (
            <>
              <Link
                to="/upgrade?plan=pro"
                style={{
                  textDecoration: "none",
                  backgroundColor: "#ffffff",
                  color: "#101828",
                  padding: "0.9rem 1.2rem",
                  borderRadius: "12px",
                  fontWeight: 700,
                }}
              >
                Upgrade to Pro
              </Link>
              <Link
                to="/pricing"
                style={{
                  textDecoration: "none",
                  backgroundColor: "transparent",
                  color: "#ffffff",
                  padding: "0.9rem 1.2rem",
                  borderRadius: "12px",
                  border: "1px solid #475467",
                  fontWeight: 700,
                }}
              >
                View plans
              </Link>
            </>
          ) : null}
          {!isSignedIn ? (
            <>
              <Link
                to="/signup"
                style={{
                  textDecoration: "none",
                  backgroundColor: "#ffffff",
                  color: "#101828",
                  padding: "0.9rem 1.2rem",
                  borderRadius: "12px",
                  fontWeight: 700,
                }}
              >
                Sign up
              </Link>
              <Link
                to="/login"
                style={{
                  textDecoration: "none",
                  backgroundColor: "transparent",
                  color: "#ffffff",
                  padding: "0.9rem 1.2rem",
                  borderRadius: "12px",
                  border: "1px solid #475467",
                  fontWeight: 700,
                }}
              >
                Log in
              </Link>
            </>
          ) : null}
        </div>
      </div>

    </section>
  );
}

export default SignalsPage;
