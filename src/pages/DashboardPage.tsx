import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SignalCard from "../components/SignalCard";
import { useAuth } from "../context/AuthProvider";
import { logout } from "../lib/auth";
import { getSignals, getUserProfile } from "../lib/firestore";
import type { Signal } from "../lib/firestore";

type DashboardProfile = {
  plan: string;
  role: string;
};

function DashboardPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState<DashboardProfile>({
    plan: "free",
    role: "member",
  });
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [isSignalsLoading, setIsSignalsLoading] = useState(true);
  const [usingFallbackSignals, setUsingFallbackSignals] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      if (!currentUser) {
        return;
      }

      try {
        const userProfile = await getUserProfile(currentUser.uid);

        if (userProfile && isMounted) {
          setProfile({
            plan: userProfile.plan,
            role: userProfile.role,
          });
        }
      } finally {
        if (isMounted) {
          setIsProfileLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  useEffect(() => {
    let isMounted = true;

    const loadSignals = async () => {
      try {
        const loadedSignals = await getSignals();

        if (!isMounted) {
          return;
        }

        if (loadedSignals.length === 0) {
          setSignals(sampleSignals);
          setUsingFallbackSignals(true);
          return;
        }

        setSignals(loadedSignals);
        setUsingFallbackSignals(false);
      } catch {
        if (isMounted) {
          setSignals(sampleSignals);
          setUsingFallbackSignals(true);
        }
      } finally {
        if (isMounted) {
          setIsSignalsLoading(false);
        }
      }
    };

    void loadSignals();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await logout();
      navigate("/login", { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <section
      style={{
        maxWidth: "860px",
        margin: "0 auto",
        display: "grid",
        gap: "1.25rem",
      }}
    >
      <h1>Dashboard</h1>
      <div
        style={{
          padding: "1.5rem",
          border: "1px solid #d0d5dd",
          borderRadius: "16px",
          backgroundColor: "#f8fafc",
        }}
      >
        <p style={{ marginTop: 0 }}>
          Welcome{currentUser?.displayName ? `, ${currentUser.displayName}` : ""}.
        </p>
        <p style={{ margin: "0.5rem 0" }}>
          <strong>Email:</strong> {currentUser?.email ?? "Unavailable"}
        </p>
        <p style={{ margin: "0.5rem 0" }}>
          <strong>Plan:</strong> {isProfileLoading ? "Loading..." : profile.plan}
        </p>
        <p style={{ margin: "0.5rem 0 1.25rem" }}>
          <strong>Role:</strong> {isProfileLoading ? "Loading..." : profile.role}
        </p>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          style={{
            border: 0,
            borderRadius: "12px",
            padding: "0.9rem 1.1rem",
            backgroundColor: isLoggingOut ? "#98a2b3" : "#101828",
            color: "#ffffff",
            fontWeight: 700,
            cursor: isLoggingOut ? "not-allowed" : "pointer",
          }}
        >
          {isLoggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>

      <div
        style={{
          padding: "1.5rem",
          border: "1px solid #d0d5dd",
          borderRadius: "16px",
          backgroundColor: "#f8fafc",
        }}
      >
        <div style={{ marginBottom: "1rem" }}>
          <h2 style={{ margin: 0, color: "#101828" }}>Trading Signals</h2>
          <p style={{ margin: "0.4rem 0 0" }}>
            Latest signals from the `signals` Firestore collection.
          </p>
        </div>

        {isSignalsLoading ? <p style={{ margin: 0 }}>Loading signals...</p> : null}

        {!isSignalsLoading && usingFallbackSignals ? (
          <div
            style={{
              marginBottom: "1rem",
              padding: "0.9rem 1rem",
              borderRadius: "12px",
              backgroundColor: "#fffaeb",
              color: "#b54708",
            }}
          >
            <strong>No signals available yet.</strong> Showing sample signals so the
            dashboard layout is visible.
          </div>
        ) : null}

        {!isSignalsLoading && signals.length === 0 ? (
          <p style={{ margin: 0 }}>No signals available yet.</p>
        ) : null}

        {!isSignalsLoading && signals.length > 0 ? (
          <div style={{ display: "grid", gap: "1rem" }}>
            {signals.map((signal) => (
              <SignalCard key={signal.id} signal={signal} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

const sampleSignals: Signal[] = [
  {
    id: "sample-btc-long",
    symbol: "BTC",
    assetType: "crypto",
    direction: "LONG",
    entry: "42000",
    stopLoss: "41000",
    target: "45000",
    thesis: "Breakout above resistance with momentum building on higher volume.",
    status: "ACTIVE",
  },
  {
    id: "sample-eurusd-short",
    symbol: "EURUSD",
    assetType: "forex",
    direction: "SHORT",
    entry: "1.0910",
    stopLoss: "1.0965",
    target: "1.0825",
    thesis: "Price rejected key supply zone and is fading below intraday structure.",
    status: "ACTIVE",
  },
];

export default DashboardPage;
