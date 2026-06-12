import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
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
      <Helmet>
        <title>Live Trading Signals | Crypto &amp; Stock Signals | SignalForge IQ</title>
        <meta
          name="description"
          content="Explore SignalForge IQ trading signals for crypto and stocks, with structured entries, risk management, and performance tracking."
        />
      </Helmet>
      <div
        style={{
          padding: "2rem",
          border: "1px solid var(--color-border)",
          borderRadius: "24px",
          backgroundColor: "var(--color-surface-alt)",
        }}
      >
        <p
          style={{
            margin: "0 0 0.75rem",
            color: "var(--color-text-muted)",
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
          A preview of recent trading signals from the live SignalForge IQ product lineup. Alongside BTC Precision
          Engine, BTC Continuation Engine is designed to identify structured Bitcoin continuation setups during
          directional market phases on the 30-minute timeframe.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gap: "0.9rem",
          padding: "1.5rem",
          border: "1px solid var(--color-border-strong)",
          borderRadius: "20px",
          backgroundColor: "var(--color-surface)",
        }}
      >
        <div style={{ display: "grid", gap: "0.35rem" }}>
          <p style={{ margin: 0, color: "var(--color-text-muted)", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", fontSize: "0.8rem" }}>
            BTC product
          </p>
          <h2 style={{ margin: 0, color: "var(--color-text-primary)" }}>BTC Continuation Engine</h2>
          <p style={{ margin: 0, color: "var(--color-text-muted)", lineHeight: 1.7, maxWidth: "760px" }}>
            SignalForge IQ&apos;s BTC Continuation Engine is designed to identify structured Bitcoin continuation setups
            during directional market phases, with clear entry, risk, and target levels for disciplined execution.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
          {[
            "BTC-focused continuation strategy",
            "Built around 30-minute market structure",
            "DD-control risk framework",
            "Clear entry, risk, and target levels",
            "Built for SignalForge IQ members",
          ].map((item) => (
            <div
              key={item}
              style={{
                padding: "0.95rem 1rem",
                borderRadius: "14px",
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-surface-alt)",
                color: "var(--color-button-secondary-text)",
                fontWeight: 600,
              }}
            >
              {item}
            </div>
          ))}
        </div>

        <p style={{ margin: 0, color: "var(--color-text-subtle)", lineHeight: 1.65 }}>
          Backtested on BTCUSD 30m. Backtested performance is not a guarantee of future results. Signals and tools are provided for informational and educational purposes only.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gap: "0.75rem",
          padding: "1.35rem",
          border: "1px solid var(--color-border-strong)",
          borderRadius: "20px",
          backgroundColor: "var(--color-surface-alt)",
        }}
      >
        <p style={{ margin: 0, color: "var(--color-text-muted)", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", fontSize: "0.8rem" }}>
          Crypto guide
        </p>
        <h2 style={{ margin: 0, color: "var(--color-text-primary)" }}>Crypto trading signals need more than alerts alone.</h2>
        <p style={{ margin: 0, color: "var(--color-text-muted)", lineHeight: 1.7, maxWidth: "72ch" }}>
          Read how SignalForge IQ approaches BTC-focused crypto signals with structured entries, risk management, and
          performance tracking built for 24/7 markets.
        </p>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <Link to="/crypto-trading-signals" style={{ textDecoration: "none", color: "var(--color-info-text)", fontWeight: 700 }}>
            Explore the crypto signals guide
          </Link>
          <Link to="/education" style={{ textDecoration: "none", color: "var(--color-text-muted)", fontWeight: 700 }}>
            Learn the framework
          </Link>
        </div>
      </div>

      <div style={{ display: "grid", gap: "1rem" }}>
        <div>
          <h2 style={{ margin: "0 0 0.35rem", color: "var(--color-text-primary)" }}>Recent Preview</h2>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
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
              border: "1px solid var(--color-border-strong)",
              borderRadius: "20px",
              backgroundColor: "var(--color-surface)",
            }}
          >
            <h2 style={{ margin: 0, color: "var(--color-text-primary)" }}>No qualified setup detected.</h2>
            <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
              The live product lineup is actively monitoring BTC strategies. Signals appear when structure, trend, and
              confirmation align with the required quality threshold for the active strategy.
            </p>
            {loadError ? (
              <p style={{ margin: 0, color: "var(--color-danger-text)" }}>{loadError}</p>
            ) : null}
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              {hasPremiumAccess ? (
                <Link
                  to="/dashboard"
                  style={{
                    textDecoration: "none",
                    backgroundColor: "var(--color-button-primary)",
                    color: "var(--color-button-primary-text)",
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
                    backgroundColor: "var(--color-button-primary)",
                    color: "var(--color-button-primary-text)",
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
                      backgroundColor: "var(--color-button-primary)",
                      color: "var(--color-button-primary-text)",
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
                      backgroundColor: "var(--color-button-secondary)",
                      color: "var(--color-button-secondary-text)",
                      padding: "0.9rem 1.2rem",
                      borderRadius: "12px",
                      border: "1px solid var(--color-border-strong)",
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
          border: "1px solid var(--color-border-strong)",
          borderRadius: "20px",
          backgroundColor: "#101828",
          color: "#ffffff",
        }}
      >
        <h2 style={{ margin: "0 0 0.75rem", color: "#ffffff" }}>Members-Only Access</h2>
        <p style={{ margin: "0 0 1.25rem", color: "#d0d5dd" }}>
          Pro includes BTC Precision Engine, BTC Continuation Engine, the protected dashboard, closed trade history,
          and performance tracking. Elite adds the execution layer with automation, routing, and delivery controls while BTC Momentum remains visible as an upcoming module.
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
