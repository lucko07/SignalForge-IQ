import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Timestamp } from "firebase/firestore";
import SignalCard from "../components/SignalCard";
import TradingDisclaimer from "../components/TradingDisclaimer";
import { useAuth } from "../context/auth-context";
import { logout } from "../lib/auth";
import { openBillingPortal } from "../lib/billing";
import {
  getPerformanceSummary,
  getUserProfile,
  hasActiveBillingAccess,
  isStripeManagedPlan,
  subscribeToSignals,
} from "../lib/firestore";
import type { PerformanceSummary, Signal, UserPlan, UserProfile, UserRole } from "../lib/firestore";

type DashboardProfile = {
  plan: UserPlan;
  role: UserRole;
  currentPlan?: UserPlan;
  billingStatus?: string;
  stripeCustomerId?: string;
  cancelAtPeriodEnd?: boolean;
  subscriptionEndsAt?: Timestamp | null;
};

type AccountStatusBannerState = {
  tone: "admin" | "neutral" | "success" | "warning";
  message: string;
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
  const [profileLoadError, setProfileLoadError] = useState("");

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
            currentPlan: userProfile.currentPlan,
            billingStatus: userProfile.billingStatus,
            stripeCustomerId: userProfile.stripeCustomerId,
            cancelAtPeriodEnd: userProfile.cancelAtPeriodEnd,
            subscriptionEndsAt: userProfile.subscriptionEndsAt,
          });
          setProfileLoadError("");
        }
      } catch {
        if (isMounted) {
          setProfileLoadError("We could not refresh your account details right now.");
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
  }, []);

  useEffect(() => {
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
  }, [liveSignals]);

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await logout();
      navigate("/login", { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const usingFallbackSignals = !isSignalsLoading && liveSignals.length === 0;
  const visibleSignals = liveSignals.length > 0 ? liveSignals : sampleSignals;
  const recentClosedSignals = liveSignals
    .filter((signal) => signal.status === "CLOSED" || signal.status === "CANCELLED")
    .slice(0, 5);
  const isAdminUser = profile.role === "admin";
  const isStripeManagedUser = isStripeManagedPlan(profile);
  const hasPaidBillingAccess = hasActiveBillingAccess(profile as UserProfile);
  const accountStatusBanner = getAccountStatusBannerState(profile, isProfileLoading);
  const membershipLabel = isAdminUser ? "Administrator" : `${capitalizePlan(profile.plan)} member`;

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
          <strong>Access:</strong> {isProfileLoading ? "Loading..." : membershipLabel}
        </p>
        {!isProfileLoading ? (
          <p style={{ margin: "0 0 1.25rem", color: "#475467" }}>
            {isAdminUser ? "You can manage member access and review signals from this account." : "Your membership and signal access are shown below."}
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

      {profileLoadError ? (
        <div style={accountStatusBannerStyle("neutral")}>
          <strong style={{ fontSize: "1rem" }}>Account details</strong>
          <p style={{ margin: 0 }}>{profileLoadError}</p>
        </div>
      ) : null}

      {isAdminUser ? (
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
              Pro includes protected dashboard access, live signals, closed trade history, and performance tracking.
              Elite includes everything in Pro plus higher-tier premium access and future expanded member benefits.
            </p>
          </div>

          <div style={statsGridStyle}>
            <StatCard label="Current Plan" value={isProfileLoading ? "Loading..." : (profile.currentPlan ?? profile.plan)} />
            <StatCard label="Billing Status" value={isProfileLoading ? "Loading..." : (profile.billingStatus ?? "Not billed")} />
            <StatCard
              label="Billing Access"
              value={isProfileLoading ? "Loading..." : (hasPaidBillingAccess ? "Active" : "Upgrade required")}
            />
            <StatCard
              label="Billing Setup"
              value={isProfileLoading ? "Loading..." : (profile.stripeCustomerId ? "Connected" : "Not linked")}
            />
          </div>

          {isStripeManagedUser ? (
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
                {profile.plan === "pro" ? (
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

      <div
        style={{
          padding: "1.5rem",
          border: "1px solid #d0d5dd",
          borderRadius: "16px",
          backgroundColor: "#f8fafc",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "1rem",
            flexWrap: "wrap",
            marginBottom: "1rem",
          }}
        >
          <div>
            <h2 style={{ margin: 0, color: "#101828" }}>Performance Summary</h2>
            <p style={{ margin: "0.4rem 0 0", color: "#475467" }}>
              Closed-signal performance based on stored outcomes and realized PnL.
            </p>
          </div>
        </div>

        {isPerformanceLoading ? <p style={{ margin: 0 }}>Loading performance summary...</p> : null}

        {!isPerformanceLoading ? (
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

        {performanceError ? (
          <p style={{ margin: "1rem 0 0", color: "#b42318" }}>{performanceError}</p>
        ) : null}
      </div>

      <div
        style={{
          padding: "1.5rem",
          border: "1px solid #d0d5dd",
          borderRadius: "16px",
          backgroundColor: "#f8fafc",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "1rem",
            flexWrap: "wrap",
            marginBottom: "1rem",
          }}
        >
          <div>
            <h2 style={{ margin: 0, color: "#101828" }}>Trading Signals</h2>
            <p style={{ margin: "0.4rem 0 0", color: "#475467" }}>
              Live signals are shown here first.
            </p>
          </div>
          {!isSignalsLoading && liveSignals.length > 0 ? (
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

        {isSignalsLoading ? <p style={{ margin: 0 }}>Loading signals...</p> : null}

        {!isSignalsLoading && usingFallbackSignals ? (
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

        {!isSignalsLoading && visibleSignals.length > 0 ? (
          <div style={{ display: "grid", gap: "1rem" }}>
            {visibleSignals.map((signal) => (
              <SignalCard key={signal.id} signal={signal} />
            ))}
          </div>
        ) : null}

        <div style={{ marginTop: "1rem" }}>
          <TradingDisclaimer />
        </div>
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
          <h2 style={{ margin: 0, color: "#101828" }}>Recent Closed Signals</h2>
          <p style={{ margin: "0.4rem 0 0", color: "#475467" }}>
            Most recent closed or cancelled trades from the live signal feed.
          </p>
        </div>

        {!isSignalsLoading && recentClosedSignals.length > 0 ? (
          <div style={{ display: "grid", gap: "1rem" }}>
            {recentClosedSignals.map((signal) => (
              <SignalCard key={`closed-${signal.id}`} signal={signal} />
            ))}
          </div>
        ) : null}

        {!isSignalsLoading && recentClosedSignals.length === 0 ? (
          <p style={{ margin: 0, color: "#475467" }}>
            No closed signals yet. Closed trades will appear here once outcomes are recorded.
          </p>
        ) : null}
      </div>
    </section>
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
  profile: DashboardProfile,
  isProfileLoading: boolean
): AccountStatusBannerState => {
  if (isProfileLoading) {
    return {
      tone: "neutral",
      message: "Checking your account status.",
    };
  }

  const currentPlan = profile.currentPlan ?? profile.plan;
  const planName = currentPlan === "elite" ? "Elite" : "Pro";
  const scheduledCancellationDate = formatSubscriptionEndDate(profile.subscriptionEndsAt);
  const hasBillingIssue = isBillingIssueStatus(profile.billingStatus);

  if (profile.role === "admin") {
    return {
      tone: "success",
      message: "Your account has full access.",
    };
  }

  if (currentPlan === "free") {
    return {
      tone: "neutral",
      message: "You are on the Free plan. Upgrade to Pro or Elite to unlock the protected dashboard and full signal access.",
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
