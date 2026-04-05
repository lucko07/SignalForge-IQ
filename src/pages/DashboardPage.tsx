import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import type { Timestamp } from "firebase/firestore";
import SignalCard from "../components/SignalCard";
import TradingDisclaimer from "../components/TradingDisclaimer";
import { useAuth } from "../context/auth-context";
import { signOut } from "../lib/auth";
import { openBillingPortal } from "../lib/billing";
import {
  getPerformanceSummary,
  subscribeToSignals,
} from "../lib/firestore";
import type { PerformanceSummary, Signal } from "../lib/firestore";
import { isStripeManagedUser, normalizeManagedPlan } from "../lib/userProfiles";

type AccountStatusBannerState = {
  tone: "admin" | "neutral" | "success" | "warning";
  message: string;
};

function DashboardPage() {
  return (
    <section
      style={{
        maxWidth: "860px",
        margin: "0 auto",
        display: "grid",
        gap: "1.25rem",
      }}
    >
      <Outlet />
    </section>
  );
}

export function DashboardHomeContent() {
  const navigate = useNavigate();
  const {
    currentUser,
    profile,
    loading,
    hasSubscriptionAccess,
    isAdmin,
  } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isOpeningBillingPortal, setIsOpeningBillingPortal] = useState(false);
  const [liveSignals, setLiveSignals] = useState<Signal[]>([]);
  const [isSignalsLoading, setIsSignalsLoading] = useState(true);
  const [signalsError, setSignalsError] = useState("");
  const [performanceSummary, setPerformanceSummary] = useState<PerformanceSummary>({
    totalClosedSignals: 0,
    wins: 0,
    losses: 0,
    breakevenCount: 0,
    cancelledCount: 0,
    winRate: 0,
    averagePnlPercent: 0,
  });
  const [isPerformanceLoading, setIsPerformanceLoading] = useState(true);
  const [performanceError, setPerformanceError] = useState("");
  const [billingActionError, setBillingActionError] = useState("");

  useEffect(() => {
    if (!hasSubscriptionAccess) {
      setLiveSignals([]);
      setSignalsError("");
      setIsSignalsLoading(false);
      return undefined;
    }

    const unsubscribe = subscribeToSignals(
      (loadedSignals) => {
        setLiveSignals(loadedSignals);
        setSignalsError("");
        setIsSignalsLoading(false);
      },
      undefined,
      () => {
        setLiveSignals([]);
        setSignalsError("Unable to load signals right now. Please try again shortly.");
        setIsSignalsLoading(false);
      }
    );

    return unsubscribe;
  }, [hasSubscriptionAccess]);

  useEffect(() => {
    if (!hasSubscriptionAccess) {
      setPerformanceSummary({
        totalClosedSignals: 0,
        wins: 0,
        losses: 0,
        breakevenCount: 0,
        cancelledCount: 0,
        winRate: 0,
        averagePnlPercent: 0,
      });
      setPerformanceError("");
      setIsPerformanceLoading(false);
      return;
    }

    let isMounted = true;

    const loadPerformanceSummary = async () => {
      try {
        const summary = await getPerformanceSummary();

        if (isMounted) {
          setPerformanceSummary(summary);
          setPerformanceError("");
        }
      } catch {
        if (isMounted) {
          setPerformanceError("Unable to load performance summary right now.");
        }
      } finally {
        if (isMounted) {
          setIsPerformanceLoading(false);
        }
      }
    };

    void loadPerformanceSummary();

    return () => {
      isMounted = false;
    };
  }, [hasSubscriptionAccess, liveSignals]);

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await signOut();
      navigate("/login", { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleManageSubscription = async () => {
    setBillingActionError("");
    setIsOpeningBillingPortal(true);

    try {
      await openBillingPortal();
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "Unable to open billing management right now.";
      setBillingActionError(message);
      setIsOpeningBillingPortal(false);
    }
  };

  const usingFallbackSignals = !isSignalsLoading && liveSignals.length === 0;
  const visibleSignals = liveSignals.length > 0 ? liveSignals : sampleSignals;
  const recentClosedSignals = liveSignals
    .filter((signal) => signal.status === "CLOSED" || signal.status === "CANCELLED")
    .slice(0, 5);
  const managedPlan = normalizeManagedPlan(profile?.currentPlan ?? profile?.plan ?? "free");
  const membershipLabel = isAdmin
    ? "Administrator"
    : hasSubscriptionAccess
      ? `${capitalizePlan(managedPlan)} member`
      : "Free member";
  const accountStatusBanner = getAccountStatusBannerState(profile, loading);

  return (
    <>
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
          <strong>Plan:</strong> {loading ? "Loading..." : managedPlan}
        </p>
        <p style={{ margin: "0.5rem 0 1.25rem" }}>
          <strong>Access:</strong> {loading ? "Loading..." : membershipLabel}
        </p>
        {!loading ? (
          <p style={{ margin: "0 0 1.25rem", color: "#475467" }}>
            {isAdmin
              ? "You can manage member access and review signals from this account."
              : "Authentication is managed by Firebase Auth, while your plan and access metadata come from Firestore."}
          </p>
        ) : null}
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

      <div style={accountStatusBannerStyle(accountStatusBanner.tone)}>
        <strong style={{ fontSize: "1rem" }}>Account status</strong>
        <p style={{ margin: 0 }}>{accountStatusBanner.message}</p>
      </div>

      <div style={sectionCardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={{ margin: 0, color: "#101828" }}>Performance Center</h2>
            <p style={{ margin: "0.4rem 0 0", color: "#475467" }}>
              Open the member track record pages for overview metrics, trades, and deeper analytics.
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link to="/dashboard/performance" style={secondaryLinkStyle}>
            Performance overview
          </Link>
          <Link to="/dashboard/trades" style={secondaryLinkStyle}>
            Trades
          </Link>
          <Link to="/dashboard/analytics" style={secondaryLinkStyle}>
            Analytics
          </Link>
        </div>
        {!hasSubscriptionAccess ? <UpgradePrompt /> : null}
      </div>

      {isAdmin ? (
        <div
          style={{
            padding: "1.5rem",
            border: "1px solid #d0d5dd",
            borderRadius: "16px",
            backgroundColor: "#f8fafc",
            display: "grid",
            gap: "1rem",
          }}
        >
          <div>
            <h2 style={{ margin: 0, color: "#101828" }}>Administration</h2>
            <p style={{ margin: "0.4rem 0 0", color: "#475467" }}>
              Review pending signals and manage what appears in the live feed.
            </p>
          </div>

          <div style={statsGridStyle}>
            <StatCard label="Role" value="Administrator" />
            <StatCard label="Signal Review" value="Available" />
            <StatCard label="Member Access" value="Full" />
          </div>

          <div style={billingNoticeStyle}>
            <strong>Review queue</strong>
            <p style={{ margin: 0 }}>
              Open the review workspace to approve, reject, and manage signal status updates.
            </p>
            <div>
              <Link to="/admin/signals" style={secondaryLinkStyle}>
                Open signal review
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: "1.5rem",
            border: "1px solid #d0d5dd",
            borderRadius: "16px",
            backgroundColor: "#f8fafc",
            display: "grid",
            gap: "1rem",
          }}
        >
          <div>
            <h2 style={{ margin: 0, color: "#101828" }}>Billing</h2>
            <p style={{ margin: "0.4rem 0 0", color: "#475467" }}>
              Your plan access and billing status are shown here.
            </p>
            <p style={{ margin: "0.4rem 0 0", color: "#667085" }}>
              Pro includes protected member-only signal access. Elite remains available as a
              billing tier while the core access model stays clean and predictable.
            </p>
          </div>

          <div style={statsGridStyle}>
            <StatCard label="Current Plan" value={loading ? "Loading..." : managedPlan} />
            <StatCard label="Billing Status" value={loading ? "Loading..." : (profile?.billingStatus ?? "Not billed")} />
            <StatCard
              label="Membership Access"
              value={loading ? "Loading..." : (hasSubscriptionAccess ? "Active" : "Upgrade required")}
            />
            <StatCard
              label="Billing Setup"
              value={loading ? "Loading..." : (profile?.stripeCustomerId ? "Connected" : "Not linked")}
            />
          </div>

          {isStripeManagedUser(profile) ? (
            <div style={billingNoticeStyle}>
              <strong>Billing Management</strong>
              <p style={{ margin: 0 }}>
                Manage your payment method, update your plan, or cancel your subscription.
              </p>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={handleManageSubscription}
                  disabled={isOpeningBillingPortal}
                  style={portalButtonStyle(isOpeningBillingPortal)}
                >
                  {isOpeningBillingPortal ? "Opening billing..." : "Manage subscription"}
                </button>
                {managedPlan === "pro" ? (
                  <Link to="/upgrade?plan=elite" style={secondaryLinkStyle}>
                    Upgrade to Elite
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          {billingActionError ? (
            <p style={{ margin: 0, color: "#b42318", fontWeight: 700 }}>{billingActionError}</p>
          ) : null}
        </div>
      )}

      <section style={sectionCardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={{ margin: 0, color: "#101828" }}>Performance Summary</h2>
            <p style={{ margin: "0.4rem 0 0", color: "#475467" }}>
              {hasSubscriptionAccess
                ? "Closed-signal performance based on stored outcomes and realized PnL."
                : "Upgrade to Pro to unlock member-only performance history."}
            </p>
          </div>
        </div>

        {!hasSubscriptionAccess ? <UpgradePrompt /> : null}
        {hasSubscriptionAccess && isPerformanceLoading ? <p style={{ margin: 0 }}>Loading performance summary...</p> : null}

        {hasSubscriptionAccess && !isPerformanceLoading ? (
          <div style={statsGridStyle}>
            <StatCard label="Closed Signals" value={String(performanceSummary.totalClosedSignals)} />
            <StatCard label="Win Rate" value={`${performanceSummary.winRate.toFixed(2)}%`} />
            <StatCard label="Wins" value={String(performanceSummary.wins)} />
            <StatCard label="Losses" value={String(performanceSummary.losses)} />
            <StatCard label="Breakeven" value={String(performanceSummary.breakevenCount)} />
            <StatCard
              label="Average PnL"
              value={`${performanceSummary.averagePnlPercent > 0 ? "+" : ""}${performanceSummary.averagePnlPercent.toFixed(2)}%`}
            />
          </div>
        ) : null}

        {hasSubscriptionAccess && performanceError ? (
          <p style={{ margin: "1rem 0 0", color: "#b42318" }}>{performanceError}</p>
        ) : null}
      </section>

      <section style={sectionCardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={{ margin: 0, color: "#101828" }}>Trading Signals</h2>
            <p style={{ margin: "0.4rem 0 0", color: "#475467" }}>
              {hasSubscriptionAccess
                ? "Live signals are shown here first."
                : "Upgrade to Pro to unlock the full member signal feed."}
            </p>
          </div>
          {hasSubscriptionAccess && !isSignalsLoading && liveSignals.length > 0 ? (
            <span
              style={{
                padding: "0.4rem 0.75rem",
                borderRadius: "999px",
                backgroundColor: "#ecfdf3",
                color: "#027a48",
                fontWeight: 700,
                fontSize: "0.85rem",
              }}
            >
              {liveSignals.length} live signal{liveSignals.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>

        {!hasSubscriptionAccess ? <UpgradePrompt /> : null}
        {hasSubscriptionAccess && isSignalsLoading ? <p style={{ margin: 0 }}>Loading signals...</p> : null}

        {hasSubscriptionAccess && !isSignalsLoading && usingFallbackSignals ? (
          <div
            style={{
              display: "grid",
              gap: "0.5rem",
              marginBottom: "1rem",
              padding: "1rem",
              borderRadius: "12px",
              backgroundColor: "#fffaeb",
              color: "#b54708",
            }}
          >
            <strong>No live signals yet.</strong>
            <p style={{ margin: 0 }}>
              The system is ready. Signals will appear here as they become available.
            </p>
            {signalsError ? <p style={{ margin: 0 }}>{signalsError}</p> : null}
          </div>
        ) : null}

        {hasSubscriptionAccess && !isSignalsLoading && visibleSignals.length > 0 ? (
          <div style={{ display: "grid", gap: "1rem" }}>
            {visibleSignals.map((signal) => (
              <SignalCard key={signal.id} signal={signal} />
            ))}
          </div>
        ) : null}

        <div style={{ marginTop: "1rem" }}>
          <TradingDisclaimer />
        </div>
      </section>

      <section style={sectionCardStyle}>
        <div style={{ marginBottom: "1rem" }}>
          <h2 style={{ margin: 0, color: "#101828" }}>Recent Closed Signals</h2>
          <p style={{ margin: "0.4rem 0 0", color: "#475467" }}>
            {hasSubscriptionAccess
              ? "Most recent closed or cancelled trades from the live signal feed."
              : "Upgrade to Pro to unlock closed trade history."}
          </p>
        </div>

        {!hasSubscriptionAccess ? <UpgradePrompt /> : null}

        {hasSubscriptionAccess && !isSignalsLoading && recentClosedSignals.length > 0 ? (
          <div style={{ display: "grid", gap: "1rem" }}>
            {recentClosedSignals.map((signal) => (
              <SignalCard key={`closed-${signal.id}`} signal={signal} />
            ))}
          </div>
        ) : null}

        {hasSubscriptionAccess && !isSignalsLoading && recentClosedSignals.length === 0 ? (
          <p style={{ margin: 0, color: "#475467" }}>
            No closed signals yet. Closed trades will appear here once outcomes are recorded.
          </p>
        ) : null}
      </section>
    </>
  );
}

function UpgradePrompt() {
  return (
    <div style={billingNoticeStyle}>
      <strong>Member access required</strong>
      <p style={{ margin: 0 }}>
        Your account is authenticated, but this section is reserved for active Pro members.
      </p>
      <div>
        <Link to="/pricing" style={secondaryLinkStyle}>
          View plans
        </Link>
      </div>
    </div>
  );
}

type StatCardProps = {
  label: string;
  value: string;
};

function StatCard({ label, value }: StatCardProps) {
  return (
    <div
      style={{
        padding: "1rem",
        borderRadius: "14px",
        backgroundColor: "#ffffff",
        border: "1px solid #eaecf0",
        display: "grid",
        gap: "0.35rem",
      }}
    >
      <span style={{ color: "#475467", fontSize: "0.85rem", fontWeight: 600 }}>{label}</span>
      <strong style={{ color: "#101828", fontSize: "1.25rem" }}>{value}</strong>
    </div>
  );
}

const sectionCardStyle = {
  padding: "1.5rem",
  border: "1px solid #d0d5dd",
  borderRadius: "16px",
  backgroundColor: "#f8fafc",
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "1rem",
  flexWrap: "wrap" as const,
  marginBottom: "1rem",
};

const statsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: "0.75rem",
};

const billingNoticeStyle = {
  display: "grid",
  gap: "0.75rem",
  padding: "1rem",
  borderRadius: "14px",
  border: "1px solid #eaecf0",
  backgroundColor: "#ffffff",
  color: "#344054",
};

const accountStatusBannerStyle = (tone: AccountStatusBannerState["tone"]) => {
  if (tone === "admin") {
    return {
      display: "grid",
      gap: "0.5rem",
      padding: "1.25rem 1.5rem",
      borderRadius: "16px",
      border: "1px solid #b2ddff",
      backgroundColor: "#eff8ff",
      color: "#175cd3",
    };
  }

  if (tone === "success") {
    return {
      display: "grid",
      gap: "0.5rem",
      padding: "1.25rem 1.5rem",
      borderRadius: "16px",
      border: "1px solid #abefc6",
      backgroundColor: "#ecfdf3",
      color: "#067647",
    };
  }

  if (tone === "warning") {
    return {
      display: "grid",
      gap: "0.5rem",
      padding: "1.25rem 1.5rem",
      borderRadius: "16px",
      border: "1px solid #f7b267",
      backgroundColor: "#fff7ed",
      color: "#9a3412",
    };
  }

  return {
    display: "grid",
    gap: "0.5rem",
    padding: "1.25rem 1.5rem",
    borderRadius: "16px",
    border: "1px solid #d0d5dd",
    backgroundColor: "#f8fafc",
    color: "#344054",
  };
};

const portalButtonStyle = (isDisabled: boolean) => ({
  border: 0,
  borderRadius: "12px",
  padding: "0.9rem 1.1rem",
  backgroundColor: isDisabled ? "#98a2b3" : "#101828",
  color: "#ffffff",
  fontWeight: 700,
  cursor: isDisabled ? "not-allowed" : "pointer",
});

const secondaryLinkStyle = {
  display: "inline-flex",
  textDecoration: "none",
  padding: "0.9rem 1.1rem",
  borderRadius: "12px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#ffffff",
  color: "#344054",
  fontWeight: 700,
};

const formatSubscriptionEndDate = (value?: Timestamp | null) => {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(value.toDate());
};

const getAccountStatusBannerState = (
  profile: ReturnType<typeof useAuth>["profile"],
  isProfileLoading: boolean
): AccountStatusBannerState => {
  if (isProfileLoading || !profile) {
    return {
      tone: "neutral",
      message: "Checking your account status.",
    };
  }

  const currentPlan = normalizeManagedPlan(profile.currentPlan ?? profile.plan);
  const planName = currentPlan === "elite" ? "Elite" : "Pro";
  const scheduledCancellationDate = formatSubscriptionEndDate(profile.subscriptionEndsAt);
  const hasBillingIssue = isBillingIssueStatus(profile.billingStatus);

  if (profile.role === "admin") {
    return {
      tone: "success",
      message: "Your account has full access.",
    };
  }

  if (!profile.subscriptionActive) {
    return {
      tone: "neutral",
      message: "You are signed in on the Free plan. Upgrade to Pro or Elite to unlock member-only signal access.",
    };
  }

  if (profile.cancelAtPeriodEnd === true && scheduledCancellationDate) {
    return {
      tone: "warning",
      message: `Your ${planName} subscription is scheduled to end on ${scheduledCancellationDate}. You still have access until then.`,
    };
  }

  if (hasBillingIssue) {
    return {
      tone: "warning",
      message: "There is a billing issue with your subscription. Update your payment method to avoid interruption.",
    };
  }

  if (currentPlan === "pro" && profile.billingStatus === "active" && profile.cancelAtPeriodEnd !== true) {
    return {
      tone: "success",
      message: "Your Pro membership is active.",
    };
  }

  if (currentPlan === "elite" && profile.billingStatus === "active" && profile.cancelAtPeriodEnd !== true) {
    return {
      tone: "success",
      message: "Your Elite membership is active.",
    };
  }

  return {
    tone: "neutral",
    message: "Your account status is being updated. Billing details are shown below.",
  };
};

const isBillingIssueStatus = (billingStatus?: string) => {
  if (!billingStatus) {
    return false;
  }

  return [
    "past_due",
    "unpaid",
    "incomplete",
    "incomplete_expired",
  ].includes(billingStatus);
};

const capitalizePlan = (value: string) => `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

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
    source: "sample",
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
    source: "sample",
  },
];

export default DashboardPage;
