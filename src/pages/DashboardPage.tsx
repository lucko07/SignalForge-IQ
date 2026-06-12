import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import type { Timestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import SignalCard from "../components/SignalCard";
import TradingDisclaimer from "../components/TradingDisclaimer";
import { useAuth } from "../context/auth-context";
import { signOut } from "../lib/auth";
import { openBillingPortal } from "../lib/billing";
import { functions } from "../lib/firebase";
import {
  getPerformanceSummary,
  subscribeToSignals,
} from "../lib/firestore";
import type { PerformanceSummary, Signal } from "../lib/firestore";
import { getEffectiveManagedPlan, isAdminProfile, isStripeManagedUser } from "../lib/userProfiles";

type AccountStatusBannerState = {
  tone: "admin" | "neutral" | "success" | "warning";
  message: string;
};

type KrakenReadOnlyTestResponse = {
  ok: boolean;
  connected: boolean;
  provider: "kraken";
  mode: "read_only";
  balanceAssetCount: number;
  nonZeroBalanceAssets: string[];
  openOrdersCount: number | null;
  permissionsStatus: string | null;
  serverTime: {
    unixtime: number | null;
    rfc1123: string | null;
  } | null;
  responseTimestamp: string;
  lastCheckedAt: string;
  messages: {
    balance: string | null;
    openOrders: string | null;
    warning: string;
  };
  diagnostics?: Record<string, unknown>;
  error?: {
    category: string;
    message: string;
  } | null;
};

type KrakenLiveRiskCheckResponse = {
  ok: boolean;
  provider: "kraken";
  mode: "live";
  liveEnabled: boolean;
  allowedSymbols: string[];
  maxNotionalUsd: number;
  killSwitch: boolean;
  maxOpenPositions: number;
  maxTradesPerDay: number;
  validation: {
    allowed: boolean;
    reason: string | null;
    summary: Record<string, unknown>;
  };
  diagnostics?: {
    balance?: {
      available: boolean;
      error: {
        category: string;
        message: string;
      } | null;
    };
    availableUsd?: number | null;
    noLiveOrderEndpointsCalled?: boolean;
    blockedEndpoints?: string[];
  };
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
    hasProAccess,
    hasEliteAccess,
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
  const [krakenReadOnlyStatus, setKrakenReadOnlyStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [krakenReadOnlyMessage, setKrakenReadOnlyMessage] = useState("idle");
  const [krakenReadOnlyDiagnostics, setKrakenReadOnlyDiagnostics] =
    useState<KrakenReadOnlyTestResponse | null>(null);
  const [krakenLiveRiskStatus, setKrakenLiveRiskStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [krakenLiveRiskMessage, setKrakenLiveRiskMessage] = useState("idle");
  const [krakenLiveRiskDiagnostics, setKrakenLiveRiskDiagnostics] =
    useState<KrakenLiveRiskCheckResponse | null>(null);

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

  const canSeeAdminTools = isAdmin || isAdminProfile(profile);
  const isDevelopment = import.meta.env.DEV;

  const handleKrakenReadOnlyTest = async () => {
    if (!canSeeAdminTools) {
      return;
    }

    setKrakenReadOnlyStatus("loading");
    setKrakenReadOnlyMessage("loading");
    setKrakenReadOnlyDiagnostics(null);

    try {
      const callable = httpsCallable<undefined, KrakenReadOnlyTestResponse>(
        functions,
        "runAdminKrakenReadOnlyTest"
      );
      const response = await callable();

      if (isDevelopment) {
        console.debug("Kraken read-only sanitized diagnostics", response.data);
      }

      setKrakenReadOnlyDiagnostics(response.data);

      if (response.data.connected) {
        setKrakenReadOnlyStatus("success");
        setKrakenReadOnlyMessage(
          response.data.messages.balance
            ?? `Connected successfully. ${response.data.balanceAssetCount} balance asset(s), ${response.data.openOrdersCount ?? "unknown"} open order(s).`
        );
        return;
      }

      setKrakenReadOnlyStatus("error");
      setKrakenReadOnlyMessage(response.data.error?.message ?? "Kraken read-only connection failed.");
    } catch (error) {
      if (isDevelopment) {
        console.error("Kraken read-only connection test error", error);
      }
      setKrakenReadOnlyStatus("error");
      setKrakenReadOnlyMessage("Kraken read-only connection failed.");
    }
  };

  const handleKrakenLiveRiskCheck = async () => {
    if (!canSeeAdminTools) {
      return;
    }

    setKrakenLiveRiskStatus("loading");
    setKrakenLiveRiskMessage("loading");
    setKrakenLiveRiskDiagnostics(null);

    try {
      const callable = httpsCallable<undefined, KrakenLiveRiskCheckResponse>(
        functions,
        "runAdminKrakenLiveRiskCheck"
      );
      const response = await callable();
      const sanitizedPayload: KrakenLiveRiskCheckResponse = {
        ok: response.data.ok,
        provider: response.data.provider,
        mode: response.data.mode,
        liveEnabled: response.data.liveEnabled,
        allowedSymbols: response.data.allowedSymbols,
        maxNotionalUsd: response.data.maxNotionalUsd,
        killSwitch: response.data.killSwitch,
        maxOpenPositions: response.data.maxOpenPositions,
        maxTradesPerDay: response.data.maxTradesPerDay,
        validation: response.data.validation,
        diagnostics: {
          balance: response.data.diagnostics?.balance,
          availableUsd: response.data.diagnostics?.availableUsd ?? null,
          noLiveOrderEndpointsCalled: response.data.diagnostics?.noLiveOrderEndpointsCalled,
          blockedEndpoints: response.data.diagnostics?.blockedEndpoints,
        },
      };

      if (isDevelopment) {
        console.debug("Kraken live risk sanitized diagnostics", sanitizedPayload);
      }

      setKrakenLiveRiskDiagnostics(sanitizedPayload);
      setKrakenLiveRiskStatus("success");
      setKrakenLiveRiskMessage(
        sanitizedPayload.validation.allowed
          ? "Risk policy passed. Live order placement remains blocked."
          : `Risk policy blocked: ${sanitizedPayload.validation.reason ?? "unknown"}`
      );
    } catch (error) {
      if (isDevelopment) {
        console.error("Kraken live risk check error", {
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
      setKrakenLiveRiskStatus("error");
      setKrakenLiveRiskMessage("Kraken live risk check failed.");
    }
  };

  const usingFallbackSignals = !isSignalsLoading && liveSignals.length === 0;
  const recentClosedSignals = liveSignals
    .filter((signal) => signal.status === "CLOSED" || signal.status === "CANCELLED")
    .slice(0, 5);
  const managedPlan = getEffectiveManagedPlan(profile);
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
              : "Your membership, billing access, and account permissions are managed securely from your profile."}
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

      <section style={sectionCardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={{ margin: 0, color: "#101828" }}>Live Product Lineup</h2>
            <p style={{ margin: "0.4rem 0 0", color: "#475467" }}>
              SignalForge IQ currently includes two live strategy products and one visible future BTC module.
            </p>
          </div>
        </div>

        <div style={lockedPreviewGridStyle}>
          <ProductStatusCard
            title="BTC Precision Engine"
            status="Live"
            detail="Selective BTC trade activation built for cleaner structure, stronger confirmation, and disciplined signal quality."
            footnote="Monitoring BTC for qualified precision setups. Built to avoid overtrading."
            tone="live"
          />
          <ProductStatusCard
            title="BTC Continuation Engine"
            status="Live"
            detail="BTC-focused continuation strategy for structured 30-minute setups. Backtested on BTCUSD 30m."
            footnote="Backtested performance is not a guarantee of future results."
            tone="live"
          />
          <ProductStatusCard
            title="BTC Momentum Engine"
            status="Coming Soon"
            detail="Designed to provide additional BTC opportunity flow between Precision activations once quality standards are met."
            footnote="Visible in the roadmap today, but not presented as a finalized live signal product."
            tone="future"
          />
        </div>
      </section>

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
          {hasProAccess ? (
            <>
              <Link to="/dashboard/performance" style={secondaryLinkStyle}>
                Performance overview
              </Link>
              <Link to="/dashboard/trades" style={secondaryLinkStyle}>
                Trades
              </Link>
              <Link to="/dashboard/analytics" style={secondaryLinkStyle}>
                Analytics
              </Link>
            </>
          ) : (
            <Link to="/pricing" style={secondaryLinkStyle}>
              Unlock member access
            </Link>
          )}
        </div>
        {!hasProAccess ? <UpgradePrompt /> : null}

        <div style={lockedPreviewGridStyle}>
          {!hasProAccess ? (
            <>
              <LockedPreviewCard
                plan="Pro"
                title="Analytics"
                body="Pro unlocks deeper analytics, confidence tracking, and performance review built for better decisions."
                ctaLabel="Unlock Pro"
                to="/upgrade?plan=pro"
              />
              <LockedPreviewCard
                plan="Elite"
                title="Automation"
                body="Elite unlocks execution-ready delivery, routing controls, and a more operational workflow."
                ctaLabel="Explore Elite"
                to="/upgrade?plan=elite&from=automation"
              />
            </>
          ) : null}

          {hasProAccess && !hasEliteAccess ? (
            <LockedPreviewCard
              plan="Elite"
              title="Automation"
              body="You already have the Decision Engine. Elite adds the Execution System with automation, delivery controls, and routing readiness."
              ctaLabel="Upgrade to Elite"
              to="/upgrade?plan=elite&from=automation"
            />
          ) : null}
        </div>
      </div>

      {canSeeAdminTools ? (
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

          <div style={billingNoticeStyle}>
            <strong>Kraken read-only connectivity</strong>
            <p style={{ margin: 0 }}>
              Read-only check only. Live execution remains disabled.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                onClick={handleKrakenReadOnlyTest}
                disabled={krakenReadOnlyStatus === "loading"}
                style={portalButtonStyle(krakenReadOnlyStatus === "loading")}
              >
                {krakenReadOnlyStatus === "loading"
                  ? "Testing Kraken..."
                  : "Test Kraken Read-Only Connection"}
              </button>
              <span style={{ color: "#475467", fontWeight: 700 }}>
                {krakenReadOnlyMessage}
              </span>
            </div>
            {krakenReadOnlyDiagnostics ? (
              <div style={{ display: "grid", gap: "0.85rem" }}>
                <div style={statsGridStyle}>
                  <StatCard
                    label="Connected"
                    value={krakenReadOnlyDiagnostics.connected ? "true" : "false"}
                  />
                  <StatCard label="Provider" value={krakenReadOnlyDiagnostics.provider} />
                  <StatCard label="Mode" value={krakenReadOnlyDiagnostics.mode} />
                  <StatCard
                    label="Balance Assets"
                    value={String(krakenReadOnlyDiagnostics.balanceAssetCount)}
                  />
                  <StatCard
                    label="Open Orders"
                    value={
                      krakenReadOnlyDiagnostics.openOrdersCount === null
                        ? "unknown"
                        : String(krakenReadOnlyDiagnostics.openOrdersCount)
                    }
                  />
                  <StatCard
                    label="Permissions"
                    value={formatDiagnosticLabel(krakenReadOnlyDiagnostics.permissionsStatus ?? "unknown")}
                  />
                </div>
                <div style={{ display: "grid", gap: "0.35rem", color: "#475467" }}>
                  <p style={{ margin: 0 }}>
                    <strong style={{ color: "#101828" }}>Non-zero spot balance assets:</strong>{" "}
                    {krakenReadOnlyDiagnostics.nonZeroBalanceAssets.length > 0
                      ? krakenReadOnlyDiagnostics.nonZeroBalanceAssets.join(", ")
                      : "None detected"}
                  </p>
                  {krakenReadOnlyDiagnostics.messages.balance ? (
                    <p style={{ margin: 0 }}>{krakenReadOnlyDiagnostics.messages.balance}</p>
                  ) : null}
                  {krakenReadOnlyDiagnostics.messages.openOrders ? (
                    <p style={{ margin: 0 }}>{krakenReadOnlyDiagnostics.messages.openOrders}</p>
                  ) : null}
                  <p style={{ margin: 0 }}>
                    <strong style={{ color: "#101828" }}>Server time:</strong>{" "}
                    {formatKrakenServerTime(krakenReadOnlyDiagnostics)}
                  </p>
                  <p style={{ margin: 0 }}>
                    <strong style={{ color: "#101828" }}>Last checked:</strong>{" "}
                    {formatDisplayTimestamp(krakenReadOnlyDiagnostics.lastCheckedAt)}
                  </p>
                  <p style={{ margin: 0, color: "#9a3412", fontWeight: 700 }}>
                    {krakenReadOnlyDiagnostics.messages.warning}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <div style={billingNoticeStyle}>
            <strong>Kraken Live Risk Check</strong>
            <p style={{ margin: 0 }}>
              Live order placement remains blocked. This is a diagnostics-only check.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                onClick={handleKrakenLiveRiskCheck}
                disabled={krakenLiveRiskStatus === "loading"}
                style={portalButtonStyle(krakenLiveRiskStatus === "loading")}
              >
                {krakenLiveRiskStatus === "loading"
                  ? "Running check..."
                  : "Run Kraken Live Risk Check"}
              </button>
              <span style={{ color: "#475467", fontWeight: 700 }}>
                {krakenLiveRiskMessage}
              </span>
            </div>
            {krakenLiveRiskDiagnostics ? (
              <div style={{ display: "grid", gap: "0.85rem" }}>
                <div style={statsGridStyle}>
                  <StatCard
                    label="Live Enabled"
                    value={krakenLiveRiskDiagnostics.liveEnabled ? "true" : "false"}
                  />
                  <StatCard
                    label="Allowed Symbols"
                    value={
                      krakenLiveRiskDiagnostics.allowedSymbols.length > 0
                        ? krakenLiveRiskDiagnostics.allowedSymbols.join(", ")
                        : "None"
                    }
                  />
                  <StatCard
                    label="Max Notional"
                    value={`$${krakenLiveRiskDiagnostics.maxNotionalUsd.toFixed(2)}`}
                  />
                  <StatCard
                    label="Kill Switch"
                    value={krakenLiveRiskDiagnostics.killSwitch ? "true" : "false"}
                  />
                  <StatCard
                    label="Max Open Positions"
                    value={String(krakenLiveRiskDiagnostics.maxOpenPositions)}
                  />
                  <StatCard
                    label="Max Trades / Day"
                    value={String(krakenLiveRiskDiagnostics.maxTradesPerDay)}
                  />
                  <StatCard
                    label="USD Balance"
                    value={formatNullableUsd(krakenLiveRiskDiagnostics.diagnostics?.availableUsd)}
                  />
                  <StatCard
                    label="Validation"
                    value={krakenLiveRiskDiagnostics.validation.allowed ? "Allowed" : "Blocked"}
                  />
                </div>
                <div style={{ display: "grid", gap: "0.35rem", color: "#475467" }}>
                  <p style={{ margin: 0 }}>
                    <strong style={{ color: "#101828" }}>Reason:</strong>{" "}
                    {krakenLiveRiskDiagnostics.validation.reason
                      ? formatDiagnosticLabel(krakenLiveRiskDiagnostics.validation.reason)
                      : "None"}
                  </p>
                  <p style={{ margin: 0 }}>
                    <strong style={{ color: "#101828" }}>No live order endpoints called:</strong>{" "}
                    {krakenLiveRiskDiagnostics.diagnostics?.noLiveOrderEndpointsCalled === true ? "true" : "unknown"}
                  </p>
                  <p style={{ margin: 0 }}>
                    <strong style={{ color: "#101828" }}>Blocked endpoints:</strong>{" "}
                    {krakenLiveRiskDiagnostics.diagnostics?.blockedEndpoints?.length
                      ? krakenLiveRiskDiagnostics.diagnostics.blockedEndpoints.join(", ")
                      : "Not returned"}
                  </p>
                  <details>
                    <summary style={{ cursor: "pointer", color: "#101828", fontWeight: 700 }}>
                      Validation summary
                    </summary>
                    <pre
                      style={{
                        margin: "0.75rem 0 0",
                        padding: "0.85rem",
                        borderRadius: "12px",
                        backgroundColor: "#101828",
                        color: "#f8fafc",
                        overflowX: "auto",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {formatDiagnosticJson(krakenLiveRiskDiagnostics.validation.summary)}
                    </pre>
                  </details>
                </div>
              </div>
            ) : null}
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
              Pro includes the live BTC Precision Engine and BTC Continuation Engine. Elite adds the Execution System for members who want
              automation, routing, and delivery controls inside the same workflow.
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

          {!hasSubscriptionAccess ? (
            <div>
              <Link to="/upgrade?plan=pro" style={secondaryLinkStyle}>
                Upgrade to Pro
              </Link>
            </div>
          ) : null}

          {hasProAccess && !hasEliteAccess ? (
            <LockedPreviewCard
              plan="Elite"
              title="Execution Layer"
              body="Automation is available on Elite. Upgrade to activate execution-ready delivery and advanced routing controls."
              ctaLabel="Unlock Elite"
              to="/upgrade?plan=elite&from=automation"
            />
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
                ? "BTC Precision Engine and BTC Continuation Engine signals are shown here first."
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
            <strong>No qualified setup detected.</strong>
            <p style={{ margin: 0 }}>
              The live SignalForge IQ lineup is actively monitoring BTC strategies. No setup currently meets the required structure, trend, and confirmation criteria.
            </p>
            <p style={{ margin: 0 }}>
              The system remains selective by design to avoid low-quality trades.
            </p>
            {signalsError ? <p style={{ margin: 0 }}>{signalsError}</p> : null}
          </div>
        ) : null}

        {hasSubscriptionAccess && !isSignalsLoading && liveSignals.length > 0 ? (
          <div style={{ display: "grid", gap: "1rem" }}>
            {liveSignals.map((signal) => (
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

type LockedPreviewCardProps = {
  plan: "Pro" | "Elite";
  title: string;
  body: string;
  ctaLabel: string;
  to: string;
};

function LockedPreviewCard({ plan, title, body, ctaLabel, to }: LockedPreviewCardProps) {
  return (
    <div style={lockedPreviewCardStyle}>
      <div style={lockedPreviewHeaderStyle}>
        <span aria-hidden="true" style={lockedPreviewIconStyle}>
          LOCK
        </span>
        <span style={lockedPreviewBadgeStyle(plan)}>{plan}</span>
      </div>
      <div style={{ display: "grid", gap: "0.35rem" }}>
        <strong style={{ color: "#101828" }}>{title}</strong>
        <p style={{ margin: 0, color: "#475467", lineHeight: 1.65 }}>{body}</p>
      </div>
      <div>
        <Link to={to} style={lockedPreviewLinkStyle}>
          {ctaLabel}
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

type ProductStatusCardProps = {
  title: string;
  status: string;
  detail: string;
  footnote: string;
  tone: "live" | "future";
};

function ProductStatusCard({ title, status, detail, footnote, tone }: ProductStatusCardProps) {
  return (
    <article
      style={{
        padding: "1rem",
        borderRadius: "14px",
        backgroundColor: "#ffffff",
        border: tone === "live" ? "1px solid #abefc6" : "1px solid #d0d5dd",
        display: "grid",
        gap: "0.6rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
        <strong style={{ color: "#101828" }}>{title}</strong>
        <span
          style={{
            padding: "0.3rem 0.65rem",
            borderRadius: "999px",
            backgroundColor: tone === "live" ? "#ecfdf3" : "#f2f4f7",
            color: tone === "live" ? "#027a48" : "#475467",
            fontSize: "0.8rem",
            fontWeight: 700,
          }}
        >
          {status}
        </span>
      </div>
      <p style={{ margin: 0, color: "#475467", lineHeight: 1.65 }}>{detail}</p>
      <p style={{ margin: 0, color: "#667085", lineHeight: 1.6 }}>{footnote}</p>
    </article>
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

const lockedPreviewGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "0.75rem",
  marginTop: "1rem",
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

const lockedPreviewCardStyle = {
  display: "grid",
  gap: "0.75rem",
  padding: "1rem",
  borderRadius: "16px",
  border: "1px solid #d7dde7",
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
};

const lockedPreviewHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "0.75rem",
};

const lockedPreviewIconStyle = {
  fontSize: "0.72rem",
  letterSpacing: "0.08em",
  fontWeight: 700,
  color: "#9a3412",
};

const lockedPreviewBadgeStyle = (plan: "Pro" | "Elite") => ({
  padding: "0.3rem 0.55rem",
  borderRadius: "999px",
  backgroundColor: plan === "Elite" ? "#0f172a" : "#eaf2fb",
  color: plan === "Elite" ? "#f8fafc" : "#1f3a5b",
  fontSize: "0.76rem",
  fontWeight: 700,
});

const lockedPreviewLinkStyle = {
  display: "inline-flex",
  textDecoration: "none",
  padding: "0.8rem 1rem",
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

  const currentPlan = getEffectiveManagedPlan(profile);
  const planName = currentPlan === "elite" ? "Elite" : "Pro";
  const scheduledCancellationDate = formatSubscriptionEndDate(profile.subscriptionEndsAt);
  const hasBillingIssue = isBillingIssueStatus(profile.billingStatus);

  if (profile.role === "admin") {
    return {
      tone: "success",
      message: "Your account has full access.",
    };
  }

  if (profile.approved === false) {
    return {
      tone: "warning",
      message: "Your account is signed in, but access is pending approval. Premium features remain locked until approval is restored.",
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

const formatDisplayTimestamp = (isoString: string) => {
  const parsed = new Date(isoString);

  if (Number.isNaN(parsed.getTime())) {
    return "Not available";
  }

  return parsed.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const formatDiagnosticLabel = (value: string) =>
  value
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

const formatNullableUsd = (value?: number | null) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Not returned";
  }

  return `$${value.toFixed(2)}`;
};

const formatDiagnosticJson = (value: Record<string, unknown>) => (
  JSON.stringify(value, null, 2)
);

const formatKrakenServerTime = (diagnostics: KrakenReadOnlyTestResponse) => {
  if (diagnostics.serverTime?.rfc1123) {
    return diagnostics.serverTime.rfc1123;
  }

  if (typeof diagnostics.serverTime?.unixtime === "number") {
    return formatDisplayTimestamp(new Date(diagnostics.serverTime.unixtime * 1000).toISOString());
  }

  return formatDisplayTimestamp(diagnostics.responseTimestamp);
};

export default DashboardPage;
