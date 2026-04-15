import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/auth-context";
import { saveAutomationSettings } from "../../lib/automation";
import {
  getAutomationSettings,
  getBrokerConnection,
  getRecentExecutionRecords,
  getDefaultAutomationSettings,
  getDefaultBrokerConnection,
  summarizeExecutionStatuses,
  type AutomationSettings,
  type BrokerConnection,
  type ExecutionRecord,
} from "../../lib/automationFirestore";
import {
  runAdminPaperExecutionTest,
  saveAlpacaPaperAutomationSettings,
  testAlpacaConnection as runAlpacaConnectionTest,
  type RunAdminPaperExecutionTestResponse,
} from "../../lib/alpacaAutomation";
import { db } from "../../lib/firebase";
import { canUseAutomation, getEffectiveManagedPlan } from "../../lib/userProfiles";

type AutomationProfileDocument = {
  plan?: string;
  currentPlan?: string;
  approved?: boolean;
  subscriptionActive?: boolean;
  status?: string;
  webhookEnabled?: boolean;
};

type WebhookConfigDocument = {
  enabled?: boolean;
  url?: string;
  secret?: string;
  assetFilters?: unknown;
};

type FormState = {
  automationEnabled: boolean;
  webhookUrl: string;
  webhookSecret: string;
  assetFiltersInput: string;
};

type FormErrors = {
  webhookUrl?: string;
  webhookSecret?: string;
  assetFiltersInput?: string;
};

type NoticeState = {
  tone: "success" | "error" | "info";
  message: string;
} | null;

type AlpacaSettingsFormState = {
  enabled: boolean;
  killSwitch: boolean;
  longsEnabled: boolean;
  shortsEnabled: boolean;
  maxOpenPositionsInput: string;
  maxTradesPerDayInput: string;
  notionalUsdInput: string;
  symbolAllowlistInput: string;
};

type ExecutionFilter = "all" | "submitted" | "filled" | "rejected" | "failed";

const DEFAULT_FORM_STATE: FormState = {
  automationEnabled: false,
  webhookUrl: "",
  webhookSecret: "",
  assetFiltersInput: "",
};

const createAlpacaSettingsFormState = (settings: AutomationSettings): AlpacaSettingsFormState => ({
  enabled: settings.enabled,
  killSwitch: settings.killSwitch,
  longsEnabled: settings.longsEnabled,
  shortsEnabled: settings.shortsEnabled,
  maxOpenPositionsInput: String(settings.maxOpenPositions),
  maxTradesPerDayInput: String(settings.maxTradesPerDay),
  notionalUsdInput: settings.notionalUsd.toFixed(2),
  symbolAllowlistInput: settings.symbolAllowlist.join(", "),
});

const getAutomationUiErrorMessage = (error: unknown, fallbackMessage: string) =>
  error instanceof Error && error.message.trim()
    ? error.message.trim()
    : fallbackMessage;

function AutomationPage() {
  const { currentUser, loading: authLoading, refreshProfile, profile, isAdmin } = useAuth();
  const isDevelopment = import.meta.env.DEV;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSecretVisible, setIsSecretVisible] = useState(false);
  const [hasWebhookConfig, setHasWebhookConfig] = useState(false);
  const [initialFormState, setInitialFormState] = useState<FormState>(DEFAULT_FORM_STATE);
  const [formState, setFormState] = useState<FormState>(DEFAULT_FORM_STATE);
  const [errors, setErrors] = useState<FormErrors>({});
  const [notice, setNotice] = useState<NoticeState>(null);

  const [alpacaConnection, setAlpacaConnection] = useState<BrokerConnection>(getDefaultBrokerConnection());
  const [alpacaSettings, setAlpacaSettings] = useState<AutomationSettings>(getDefaultAutomationSettings());
  const [alpacaFormState, setAlpacaFormState] = useState<AlpacaSettingsFormState>(
    createAlpacaSettingsFormState(getDefaultAutomationSettings())
  );
  const [executionRecords, setExecutionRecords] = useState<ExecutionRecord[]>([]);
  const [isTestingAlpacaConnection, setIsTestingAlpacaConnection] = useState(false);
  const [isSavingAlpacaSettings, setIsSavingAlpacaSettings] = useState(false);
  const [alpacaStatusMessage, setAlpacaStatusMessage] = useState<NoticeState>(null);
  const [paperTestNotice, setPaperTestNotice] = useState<NoticeState>(null);
  const [isRunningPaperTest, setIsRunningPaperTest] = useState(false);
  const [executionFilter, setExecutionFilter] = useState<ExecutionFilter>("all");
  const [latestPaperTestResult, setLatestPaperTestResult] =
    useState<RunAdminPaperExecutionTestResponse | null>(null);
  const [lastSuccessfulPaperTestAt, setLastSuccessfulPaperTestAt] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!currentUser) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const loadAutomationSettings = async () => {
      setIsLoading(true);
      setNotice(null);

      try {
        const userReference = doc(db, "users", currentUser.uid);
        const webhookReference = doc(db, "users", currentUser.uid, "webhooks", "default");
        const [profileSnapshot, webhookSnapshot] = await Promise.all([
          getDoc(userReference),
          getDoc(webhookReference),
        ]);

        if (!isMounted) {
          return;
        }

        const nextProfileData = profileSnapshot.exists()
          ? (profileSnapshot.data() as AutomationProfileDocument)
          : null;
        const webhookData = webhookSnapshot.exists()
          ? (webhookSnapshot.data() as WebhookConfigDocument)
          : null;
        const nextFormState = {
          automationEnabled:
            typeof nextProfileData?.webhookEnabled === "boolean"
              ? nextProfileData.webhookEnabled
              : webhookData?.enabled === true,
          webhookUrl: typeof webhookData?.url === "string" ? webhookData.url : "",
          webhookSecret: typeof webhookData?.secret === "string" ? webhookData.secret : "",
          assetFiltersInput: normalizeAssetFilters(webhookData?.assetFilters).join(", "),
        };

        setHasWebhookConfig(webhookSnapshot.exists());
        setInitialFormState(nextFormState);
        setFormState(nextFormState);
        setErrors({});

        if (isAdmin) {
          const [nextBrokerConnection, nextAutomationSettings, nextExecutions] = await Promise.all([
            getBrokerConnection(currentUser.uid),
            getAutomationSettings(currentUser.uid),
            getRecentExecutionRecords(),
          ]);

          if (!isMounted) {
            return;
          }

          setAlpacaConnection(nextBrokerConnection);
          setAlpacaSettings(nextAutomationSettings);
          setAlpacaFormState(createAlpacaSettingsFormState(nextAutomationSettings));
          setExecutionRecords(nextExecutions);
        } else {
          setAlpacaConnection(getDefaultBrokerConnection());
          setAlpacaSettings(getDefaultAutomationSettings());
          setAlpacaFormState(createAlpacaSettingsFormState(getDefaultAutomationSettings()));
          setExecutionRecords([]);
          setLatestPaperTestResult(null);
          setLastSuccessfulPaperTestAt(null);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setNotice({
          tone: "error",
          message: getAutomationUiErrorMessage(error, "Unable to load automation settings right now."),
        });
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadAutomationSettings();

    return () => {
      isMounted = false;
    };
  }, [authLoading, currentUser, isAdmin]);

  const normalizedPlan = useMemo(() => getEffectiveManagedPlan(profile), [profile]);
  const hasAutomationAccess = canUseAutomation(profile);

  const deliveryLabel = useMemo(() => {
    if (isAdmin) {
      return "Full access";
    }

    if (normalizedPlan === "elite") {
      return "Automation enabled";
    }

    if (normalizedPlan === "pro") {
      return "Execution upgrade available";
    }

    return "Elite access required";
  }, [isAdmin, normalizedPlan]);

  const isSaveDisabled = isSaving || (!isAdmin && !hasAutomationAccess);
  const areAdminPaperActionsDisabled =
    isRunningPaperTest || isTestingAlpacaConnection || isSavingAlpacaSettings;
  const executionSummary = useMemo(
    () => summarizeExecutionStatuses(executionRecords),
    [executionRecords]
  );
  const filteredExecutionRecords = useMemo(() => executionRecords.filter((record) => {
    const normalizedStatus = record.status.trim().toLowerCase();

    if (executionFilter === "submitted") {
      return normalizedStatus === "submitted"
        || normalizedStatus === "accepted"
        || normalizedStatus === "partially_filled";
    }

    if (executionFilter === "filled") {
      return normalizedStatus === "filled";
    }

    if (executionFilter === "rejected") {
      return normalizedStatus === "rejected"
        || normalizedStatus === "canceled"
        || normalizedStatus === "expired"
        || normalizedStatus === "duplicate"
        || normalizedStatus === "position_conflict"
        || normalizedStatus === "already_closed"
        || normalizedStatus === "no_open_position"
        || normalizedStatus === "duplicate_exit";
    }

    if (executionFilter === "failed") {
      return normalizedStatus === "failed" || normalizedStatus === "error";
    }

    return true;
  }), [executionFilter, executionRecords]);
  const normalizedAssetFilters = useMemo(
    () => normalizeAssetFilters(formState.assetFiltersInput),
    [formState.assetFiltersInput]
  );
  const normalizedAlpacaAllowlist = useMemo(
    () => normalizeAssetFilters(alpacaFormState.symbolAllowlistInput),
    [alpacaFormState.symbolAllowlistInput]
  );
  const hasAlpacaFormChanges = useMemo(() => (
    alpacaFormState.enabled !== alpacaSettings.enabled
    || alpacaFormState.killSwitch !== alpacaSettings.killSwitch
    || alpacaFormState.longsEnabled !== alpacaSettings.longsEnabled
    || alpacaFormState.shortsEnabled !== alpacaSettings.shortsEnabled
    || Number(alpacaFormState.maxOpenPositionsInput) !== alpacaSettings.maxOpenPositions
    || Number(alpacaFormState.maxTradesPerDayInput) !== alpacaSettings.maxTradesPerDay
    || Number(alpacaFormState.notionalUsdInput) !== alpacaSettings.notionalUsd
    || normalizedAlpacaAllowlist.join(",") !== alpacaSettings.symbolAllowlist.join(",")
  ), [alpacaFormState, alpacaSettings, normalizedAlpacaAllowlist]);
  const latestSuccessfulExecution = useMemo(
    () => executionRecords.find((record) => {
      const normalizedStatus = record.status.trim().toLowerCase();
      return normalizedStatus === "submitted"
        || normalizedStatus === "accepted"
        || normalizedStatus === "partially_filled"
        || normalizedStatus === "filled";
    }) ?? null,
    [executionRecords]
  );

  const latestPaperTestState = useMemo(() => {
    if (!latestPaperTestResult) {
      return null;
    }

    if (latestPaperTestResult.execution?.submitted) {
      return {
        tone: "success" as const,
        label: formatExecutionStatus(latestPaperTestResult.execution?.status ?? "submitted"),
        detail: "Paper order reached Alpaca paper routing successfully.",
      };
    }

    if (latestPaperTestResult.execution?.skipped) {
      return {
        tone: "info" as const,
        label: "Skipped",
        detail: latestPaperTestResult.execution.reason ?? "Execution was intentionally skipped.",
      };
    }

    if (
      latestPaperTestResult.execution?.status === "position_conflict"
    ) {
      return {
        tone: "info" as const,
        label: latestPaperTestResult.execution.status,
        detail:
          latestPaperTestResult.execution.reason ??
          "The paper test was handled without submitting a new order.",
      };
    }

    if (latestPaperTestResult.execution?.status === "rejected") {
      return {
        tone: "error" as const,
        label: latestPaperTestResult.execution.status,
        detail:
          latestPaperTestResult.execution.reason ??
          "The paper test was blocked by execution guardrails.",
      };
    }

    if (latestPaperTestResult.ok) {
      return {
        tone: "info" as const,
        label: latestPaperTestResult.execution?.status ?? "Completed",
        detail:
          latestPaperTestResult.execution?.reason ??
          "The test completed without submitting an order.",
      };
    }

    return {
      tone: "error" as const,
      label: "Failed",
      detail:
        latestPaperTestResult.execution?.reason ??
        "The paper test did not complete successfully.",
    };
  }, [latestPaperTestResult]);

  const writeDebugLog = (label: string, payload?: unknown) => {
    if (!isDevelopment) {
      return;
    }

    if (payload === undefined) {
      console.debug(`[AutomationPage] ${label}`);
      return;
    }

    console.debug(`[AutomationPage] ${label}`, payload);
  };

  const handleFieldChange = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setFormState((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setNotice(null);
  };

  const validateForm = () => {
    const nextErrors: FormErrors = {};

    if (formState.automationEnabled && !formState.webhookUrl.trim()) {
      nextErrors.webhookUrl = "A destination URL is required to enable automation.";
    }

    if (formState.automationEnabled && !formState.webhookSecret.trim()) {
      nextErrors.webhookSecret = "A verification secret is required to enable automation.";
    }

    const rawAssetItems = formState.assetFiltersInput
      .split(",")
      .map((value) => value.trim());
    const hasBracketLikeInput = rawAssetItems.some(
      (value) => value.includes("[") || value.includes("]") || value.includes("\"")
    );

    if (hasBracketLikeInput) {
      nextErrors.assetFiltersInput =
        "Enter asset filters as comma-separated symbols, not JSON or bracket notation.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async () => {
    if (!currentUser || !validateForm()) {
      return;
    }

    setIsSaving(true);
    setNotice(null);

    try {
      await saveAutomationSettings({
        automationEnabled: formState.automationEnabled,
        destinationUrl: formState.webhookUrl.trim(),
        verificationSecret: formState.webhookSecret.trim(),
        assetFilters: normalizedAssetFilters,
      });

      const nextInitialState = {
        automationEnabled: formState.automationEnabled,
        webhookUrl: formState.webhookUrl.trim(),
        webhookSecret: formState.webhookSecret.trim(),
        assetFiltersInput: normalizedAssetFilters.join(", "),
      };

      setHasWebhookConfig(true);
      setInitialFormState(nextInitialState);
      setFormState(nextInitialState);
      setNotice({ tone: "success", message: "Automation settings saved successfully." });
      await refreshProfile();
    } catch (error) {
      setNotice({
        tone: "error",
        message: getAutomationUiErrorMessage(error, "Unable to save automation settings right now."),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setFormState(initialFormState);
    setErrors({});
    setNotice({ tone: "info", message: "Unsaved changes were reset." });
  };

  const handleTestConnection = () => {
    setNotice({
      tone: "info",
      message: "Test delivery will be available here soon.",
    });
  };

  const refreshAlpacaState = async () => {
    if (!currentUser || !isAdmin) {
      return;
    }

    const [nextBrokerConnection, nextAutomationSettings, nextExecutions] = await Promise.all([
      getBrokerConnection(currentUser.uid),
      getAutomationSettings(currentUser.uid),
      getRecentExecutionRecords(),
    ]);

    setAlpacaConnection(nextBrokerConnection);
    setAlpacaSettings(nextAutomationSettings);
    setExecutionRecords(nextExecutions);
  };

  const handleAlpacaConnectionTest = async () => {
    setIsTestingAlpacaConnection(true);
    setAlpacaStatusMessage(null);
    setPaperTestNotice(null);

    try {
      writeDebugLog("Testing Alpaca connection");
      const result = await runAlpacaConnectionTest();
      writeDebugLog("Alpaca connection test result", result);
      await refreshAlpacaState();
      setAlpacaStatusMessage({
        tone: "success",
        message: `Paper connection verified. Account status: ${result.account.status}.`,
      });
    } catch (error) {
      writeDebugLog("Alpaca connection test error", error);
      const message = getAutomationUiErrorMessage(
        error,
        "Unable to test the Alpaca paper connection right now."
      );
      setAlpacaStatusMessage({
        tone: message.toLowerCase().includes("admin") || message.toLowerCase().includes("sign in")
          ? "info"
          : "error",
        message,
      });
    } finally {
      setIsTestingAlpacaConnection(false);
    }
  };

  const handleAlpacaFormChange = <K extends keyof AlpacaSettingsFormState>(
    field: K,
    value: AlpacaSettingsFormState[K]
  ) => {
    setAlpacaFormState((current) => ({ ...current, [field]: value }));
    setAlpacaStatusMessage(null);
  };

  const handleSaveAlpacaSettings = async (updates: Partial<AutomationSettings>) => {
    if (!currentUser) {
      setAlpacaStatusMessage({
        tone: "error",
        message: "Sign in to update Alpaca paper automation settings.",
      });
      return;
    }

    setIsSavingAlpacaSettings(true);
    setAlpacaStatusMessage(null);

    try {
      writeDebugLog("Saving Alpaca settings", updates);
      const response = await saveAlpacaPaperAutomationSettings(updates);
      writeDebugLog("Confirmed Alpaca settings document", response.settings);
      setAlpacaSettings(response.settings);
      setAlpacaFormState(createAlpacaSettingsFormState(response.settings));
      await refreshAlpacaState();
      setAlpacaStatusMessage({
        tone: "success",
        message:
          updates.enabled === true
            ? "Paper automation enabled"
            : updates.enabled === false
              ? "Paper automation disabled"
              : "Alpaca paper automation settings updated",
      });
    } catch (error) {
      writeDebugLog("Save Alpaca settings error", error);
      setAlpacaStatusMessage({
        tone: "error",
        message: getAutomationUiErrorMessage(
          error,
          "Unable to update Alpaca paper automation settings."
        ),
      });
    } finally {
      setIsSavingAlpacaSettings(false);
    }
  };

  const handleSubmitAlpacaSettingsForm = async () => {
    const maxOpenPositions = Number(alpacaFormState.maxOpenPositionsInput);
    const maxTradesPerDay = Number(alpacaFormState.maxTradesPerDayInput);
    const notionalUsd = Number(alpacaFormState.notionalUsdInput);

    if (!Number.isInteger(maxOpenPositions) || maxOpenPositions <= 0) {
      setAlpacaStatusMessage({
        tone: "error",
        message: "Max open positions must be a whole number greater than zero.",
      });
      return;
    }

    if (!Number.isInteger(maxTradesPerDay) || maxTradesPerDay <= 0) {
      setAlpacaStatusMessage({
        tone: "error",
        message: "Max trades per day must be a whole number greater than zero.",
      });
      return;
    }

    if (!Number.isFinite(notionalUsd) || notionalUsd <= 0) {
      setAlpacaStatusMessage({
        tone: "error",
        message: "Fixed notional must be greater than zero.",
      });
      return;
    }

    if (normalizedAlpacaAllowlist.length === 0) {
      setAlpacaStatusMessage({
        tone: "error",
        message: "Add at least one symbol to the allowlist.",
      });
      return;
    }

    await handleSaveAlpacaSettings({
      enabled: alpacaFormState.enabled,
      killSwitch: alpacaFormState.killSwitch,
      longsEnabled: alpacaFormState.longsEnabled,
      shortsEnabled: alpacaFormState.shortsEnabled,
      maxOpenPositions,
      maxTradesPerDay,
      notionalUsd,
      symbolAllowlist: normalizedAlpacaAllowlist,
    });
  };

  const handleResetAlpacaSettingsForm = () => {
    setAlpacaFormState(createAlpacaSettingsFormState(alpacaSettings));
    setAlpacaStatusMessage({
      tone: "info",
      message: "Paper execution controls reset to the last saved values.",
    });
  };

  const handleCopyValue = async (label: string, value?: string | null) => {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setPaperTestNotice({ tone: "info", message: `${label} copied to clipboard.` });
    } catch (error) {
      writeDebugLog(`Copy failed for ${label}`, error);
      setPaperTestNotice({
        tone: "error",
        message: `Unable to copy ${label.toLowerCase()} right now.`,
      });
    }
  };

  const handleRunPaperTest = async (tradeId?: string) => {
    setIsRunningPaperTest(true);
    setPaperTestNotice(null);
    setAlpacaStatusMessage(null);

    try {
      const payload = tradeId ? { tradeId } : {};
      writeDebugLog("Running admin paper test", payload);
      const result = await runAdminPaperExecutionTest(payload);
      writeDebugLog("Admin paper test result", result);

      setLatestPaperTestResult(result);
      await refreshAlpacaState();

      if (result.execution?.submitted) {
        setLastSuccessfulPaperTestAt(new Date().toISOString());
        setPaperTestNotice({ tone: "success", message: "Paper test submitted successfully." });
        return;
      }

      if (result.execution?.skipped) {
        setPaperTestNotice({
          tone: "info",
          message: result.execution.reason ?? "Paper execution was intentionally skipped.",
        });
        return;
      }

      if (result.execution?.status === "position_conflict") {
        setPaperTestNotice({
          tone: "info",
          message: result.execution.reason ?? "Paper execution was handled without submitting a new order.",
        });
        return;
      }

      if (result.execution?.status === "rejected") {
        setPaperTestNotice({
          tone: "error",
          message: result.execution.reason ?? "Paper execution was blocked by execution guardrails.",
        });
        return;
      }

      if (result.ok) {
        setPaperTestNotice({
          tone: "info",
          message: result.execution?.reason ?? "Paper test completed without a submitted order.",
        });
        return;
      }

      setPaperTestNotice({
        tone: "error",
        message: result.execution?.reason ?? "Paper test did not complete successfully.",
      });
    } catch (error) {
      writeDebugLog("Admin paper test error", error);
      const message = getAutomationUiErrorMessage(
        error,
        "Unable to run the Alpaca paper test right now."
      );
      const normalizedMessage = message.toLowerCase();
      setPaperTestNotice({
        tone:
          normalizedMessage.includes("admin") ||
          normalizedMessage.includes("sign in") ||
          normalizedMessage.includes("permission")
            ? "info"
            : "error",
        message,
      });
    } finally {
      setIsRunningPaperTest(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <section style={pageStyle}>
        <div style={loadingCardStyle}>
          <p style={eyebrowStyle}>Dashboard</p>
          <h1 style={{ margin: 0, color: "#101828" }}>Automation</h1>
          <p style={{ margin: 0, color: "#475467" }}>
            Loading your automation settings, broker state, and recent paper execution activity.
          </p>
        </div>
      </section>
    );
  }

  if (!currentUser) {
    return (
      <section style={pageStyle}>
        <h1>Automation</h1>
        <p style={{ margin: 0 }}>You need to be signed in to manage automation settings.</p>
      </section>
    );
  }

  return (
    <section style={pageStyle}>
      <div style={heroCardStyle}>
        <div>
          <p style={eyebrowStyle}>Dashboard</p>
          <h1 style={{ marginBottom: "0.75rem" }}>Automation</h1>
          <p style={{ margin: 0, maxWidth: "48rem" }}>
            Connect your destination to receive approved BTC Precision Engine alerts automatically.
            Your delivery settings are saved securely to your account and can be updated any time.
          </p>
        </div>
        <div style={heroActionsStyle}>
          <Link to="/dashboard" style={secondaryLinkStyle}>
            Back to dashboard
          </Link>
        </div>
      </div>

      {notice ? (
        <div style={noticeStyle(notice.tone)}>
          <strong>
            {notice.tone === "success" ? "Saved" : notice.tone === "error" ? "Error" : "Info"}
          </strong>
          <p style={{ margin: 0 }}>{notice.message}</p>
        </div>
      ) : null}

      <div style={statusGridStyle}>
        <StatusCard label="Plan" value={capitalizeLabel(normalizedPlan)} detail={deliveryLabel} />
        <StatusCard
          label="Automation"
          value={formState.automationEnabled ? "Enabled" : "Disabled"}
          detail={
            formState.automationEnabled
              ? "Approved signals can be delivered to your endpoint."
              : "Automatic delivery is currently turned off."
          }
        />
        <StatusCard
          label="Delivery Setup"
          value={hasWebhookConfig ? "Configured" : "Not configured"}
          detail={
            hasWebhookConfig
              ? "Your delivery endpoint is ready."
              : "Your delivery settings will be created when you save."
          }
        />
      </div>

      {isAdmin ? (
        <div style={alpacaCardStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <p style={eyebrowStyle}>Admin testing</p>
              <h2 style={{ margin: 0, color: "#101828" }}>Alpaca Paper Execution</h2>
              <p style={{ margin: "0.45rem 0 0", color: "#475467", maxWidth: "48rem" }}>
                Manage the paper execution test lane without exposing broker credentials. This
                control panel is designed for safe admin validation before broader execution rollout.
              </p>
            </div>
          </div>

          {alpacaStatusMessage ? (
            <div style={noticeStyle(alpacaStatusMessage.tone)}>
              <strong>
                {alpacaStatusMessage.tone === "success"
                  ? "Updated"
                  : alpacaStatusMessage.tone === "error"
                    ? "Error"
                    : "Info"}
              </strong>
              <p style={{ margin: 0 }}>{alpacaStatusMessage.message}</p>
            </div>
          ) : null}

          <div style={operatorConsoleStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <p style={eyebrowStyle}>Operator overview</p>
                <h3 style={{ margin: 0, color: "#101828" }}>Paper Automation Status</h3>
                <p style={{ margin: "0.4rem 0 0", color: "#475467", maxWidth: "46rem" }}>
                  A high-signal read on the current paper execution lane, focused on connection,
                  safeguards, and the most recent successful broker progression.
                </p>
              </div>
              <div style={pillRowStyle}>
                <span style={metaPillStyle}>Admin only</span>
                <span style={metaPillStyle}>Paper environment</span>
              </div>
            </div>

            <div style={operatorStatusGridStyle}>
              <OperatorMetricCard
                label="Connection state"
                value={alpacaConnection.connected ? "Connected" : "Disconnected"}
                detail={
                  alpacaConnection.connected
                    ? "Alpaca paper account is reachable."
                    : "Run a connection test before operating this lane."
                }
                tone={alpacaConnection.connected ? "success" : "warning"}
              />
              <OperatorMetricCard
                label="Automation"
                value={alpacaSettings.enabled ? "Enabled" : "Disabled"}
                detail={alpacaSettings.enabled ? "Execution lane is armed." : "Order submission is off."}
                tone={alpacaSettings.enabled ? "success" : "muted"}
              />
              <OperatorMetricCard
                label="Kill switch"
                value={alpacaSettings.killSwitch ? "Active" : "Off"}
                detail={
                  alpacaSettings.killSwitch
                    ? "Guardrail is blocking new broker entries."
                    : "Broker path is open for qualified paper entries."
                }
                tone={alpacaSettings.killSwitch ? "danger" : "success"}
              />
              <OperatorMetricCard
                label="Symbol allowlist"
                value={alpacaSettings.symbolAllowlist.join(", ")}
                detail="Backend execution only routes allowlisted symbols."
                actionLabel="Copy"
                onAction={() => void handleCopyValue("Symbol allowlist", alpacaSettings.symbolAllowlist.join(", "))}
              />
              <OperatorMetricCard
                label="Max trades / day"
                value={String(alpacaSettings.maxTradesPerDay)}
                detail="Daily execution cap enforced server-side."
              />
              <OperatorMetricCard
                label="Max open positions"
                value={String(alpacaSettings.maxOpenPositions)}
                detail="Open-position guardrail enforced before order submission."
              />
              <OperatorMetricCard
                label="Last successful execution"
                value={latestSuccessfulExecution ? formatExecutionStatus(latestSuccessfulExecution.status) : "None yet"}
                detail={
                  latestSuccessfulExecution
                    ? `${latestSuccessfulExecution.symbol} at ${formatFirestoreTimestamp(latestSuccessfulExecution.createdAt)}`
                    : "No successful paper executions have been recorded yet."
                }
                actionLabel={latestSuccessfulExecution?.alpacaOrderId ? "Copy order ID" : undefined}
                onAction={
                  latestSuccessfulExecution?.alpacaOrderId
                    ? () => void handleCopyValue("Alpaca order ID", latestSuccessfulExecution.alpacaOrderId)
                    : undefined
                }
              />
            </div>
          </div>

          <div style={futureOnboardingCardStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <p style={eyebrowStyle}>Future architecture</p>
                <h3 style={{ margin: 0, color: "#101828" }}>User Broker Onboarding</h3>
                <p style={{ margin: "0.4rem 0 0", color: "#475467", maxWidth: "46rem" }}>
                  Reserved for the next-stage user onboarding flow. This remains paper-safe and
                  server-mediated for now, with no client-side secret entry and no live trading path.
                </p>
              </div>
              <div style={pillRowStyle}>
                <span style={metaPillStyle}>Coming soon</span>
                <span style={metaPillStyle}>Server-mediated</span>
                <span style={metaPillStyle}>Paper only</span>
              </div>
            </div>

            <div style={alpacaDetailsGridStyle}>
              <div style={statusCardStyle}>
                <span style={statusLabelStyle}>Broker document path</span>
                <code style={codePreviewStyle}>users/{"{uid}"}/brokerConnections/alpaca</code>
                <p style={{ margin: 0 }}>
                  Firestore stores connection state only, not exchange secrets.
                </p>
              </div>
              <div style={statusCardStyle}>
                <span style={statusLabelStyle}>Allowed mode</span>
                <strong style={statusValueStyle}>PAPER</strong>
                <p style={{ margin: 0 }}>
                  Future onboarding will stay paper-safe until live rollout is explicitly designed.
                </p>
              </div>
            </div>

            <div style={actionsRowStyle}>
              <button type="button" disabled style={secondaryButtonStyle(true)}>
                Connect broker (Coming soon)
              </button>
              <button type="button" disabled style={secondaryButtonStyle(true)}>
                Validate user connection (Coming soon)
              </button>
            </div>
          </div>

          <div style={statusGridStyle}>
            <StatusCard
              label="Connection"
              value={alpacaConnection.connected ? "Connected" : "Not connected"}
              detail={
                alpacaConnection.connected
                  ? "Paper account verified recently."
                  : "Run a connection test before enabling paper automation."
              }
            />
            <StatusCard label="Mode" value={alpacaConnection.mode.toUpperCase()} detail="Paper execution only" />
            <StatusCard
              label="Automation"
              value={alpacaSettings.enabled ? "Enabled" : "Disabled"}
              detail={
                alpacaSettings.enabled
                  ? "Ready to submit qualifying paper entries."
                  : "No paper orders will be submitted."
              }
            />
            <StatusCard
              label="Kill switch"
              value={alpacaSettings.killSwitch ? "Active" : "Off"}
              detail={
                alpacaSettings.killSwitch
                  ? "New paper orders are blocked."
                  : "Execution path is open for admin testing."
              }
            />
          </div>

          <div style={alpacaDetailsGridStyle}>
            <div style={statusCardStyle}>
              <span style={statusLabelStyle}>Symbol allowlist</span>
              <strong style={statusValueStyle}>{alpacaSettings.symbolAllowlist.join(", ")}</strong>
              <p style={{ margin: 0 }}>Allowed symbols are enforced again in backend execution validation.</p>
            </div>
            <div style={statusCardStyle}>
              <span style={statusLabelStyle}>Fixed notional</span>
              <strong style={statusValueStyle}>${alpacaSettings.notionalUsd.toFixed(2)}</strong>
              <p style={{ margin: 0 }}>
                Each qualifying paper entry uses the configured fixed notional size.
              </p>
            </div>
            <div style={statusCardStyle}>
              <span style={statusLabelStyle}>Longs</span>
              <strong style={statusValueStyle}>{alpacaSettings.longsEnabled ? "Enabled" : "Disabled"}</strong>
              <p style={{ margin: 0 }}>
                Long paper entries are the current focus of the testing layer.
              </p>
            </div>
            <div style={statusCardStyle}>
              <span style={statusLabelStyle}>Shorts</span>
              <strong style={statusValueStyle}>{alpacaSettings.shortsEnabled ? "Enabled" : "Disabled"}</strong>
              <p style={{ margin: 0 }}>
                Short paper entries remain off by default for this first execution pass.
              </p>
            </div>
            <div style={statusCardStyle}>
              <span style={statusLabelStyle}>Max open positions</span>
              <strong style={statusValueStyle}>{String(alpacaSettings.maxOpenPositions)}</strong>
              <p style={{ margin: 0 }}>New orders stop once the open-position guardrail is hit.</p>
            </div>
            <div style={statusCardStyle}>
              <span style={statusLabelStyle}>Max trades per day</span>
              <strong style={statusValueStyle}>{String(alpacaSettings.maxTradesPerDay)}</strong>
              <p style={{ margin: 0 }}>Daily paper submissions are capped before broker order creation.</p>
            </div>
          </div>

          <div style={formGridStyle}>
            <div style={alpacaDetailsGridStyle}>
              <label style={fieldGroupStyle}>
                <span style={fieldLabelStyle}>Enable paper automation</span>
                <button
                  type="button"
                  onClick={() => handleAlpacaFormChange("enabled", !alpacaFormState.enabled)}
                  style={toggleButtonStyle(alpacaFormState.enabled)}
                  aria-pressed={alpacaFormState.enabled}
                  disabled={areAdminPaperActionsDisabled}
                >
                  <span style={toggleKnobStyle(alpacaFormState.enabled)} />
                  <span>{alpacaFormState.enabled ? "Enabled" : "Disabled"}</span>
                </button>
              </label>

              <label style={fieldGroupStyle}>
                <span style={fieldLabelStyle}>Kill switch</span>
                <button
                  type="button"
                  onClick={() => handleAlpacaFormChange("killSwitch", !alpacaFormState.killSwitch)}
                  style={toggleButtonStyle(alpacaFormState.killSwitch)}
                  aria-pressed={alpacaFormState.killSwitch}
                  disabled={areAdminPaperActionsDisabled}
                >
                  <span style={toggleKnobStyle(alpacaFormState.killSwitch)} />
                  <span>{alpacaFormState.killSwitch ? "Active" : "Off"}</span>
                </button>
              </label>

              <label style={fieldGroupStyle}>
                <span style={fieldLabelStyle}>Longs enabled</span>
                <button
                  type="button"
                  onClick={() => handleAlpacaFormChange("longsEnabled", !alpacaFormState.longsEnabled)}
                  style={toggleButtonStyle(alpacaFormState.longsEnabled)}
                  aria-pressed={alpacaFormState.longsEnabled}
                  disabled={areAdminPaperActionsDisabled}
                >
                  <span style={toggleKnobStyle(alpacaFormState.longsEnabled)} />
                  <span>{alpacaFormState.longsEnabled ? "Enabled" : "Disabled"}</span>
                </button>
              </label>

              <label style={fieldGroupStyle}>
                <span style={fieldLabelStyle}>Shorts enabled</span>
                <button
                  type="button"
                  onClick={() => handleAlpacaFormChange("shortsEnabled", !alpacaFormState.shortsEnabled)}
                  style={toggleButtonStyle(alpacaFormState.shortsEnabled)}
                  aria-pressed={alpacaFormState.shortsEnabled}
                  disabled={areAdminPaperActionsDisabled}
                >
                  <span style={toggleKnobStyle(alpacaFormState.shortsEnabled)} />
                  <span>{alpacaFormState.shortsEnabled ? "Enabled" : "Disabled"}</span>
                </button>
              </label>
            </div>

            <div style={alpacaDetailsGridStyle}>
              <label style={fieldGroupStyle}>
                <span style={fieldLabelStyle}>Max open positions</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={alpacaFormState.maxOpenPositionsInput}
                  onChange={(event) => handleAlpacaFormChange("maxOpenPositionsInput", event.target.value)}
                  style={inputStyle(false)}
                  disabled={areAdminPaperActionsDisabled}
                />
              </label>

              <label style={fieldGroupStyle}>
                <span style={fieldLabelStyle}>Max trades per day</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={alpacaFormState.maxTradesPerDayInput}
                  onChange={(event) => handleAlpacaFormChange("maxTradesPerDayInput", event.target.value)}
                  style={inputStyle(false)}
                  disabled={areAdminPaperActionsDisabled}
                />
              </label>

              <label style={fieldGroupStyle}>
                <span style={fieldLabelStyle}>Fixed notional (USD)</span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={alpacaFormState.notionalUsdInput}
                  onChange={(event) => handleAlpacaFormChange("notionalUsdInput", event.target.value)}
                  style={inputStyle(false)}
                  disabled={areAdminPaperActionsDisabled}
                />
              </label>

              <label style={fieldGroupStyle}>
                <span style={fieldLabelStyle}>Symbol allowlist</span>
                <input
                  type="text"
                  value={alpacaFormState.symbolAllowlistInput}
                  onChange={(event) => handleAlpacaFormChange("symbolAllowlistInput", event.target.value)}
                  placeholder="BTCUSD"
                  style={inputStyle(false)}
                  disabled={areAdminPaperActionsDisabled}
                />
                <span style={helperTextStyle}>
                  Comma-separated symbols. Current rollout should remain tightly scoped, with `BTCUSD`
                  kept in the list for paper execution.
                </span>
              </label>
            </div>
          </div>

          <div style={previewCardStyle}>
            <strong>Execution control preview</strong>
            <code style={codePreviewStyle}>
              {JSON.stringify({
                enabled: alpacaFormState.enabled,
                killSwitch: alpacaFormState.killSwitch,
                longsEnabled: alpacaFormState.longsEnabled,
                shortsEnabled: alpacaFormState.shortsEnabled,
                maxOpenPositions: Number(alpacaFormState.maxOpenPositionsInput),
                maxTradesPerDay: Number(alpacaFormState.maxTradesPerDayInput),
                notionalUsd: Number(alpacaFormState.notionalUsdInput),
                symbolAllowlist: normalizedAlpacaAllowlist,
              })}
            </code>
          </div>

          <div style={actionsRowStyle}>
            <button
              type="button"
              onClick={handleAlpacaConnectionTest}
              disabled={areAdminPaperActionsDisabled}
              style={primaryButtonStyle(areAdminPaperActionsDisabled)}
            >
              {isTestingAlpacaConnection ? "Testing..." : "Test connection"}
            </button>
            <button
              type="button"
              onClick={() => void handleSubmitAlpacaSettingsForm()}
              disabled={areAdminPaperActionsDisabled || !hasAlpacaFormChanges}
              style={secondaryButtonStyle(areAdminPaperActionsDisabled || !hasAlpacaFormChanges)}
            >
              {isSavingAlpacaSettings ? "Saving..." : "Save execution controls"}
            </button>
            <button
              type="button"
              onClick={handleResetAlpacaSettingsForm}
              disabled={areAdminPaperActionsDisabled || !hasAlpacaFormChanges}
              style={secondaryButtonStyle(areAdminPaperActionsDisabled || !hasAlpacaFormChanges)}
            >
              Reset execution controls
            </button>
          </div>

          <div style={paperTestCardStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <p style={eyebrowStyle}>Admin only</p>
                <h3 style={{ margin: 0, color: "#101828" }}>Alpaca Paper Test</h3>
                <p style={{ margin: "0.45rem 0 0", color: "#475467", maxWidth: "42rem" }}>
                  Run a safe end-to-end paper execution test from signal validation through Alpaca
                  order submission. This panel is paper mode only and does not place live trades.
                </p>
              </div>
              {lastSuccessfulPaperTestAt ? (
                <div style={paperMetaPillStyle}>
                  Last successful test {formatDisplayTimestamp(lastSuccessfulPaperTestAt)}
                </div>
              ) : null}
            </div>

            <div style={pillRowStyle}>
              <span style={metaPillStyle}>Admin only</span>
              <span style={metaPillStyle}>Paper mode only</span>
              <span style={metaPillStyle}>Does not place live trades</span>
            </div>

            {paperTestNotice ? (
              <div style={noticeStyle(paperTestNotice.tone)}>
                <strong>
                  {paperTestNotice.tone === "success"
                    ? "Success"
                    : paperTestNotice.tone === "error"
                      ? "Error"
                      : "Info"}
                </strong>
                <p style={{ margin: 0 }}>{paperTestNotice.message}</p>
              </div>
            ) : null}

            <div style={actionsRowStyle}>
              <button
                type="button"
                onClick={() => void handleRunPaperTest()}
                disabled={areAdminPaperActionsDisabled}
                style={primaryButtonStyle(areAdminPaperActionsDisabled)}
              >
                {isRunningPaperTest ? "Running..." : "Run Paper Test"}
              </button>
              <button
                type="button"
                onClick={handleAlpacaConnectionTest}
                disabled={areAdminPaperActionsDisabled}
                style={secondaryButtonStyle(areAdminPaperActionsDisabled)}
              >
                {isTestingAlpacaConnection ? "Testing..." : "Test Alpaca Connection"}
              </button>
              {latestPaperTestResult?.tradeId ? (
                <button
                  type="button"
                  onClick={() => void handleRunPaperTest(latestPaperTestResult.tradeId)}
                  disabled={areAdminPaperActionsDisabled}
                  style={secondaryButtonStyle(areAdminPaperActionsDisabled)}
                >
                  Re-run same trade ID
                </button>
              ) : null}
            </div>

            {latestPaperTestState ? (
              <div style={paperSummaryStyle(latestPaperTestState.tone)}>
                <div>
                  <strong>{latestPaperTestState.label}</strong>
                  <p style={{ margin: "0.35rem 0 0" }}>{latestPaperTestState.detail}</p>
                </div>
              </div>
            ) : null}

            {latestPaperTestResult ? (
              <div style={paperResultCardStyle}>
                <div style={sectionHeaderStyle}>
                  <div>
                    <strong style={{ color: "#101828" }}>Latest paper test result</strong>
                    <p style={{ margin: "0.35rem 0 0", color: "#667085" }}>
                      Review the latest admin paper test outcome and reuse identifiers for quick
                      idempotency checks.
                    </p>
                  </div>
                </div>

                <div style={resultGridStyle}>
                  <ResultRow label="OK" value={formatBoolean(latestPaperTestResult.ok)} />
                  <ResultRow
                    label="Trade ID"
                    value={latestPaperTestResult.tradeId ?? "Not returned"}
                    actionLabel="Copy"
                    onAction={
                      latestPaperTestResult.tradeId
                        ? () => void handleCopyValue("Trade ID", latestPaperTestResult.tradeId)
                        : undefined
                    }
                  />
                  <ResultRow
                    label="Execution ID"
                    value={latestPaperTestResult.executionId ?? "Not returned"}
                    actionLabel="Copy"
                    onAction={
                      latestPaperTestResult.executionId
                        ? () => void handleCopyValue("Execution ID", latestPaperTestResult.executionId)
                        : undefined
                    }
                  />
                  <ResultRow
                    label="Validation"
                    value={formatValidation(latestPaperTestResult.validation)}
                  />
                  <ResultRow
                    label="Execution status"
                    value={latestPaperTestResult.execution?.status ?? "Not returned"}
                  />
                  <ResultRow
                    label="Execution skipped"
                    value={formatBoolean(latestPaperTestResult.execution?.skipped)}
                  />
                  <ResultRow
                    label="Execution submitted"
                    value={formatBoolean(latestPaperTestResult.execution?.submitted)}
                  />
                  <ResultRow
                    label="Reason"
                    value={latestPaperTestResult.execution?.reason ?? "Not returned"}
                  />
                  <ResultRow
                    label="Alpaca order ID"
                    value={latestPaperTestResult.execution?.alpacaOrderId ?? "Not returned"}
                    actionLabel="Copy"
                    onAction={
                      latestPaperTestResult.execution?.alpacaOrderId
                        ? () =>
                            void handleCopyValue(
                              "Alpaca order ID",
                              latestPaperTestResult.execution?.alpacaOrderId ?? undefined
                            )
                        : undefined
                    }
                  />
                  <ResultRow
                    label="Trade created"
                    value={formatBoolean(latestPaperTestResult.tradeCreated)}
                  />
                  <ResultRow
                    label="Reused trade"
                    value={formatBoolean(latestPaperTestResult.reusedTrade)}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div style={executionPanelStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <h3 style={{ margin: 0, color: "#101828" }}>Latest execution attempts</h3>
                <p style={{ margin: "0.45rem 0 0", color: "#475467" }}>
                  A quick read on recent paper execution activity across queued, submitted,
                  accepted, partial-fill, filled, rejected, skipped, and failed states.
                </p>
              </div>
              <div style={filterPillRowStyle}>
                <FilterPill
                  label="All"
                  active={executionFilter === "all"}
                  onClick={() => setExecutionFilter("all")}
                />
                <FilterPill
                  label="Submitted"
                  active={executionFilter === "submitted"}
                  onClick={() => setExecutionFilter("submitted")}
                />
                <FilterPill
                  label="Filled"
                  active={executionFilter === "filled"}
                  onClick={() => setExecutionFilter("filled")}
                />
                <FilterPill
                  label="Rejected"
                  active={executionFilter === "rejected"}
                  onClick={() => setExecutionFilter("rejected")}
                />
                <FilterPill
                  label="Failed"
                  active={executionFilter === "failed"}
                  onClick={() => setExecutionFilter("failed")}
                />
              </div>
            </div>

            <div style={statusGridStyle}>
              <StatusCard label="Queued" value={String(executionSummary.queued)} detail="Waiting for broker submission" />
              <StatusCard label="Submitted" value={String(executionSummary.submitted)} detail="Sent to Alpaca paper routing" />
              <StatusCard label="Accepted" value={String(executionSummary.accepted)} detail="Acknowledged by broker and working" />
              <StatusCard label="Partial" value={String(executionSummary.partiallyFilled)} detail="Received a partial fill update" />
              <StatusCard label="Filled" value={String(executionSummary.filled)} detail="Confirmed with a fill timestamp" />
              <StatusCard label="Closed" value={String(executionSummary.closed)} detail="Exit lifecycle recorded as handled and closed" />
              <StatusCard label="Rejected" value={String(executionSummary.rejected)} detail="Blocked by policy or broker rejection" />
              <StatusCard label="Skipped" value={String(executionSummary.skipped)} detail="Handled operationally without submitting new broker work" />
              <StatusCard label="Failed" value={String(executionSummary.failed)} detail="Recorded with an execution error state" />
            </div>

            <div style={previewCardStyle}>
              <div style={sectionHeaderStyle}>
                <div>
                  <strong style={{ color: "#101828" }}>Paper Execution Status</strong>
                  <p style={{ margin: "0.35rem 0 0", color: "#667085" }}>
                    Newest paper execution attempts, shown read-only for admin monitoring.
                  </p>
                </div>
              </div>
              {executionRecords.length === 0 ? (
                <div style={emptyStateStyle}>
                  <strong style={{ color: "#101828" }}>No execution telemetry yet</strong>
                  <p style={{ margin: 0, color: "#667085" }}>
                    Run a paper test or wait for the next qualifying automation event to populate this panel.
                  </p>
                </div>
              ) : (
                <div style={executionStatusListStyle}>
                  {filteredExecutionRecords.slice(0, 6).map((record) => (
                    <ExecutionStatusRow key={`status-${record.id ?? record.clientOrderId}`} record={record} />
                  ))}
                </div>
              )}
            </div>

            <div style={previewCardStyle}>
              <div style={sectionHeaderStyle}>
                <div>
                  <strong style={{ color: "#101828" }}>Recent paper execution records</strong>
                  <p style={{ margin: "0.35rem 0 0", color: "#667085" }}>
                    Filtered operator view with quick-copy identifiers for broker support and replay checks.
                  </p>
                </div>
              </div>
              {executionRecords.length === 0 ? (
                <div style={emptyStateStyle}>
                  <strong style={{ color: "#101828" }}>No execution records yet</strong>
                  <p style={{ margin: 0, color: "#667085" }}>
                    The broker console will start filling in as soon as paper executions are recorded.
                  </p>
                </div>
              ) : filteredExecutionRecords.length === 0 ? (
                <div style={emptyStateStyle}>
                  <strong style={{ color: "#101828" }}>No records match this filter</strong>
                  <p style={{ margin: 0, color: "#667085" }}>
                    Try a different status view to inspect the broader execution stream.
                  </p>
                </div>
              ) : (
                <div style={executionListStyle}>
                  {filteredExecutionRecords.slice(0, 8).map((record) => (
                    <ExecutionListCard
                      key={record.id ?? record.clientOrderId}
                      record={record}
                      onCopyValue={handleCopyValue}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {!isAdmin && !hasAutomationAccess ? (
        <div style={warningCardStyle}>
          <strong>Upgrade required for live delivery</strong>
          <p style={{ margin: 0 }}>
            Automation delivery is available on Elite. You can still prepare your routing settings
            now so everything is ready when your account moves up to execution access.
          </p>
        </div>
      ) : null}

      <div style={infoPanelStyle}>
        <strong>How delivery works</strong>
        <p style={{ margin: 0 }}>
          SignalForge IQ sends approved BTC Precision Engine alerts to your configured endpoint.
          Make sure your destination is ready to receive secure signal deliveries.
        </p>
        <p style={{ margin: 0 }}>
          Elite members receive {deliveryLabel.toLowerCase()}. Pro is designed for signals and
          analytics, while Elite unlocks the execution layer.
        </p>
      </div>

      <div style={formCardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={{ margin: 0, color: "#101828" }}>Delivery Settings</h2>
            <p style={{ margin: "0.45rem 0 0", color: "#475467" }}>
              Choose where SignalForge IQ should send your approved signal alerts.
            </p>
          </div>
        </div>

        <div style={formGridStyle}>
          <label style={fieldGroupStyle}>
            <span style={fieldLabelStyle}>Enable automation</span>
            <button
              type="button"
              onClick={() => handleFieldChange("automationEnabled", !formState.automationEnabled)}
              style={toggleButtonStyle(formState.automationEnabled)}
              aria-pressed={formState.automationEnabled}
              disabled={!isAdmin && !hasAutomationAccess}
            >
              <span style={toggleKnobStyle(formState.automationEnabled)} />
              <span>{formState.automationEnabled ? "Enabled" : "Disabled"}</span>
            </button>
          </label>

          <label style={fieldGroupStyle}>
            <span style={fieldLabelStyle}>Destination URL</span>
            <input
              id="automation-webhook-url"
              name="webhookUrl"
              type="url"
              value={formState.webhookUrl}
              onChange={(event) => handleFieldChange("webhookUrl", event.target.value)}
              placeholder="https://example.com/signalforge"
              style={inputStyle(Boolean(errors.webhookUrl))}
              disabled={!isAdmin && !hasAutomationAccess}
            />
            {errors.webhookUrl ? <span style={errorTextStyle}>{errors.webhookUrl}</span> : null}
          </label>

          <label style={fieldGroupStyle}>
            <span style={fieldLabelStyle}>Verification secret</span>
            <div style={secretRowStyle}>
              <input
                id="automation-webhook-secret"
                name="webhookSecret"
                type={isSecretVisible ? "text" : "password"}
                value={formState.webhookSecret}
                onChange={(event) => handleFieldChange("webhookSecret", event.target.value)}
                placeholder="Enter your verification secret"
                style={{ ...inputStyle(Boolean(errors.webhookSecret)), flex: 1 }}
                disabled={!isAdmin && !hasAutomationAccess}
              />
              <button
                type="button"
                onClick={() => setIsSecretVisible((current) => !current)}
                style={tertiaryButtonStyle(false)}
              >
                {isSecretVisible ? "Hide" : "Show"}
              </button>
            </div>
            {errors.webhookSecret ? <span style={errorTextStyle}>{errors.webhookSecret}</span> : null}
          </label>

          <label style={fieldGroupStyle}>
            <span style={fieldLabelStyle}>Asset filters</span>
            <input
              id="automation-asset-filters"
              name="assetFilters"
              type="text"
              value={formState.assetFiltersInput}
              onChange={(event) => handleFieldChange("assetFiltersInput", event.target.value)}
              placeholder="QQQ, BTCUSD, ETHUSD"
              style={inputStyle(Boolean(errors.assetFiltersInput))}
              disabled={!isAdmin && !hasAutomationAccess}
            />
            <span style={helperTextStyle}>
              Enter comma-separated symbols. They will be trimmed, uppercased, deduplicated, and
              saved to your delivery preferences.
            </span>
            {errors.assetFiltersInput ? (
              <span style={errorTextStyle}>{errors.assetFiltersInput}</span>
            ) : null}
          </label>
        </div>

        <div style={previewCardStyle}>
          <strong>Delivery preview</strong>
          <code style={codePreviewStyle}>{JSON.stringify(normalizedAssetFilters)}</code>
        </div>

        <div style={actionsRowStyle}>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaveDisabled}
            style={primaryButtonStyle(isSaveDisabled)}
          >
            {isSaving ? "Saving..." : "Save settings"}
          </button>
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={!isAdmin && !hasAutomationAccess}
            style={secondaryButtonStyle(!isAdmin && !hasAutomationAccess)}
          >
            Test connection
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={isSaving}
            style={secondaryButtonStyle(isSaving)}
          >
            Reset changes
          </button>
        </div>
      </div>
    </section>
  );
}

type StatusCardProps = {
  label: string;
  value: string;
  detail: string;
};

function StatusCard({ label, value, detail }: StatusCardProps) {
  return (
    <div style={statusCardStyle}>
      <span style={statusLabelStyle}>{label}</span>
      <strong style={statusValueStyle}>{value}</strong>
      <p style={{ margin: 0 }}>{detail}</p>
    </div>
  );
}

type OperatorMetricCardProps = {
  label: string;
  value: string;
  detail: string;
  tone?: "success" | "warning" | "danger" | "muted";
  actionLabel?: string;
  onAction?: () => void;
};

function OperatorMetricCard({
  label,
  value,
  detail,
  tone = "muted",
  actionLabel,
  onAction,
}: OperatorMetricCardProps) {
  return (
    <div style={operatorMetricCardStyle(tone)}>
      <span style={operatorMetricLabelStyle}>{label}</span>
      <strong style={operatorMetricValueStyle}>{value}</strong>
      <p style={{ margin: 0, color: "#475467" }}>{detail}</p>
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction} style={copyButtonStyle}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

type ResultRowProps = {
  label: string;
  value: string;
  actionLabel?: string;
  onAction?: () => void;
};

function ResultRow({ label, value, actionLabel, onAction }: ResultRowProps) {
  return (
    <div style={resultRowStyle}>
      <div>
        <span style={resultLabelStyle}>{label}</span>
        <strong style={resultValueStyle}>{value}</strong>
      </div>
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction} style={copyButtonStyle}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

type FilterPillProps = {
  label: string;
  active: boolean;
  onClick: () => void;
};

function FilterPill({ label, active, onClick }: FilterPillProps) {
  return (
    <button type="button" onClick={onClick} style={filterPillStyle(active)}>
      {label}
    </button>
  );
}

type ExecutionStatusRowProps = {
  record: ExecutionRecord;
};

function ExecutionStatusRow({ record }: ExecutionStatusRowProps) {
  return (
    <div style={executionStatusRowStyle}>
      <div style={executionStatusHeaderStyle}>
        <div>
          <strong style={{ color: "#101828" }}>{record.symbol}</strong>
          <p style={{ margin: "0.25rem 0 0", color: "#667085" }}>
            {record.side.toUpperCase()} · {formatExecutionStatus(record.status)}
          </p>
        </div>
        <span style={executionTimestampStyle}>
          {formatFirestoreTimestamp(record.createdAt)}
        </span>
      </div>
      <div style={executionStatusMetaGridStyle}>
        <div>
          <span style={executionMetaLabelStyle}>Alpaca order</span>
          <div style={executionMetaValueStyle}>{record.alpacaOrderId ?? "Not submitted"}</div>
        </div>
        <div>
          <span style={executionMetaLabelStyle}>Client order</span>
          <div style={executionMetaValueStyle}>{record.clientOrderId}</div>
        </div>
        <div>
          <span style={executionMetaLabelStyle}>Broker status</span>
          <div style={executionMetaValueStyle}>{record.rawStatus ?? record.status}</div>
        </div>
        <div>
          <span style={executionMetaLabelStyle}>Filled quantity</span>
          <div style={executionMetaValueStyle}>{record.filledQty ?? "Not filled"}</div>
        </div>
        <div>
          <span style={executionMetaLabelStyle}>Average fill</span>
          <div style={executionMetaValueStyle}>{record.filledAvgPrice ?? "Not filled"}</div>
        </div>
        <div>
          <span style={executionMetaLabelStyle}>Submitted</span>
          <div style={executionMetaValueStyle}>{formatFirestoreTimestamp(record.submittedAt)}</div>
        </div>
        <div>
          <span style={executionMetaLabelStyle}>Filled</span>
          <div style={executionMetaValueStyle}>{formatFirestoreTimestamp(record.filledAt)}</div>
        </div>
        <div>
          <span style={executionMetaLabelStyle}>Canceled</span>
          <div style={executionMetaValueStyle}>{formatFirestoreTimestamp(record.canceledAt)}</div>
        </div>
      </div>
      {record.errorMessage ? (
        <div style={executionErrorStyle}>
          <span style={executionMetaLabelStyle}>Error</span>
          <div style={{ ...executionMetaValueStyle, color: "#b42318" }}>{record.errorMessage}</div>
        </div>
      ) : null}
    </div>
  );
}

type ExecutionListCardProps = {
  record: ExecutionRecord;
  onCopyValue: (label: string, value?: string | null) => Promise<void>;
};

function ExecutionListCard({ record, onCopyValue }: ExecutionListCardProps) {
  return (
    <div style={executionListItemStyle}>
      <div style={executionListTopRowStyle}>
        <div>
          <strong style={{ color: "#101828" }}>{record.symbol}</strong>
          <p style={{ margin: "0.25rem 0 0", color: "#667085" }}>
            {record.side.toUpperCase()} · {formatExecutionStatus(record.status)}
          </p>
        </div>
        <span style={executionTimestampStyle}>{formatFirestoreTimestamp(record.createdAt)}</span>
      </div>
      <div style={executionListGridStyle}>
        <div>
          <span style={executionMetaLabelStyle}>Notional</span>
          <div style={executionMetaValueStyle}>{record.notional ? `$${record.notional}` : "—"}</div>
        </div>
        <div>
          <span style={executionMetaLabelStyle}>Alpaca order ID</span>
          <div style={executionMetaValueStyle}>{record.alpacaOrderId ?? "Not submitted"}</div>
        </div>
        <div>
          <span style={executionMetaLabelStyle}>Client order ID</span>
          <div style={executionMetaValueStyle}>{record.clientOrderId}</div>
        </div>
      </div>
      <div style={executionActionsRowStyle}>
        {record.alpacaOrderId ? (
          <button
            type="button"
            onClick={() => void onCopyValue("Alpaca order ID", record.alpacaOrderId)}
            style={copyButtonStyle}
          >
            Copy order ID
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void onCopyValue("Client order ID", record.clientOrderId)}
          style={copyButtonStyle}
        >
          Copy client ID
        </button>
      </div>
    </div>
  );
}

const normalizeAssetFilters = (value: unknown) => {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  const normalizedValues = values
    .map((item) => (typeof item === "string" ? item.trim().toUpperCase() : ""))
    .filter((item) => item !== "");

  return [...new Set(normalizedValues)];
};

const capitalizeLabel = (value: string) =>
  value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : "Unknown";

const formatExecutionStatus = (value: string) =>
  value
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

const formatBoolean = (value: boolean | undefined) => {
  if (value === true) {
    return "Yes";
  }

  if (value === false) {
    return "No";
  }

  return "Not returned";
};

const formatValidation = (
  validation: RunAdminPaperExecutionTestResponse["validation"]
) => {
  if (!validation) {
    return "Not returned";
  }

  const eligibility =
    validation.eligible === true
      ? "Eligible"
      : validation.eligible === false
        ? "Not eligible"
        : "Unknown";

  return validation.reason ? `${eligibility} - ${validation.reason}` : eligibility;
};

const formatDisplayTimestamp = (isoString: string) => {
  const parsed = new Date(isoString);

  if (Number.isNaN(parsed.getTime())) {
    return "just now";
  }

  return parsed.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const formatFirestoreTimestamp = (value: unknown) => {
  if (!value) {
    return "Not available";
  }

  if (value instanceof Date) {
    return formatDisplayTimestamp(value.toISOString());
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    const date = (value as { toDate: () => Date }).toDate();
    return formatDisplayTimestamp(date.toISOString());
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value &&
    typeof (value as { seconds?: unknown }).seconds === "number"
  ) {
    const milliseconds = Number((value as { seconds: number }).seconds) * 1000;
    return formatDisplayTimestamp(new Date(milliseconds).toISOString());
  }

  if (typeof value === "string") {
    return formatDisplayTimestamp(value);
  }

  return "Not available";
};

const pageStyle = {
  maxWidth: "920px",
  margin: "0 auto",
  display: "grid",
  gap: "1.25rem",
};

const heroCardStyle = {
  display: "grid",
  gap: "1rem",
  padding: "1.75rem",
  borderRadius: "20px",
  border: "1px solid #d0d5dd",
  background:
    "linear-gradient(135deg, rgba(248,250,252,1) 0%, rgba(255,255,255,1) 55%, rgba(236,253,243,1) 100%)",
};

const heroActionsStyle = {
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap" as const,
};

const eyebrowStyle = {
  margin: "0 0 0.4rem",
  color: "#027a48",
  fontSize: "0.85rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
};

const statusGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "0.85rem",
};

const statusCardStyle = {
  display: "grid",
  gap: "0.35rem",
  padding: "1.15rem",
  borderRadius: "16px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#f8fafc",
};

const statusLabelStyle = {
  color: "#475467",
  fontSize: "0.85rem",
  fontWeight: 700,
};

const statusValueStyle = {
  color: "#101828",
  fontSize: "1.2rem",
};

const warningCardStyle = {
  display: "grid",
  gap: "0.6rem",
  padding: "1rem 1.1rem",
  borderRadius: "16px",
  border: "1px solid #f7b267",
  backgroundColor: "#fff7ed",
  color: "#9a3412",
};

const loadingCardStyle = {
  display: "grid",
  gap: "0.75rem",
  padding: "1.6rem",
  borderRadius: "18px",
  border: "1px solid #d0d5dd",
  background:
    "linear-gradient(135deg, rgba(248,250,252,1) 0%, rgba(255,255,255,1) 48%, rgba(236,253,243,1) 100%)",
};

const infoPanelStyle = {
  display: "grid",
  gap: "0.75rem",
  padding: "1rem 1.1rem",
  borderRadius: "16px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#ffffff",
};

const formCardStyle = {
  display: "grid",
  gap: "1.2rem",
  padding: "1.5rem",
  borderRadius: "18px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#f8fafc",
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "1rem",
  flexWrap: "wrap" as const,
};

const formGridStyle = {
  display: "grid",
  gap: "1rem",
};

const fieldGroupStyle = {
  display: "grid",
  gap: "0.45rem",
};

const fieldLabelStyle = {
  color: "#101828",
  fontWeight: 700,
};

const inputStyle = (hasError: boolean) => ({
  width: "100%",
  borderRadius: "12px",
  border: `1px solid ${hasError ? "#f04438" : "#d0d5dd"}`,
  padding: "0.85rem 0.95rem",
  fontSize: "1rem",
  backgroundColor: "#ffffff",
  color: "#101828",
});

const helperTextStyle = {
  color: "#667085",
  fontSize: "0.92rem",
};

const errorTextStyle = {
  color: "#b42318",
  fontSize: "0.92rem",
  fontWeight: 600,
};

const secretRowStyle = {
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap" as const,
};

const toggleButtonStyle = (enabled: boolean) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: "0.75rem",
  width: "fit-content",
  border: `1px solid ${enabled ? "#12b76a" : "#d0d5dd"}`,
  borderRadius: "999px",
  padding: "0.45rem 0.75rem 0.45rem 0.45rem",
  backgroundColor: enabled ? "#ecfdf3" : "#ffffff",
  color: enabled ? "#027a48" : "#344054",
  fontWeight: 700,
  cursor: "pointer",
});

const toggleKnobStyle = (enabled: boolean) => ({
  width: "1.6rem",
  height: "1.6rem",
  borderRadius: "999px",
  backgroundColor: enabled ? "#12b76a" : "#d0d5dd",
  boxShadow: "inset 0 0 0 4px #ffffff",
});

const previewCardStyle = {
  display: "grid",
  gap: "0.6rem",
  padding: "1rem",
  borderRadius: "14px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#ffffff",
};

const alpacaCardStyle = {
  display: "grid",
  gap: "1.2rem",
  padding: "1.5rem",
  borderRadius: "18px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#f8fafc",
};

const operatorConsoleStyle = {
  display: "grid",
  gap: "1rem",
  padding: "1.15rem",
  borderRadius: "18px",
  border: "1px solid #d0d5dd",
  background:
    "linear-gradient(140deg, rgba(255,255,255,1) 0%, rgba(248,250,252,1) 58%, rgba(240,253,244,1) 100%)",
};

const futureOnboardingCardStyle = {
  display: "grid",
  gap: "1rem",
  padding: "1.15rem",
  borderRadius: "18px",
  border: "1px solid #d0d5dd",
  background:
    "linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(248,250,252,1) 62%, rgba(254,249,195,0.35) 100%)",
};

const operatorStatusGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "0.85rem",
};

const operatorMetricCardStyle = (tone: "success" | "warning" | "danger" | "muted") => ({
  display: "grid",
  gap: "0.45rem",
  padding: "1rem",
  borderRadius: "14px",
  border:
    tone === "success"
      ? "1px solid #abefc6"
      : tone === "warning"
        ? "1px solid #f7b267"
        : tone === "danger"
          ? "1px solid #fda29b"
          : "1px solid #d0d5dd",
  backgroundColor:
    tone === "success"
      ? "#ecfdf3"
      : tone === "warning"
        ? "#fff7ed"
        : tone === "danger"
          ? "#fef3f2"
          : "#ffffff",
});

const operatorMetricLabelStyle = {
  color: "#475467",
  fontSize: "0.8rem",
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
};

const operatorMetricValueStyle = {
  color: "#101828",
  fontSize: "1.1rem",
  lineHeight: 1.35,
  wordBreak: "break-word" as const,
};

const paperTestCardStyle = {
  display: "grid",
  gap: "1rem",
  padding: "1.15rem",
  borderRadius: "16px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#ffffff",
};

const alpacaDetailsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "0.85rem",
};

const executionPanelStyle = {
  display: "grid",
  gap: "1rem",
};

const executionListStyle = {
  display: "grid",
  gap: "0.75rem",
};

const executionListGridStyle = {
  display: "grid",
  gap: "0.85rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
};

const executionStatusListStyle = {
  display: "grid",
  gap: "0.85rem",
};

const executionStatusRowStyle = {
  display: "grid",
  gap: "0.85rem",
  padding: "0.95rem 1rem",
  borderRadius: "14px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#fcfcfd",
};

const executionStatusHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "0.85rem",
  alignItems: "flex-start",
  flexWrap: "wrap" as const,
};

const executionTimestampStyle = {
  color: "#667085",
  fontSize: "0.85rem",
  fontWeight: 600,
};

const executionStatusMetaGridStyle = {
  display: "grid",
  gap: "0.85rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const executionMetaLabelStyle = {
  display: "block",
  marginBottom: "0.25rem",
  color: "#475467",
  fontSize: "0.78rem",
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
};

const executionMetaValueStyle = {
  color: "#101828",
  fontSize: "0.95rem",
  lineHeight: 1.45,
  wordBreak: "break-word" as const,
};

const executionErrorStyle = {
  padding: "0.85rem 0.9rem",
  borderRadius: "12px",
  border: "1px solid #fecdca",
  backgroundColor: "#fef3f2",
};

const executionListItemStyle = {
  display: "grid",
  gap: "0.9rem",
  padding: "0.9rem 1rem",
  borderRadius: "12px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#ffffff",
};

const executionListTopRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "0.75rem",
  alignItems: "flex-start",
  flexWrap: "wrap" as const,
};

const executionActionsRowStyle = {
  display: "flex",
  gap: "0.6rem",
  flexWrap: "wrap" as const,
};

const resultGridStyle = {
  display: "grid",
  gap: "0.75rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const resultRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "0.85rem",
  padding: "0.9rem 1rem",
  borderRadius: "12px",
  border: "1px solid #eaecf0",
  backgroundColor: "#fcfcfd",
};

const resultLabelStyle = {
  display: "block",
  marginBottom: "0.3rem",
  color: "#475467",
  fontSize: "0.8rem",
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
};

const resultValueStyle = {
  color: "#101828",
  fontSize: "0.98rem",
  lineHeight: 1.45,
  wordBreak: "break-word" as const,
};

const codePreviewStyle = {
  display: "block",
  padding: "0.85rem 1rem",
  borderRadius: "12px",
  backgroundColor: "#101828",
  color: "#ecfdf3",
  overflowX: "auto" as const,
  fontSize: "0.95rem",
};

const actionsRowStyle = {
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap" as const,
};

const pillRowStyle = {
  display: "flex",
  gap: "0.55rem",
  flexWrap: "wrap" as const,
};

const filterPillRowStyle = {
  display: "flex",
  gap: "0.55rem",
  flexWrap: "wrap" as const,
};

const filterPillStyle = (active: boolean) => ({
  border: `1px solid ${active ? "#12b76a" : "#d0d5dd"}`,
  borderRadius: "999px",
  padding: "0.5rem 0.8rem",
  backgroundColor: active ? "#ecfdf3" : "#ffffff",
  color: active ? "#067647" : "#344054",
  fontWeight: 700,
  cursor: "pointer",
});

const metaPillStyle = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "999px",
  padding: "0.35rem 0.65rem",
  border: "1px solid #d0d5dd",
  backgroundColor: "#f8fafc",
  color: "#344054",
  fontSize: "0.82rem",
  fontWeight: 700,
};

const paperMetaPillStyle = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "999px",
  padding: "0.4rem 0.75rem",
  border: "1px solid #b7d7c5",
  backgroundColor: "#ecfdf3",
  color: "#027a48",
  fontSize: "0.82rem",
  fontWeight: 700,
};

const paperResultCardStyle = {
  display: "grid",
  gap: "1rem",
  padding: "1rem",
  borderRadius: "14px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#ffffff",
};

const paperSummaryStyle = (tone: "success" | "error" | "info") => ({
  display: "grid",
  gap: "0.35rem",
  padding: "0.95rem 1rem",
  borderRadius: "14px",
  border:
    tone === "success"
      ? "1px solid #abefc6"
      : tone === "error"
        ? "1px solid #fda29b"
        : "1px solid #b2ddff",
  backgroundColor:
    tone === "success" ? "#ecfdf3" : tone === "error" ? "#fef3f2" : "#eff8ff",
  color: tone === "success" ? "#067647" : tone === "error" ? "#b42318" : "#175cd3",
});

const primaryButtonStyle = (isDisabled: boolean) => ({
  border: 0,
  borderRadius: "12px",
  padding: "0.9rem 1.2rem",
  backgroundColor: isDisabled ? "#98a2b3" : "#101828",
  color: "#ffffff",
  fontWeight: 700,
  cursor: isDisabled ? "not-allowed" : "pointer",
});

const secondaryButtonStyle = (isDisabled: boolean) => ({
  border: "1px solid #d0d5dd",
  borderRadius: "12px",
  padding: "0.9rem 1.2rem",
  backgroundColor: isDisabled ? "#f2f4f7" : "#ffffff",
  color: "#344054",
  fontWeight: 700,
  cursor: isDisabled ? "not-allowed" : "pointer",
  opacity: isDisabled ? 0.7 : 1,
});

const tertiaryButtonStyle = (isDisabled: boolean) => ({
  border: "1px solid #d0d5dd",
  borderRadius: "12px",
  padding: "0.85rem 1rem",
  backgroundColor: isDisabled ? "#f2f4f7" : "#ffffff",
  color: "#344054",
  fontWeight: 700,
  cursor: isDisabled ? "not-allowed" : "pointer",
  opacity: isDisabled ? 0.7 : 1,
});

const copyButtonStyle = {
  border: "1px solid #d0d5dd",
  borderRadius: "10px",
  padding: "0.55rem 0.75rem",
  backgroundColor: "#ffffff",
  color: "#344054",
  fontWeight: 700,
  cursor: "pointer",
};

const emptyStateStyle = {
  display: "grid",
  gap: "0.45rem",
  padding: "1rem 1.05rem",
  borderRadius: "14px",
  border: "1px dashed #d0d5dd",
  backgroundColor: "#fcfcfd",
};

const secondaryLinkStyle = {
  display: "inline-flex",
  textDecoration: "none",
  padding: "0.85rem 1rem",
  borderRadius: "12px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#ffffff",
  color: "#344054",
  fontWeight: 700,
};

const noticeStyle = (tone: "success" | "error" | "info") => {
  if (tone === "success") {
    return {
      display: "grid",
      gap: "0.35rem",
      padding: "1rem 1.1rem",
      borderRadius: "14px",
      border: "1px solid #abefc6",
      backgroundColor: "#ecfdf3",
      color: "#067647",
    };
  }

  if (tone === "error") {
    return {
      display: "grid",
      gap: "0.35rem",
      padding: "1rem 1.1rem",
      borderRadius: "14px",
      border: "1px solid #fda29b",
      backgroundColor: "#fef3f2",
      color: "#b42318",
    };
  }

  return {
    display: "grid",
    gap: "0.35rem",
    padding: "1rem 1.1rem",
    borderRadius: "14px",
    border: "1px solid #b2ddff",
    backgroundColor: "#eff8ff",
    color: "#175cd3",
  };
};

export default AutomationPage;
