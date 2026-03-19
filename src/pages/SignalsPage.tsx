import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SignalCard from "../components/SignalCard";
import { subscribeToSignals } from "../lib/firestore";
import type { Signal } from "../lib/firestore";

const PUBLIC_PREVIEW_LIMIT = 3;

function SignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

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
          A preview of recent trading signals. Members unlock full access to the live dashboard.
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
            <h2 style={{ margin: 0, color: "#101828" }}>No live signals yet.</h2>
            <p style={{ margin: 0, color: "#475467" }}>
              The system is ready. Signals will appear here as they become available.
            </p>
            {loadError ? (
              <p style={{ margin: 0, color: "#b42318" }}>{loadError}</p>
            ) : null}
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
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
          Full signal history stays inside the protected dashboard. Sign up or log in
          to access the live member view.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
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
        </div>
      </div>
    </section>
  );
}

export default SignalsPage;
