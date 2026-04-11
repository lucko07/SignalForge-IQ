import { useEffect, useMemo, useState } from "react";
import {
  doc,
  getDoc,
} from "firebase/firestore";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/auth-context";
import { saveAutomationSettings } from "../../lib/automation";
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

const DEFAULT_FORM_STATE: FormState = {
  automationEnabled: false,
  webhookUrl: "",
  webhookSecret: "",
  assetFiltersInput: "",
};

const getAutomationUiErrorMessage = (error: unknown, fallbackMessage: string) => (
  error instanceof Error && error.message.trim()
    ? error.message.trim()
    : fallbackMessage
);

function AutomationPage() {
  const {
    currentUser,
    loading: authLoading,
    refreshProfile,
    profile,
    isAdmin,
  } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSecretVisible, setIsSecretVisible] = useState(false);
  const [hasWebhookConfig, setHasWebhookConfig] = useState(false);
  const [initialFormState, setInitialFormState] = useState<FormState>(DEFAULT_FORM_STATE);
  const [formState, setFormState] = useState<FormState>(DEFAULT_FORM_STATE);
  const [errors, setErrors] = useState<FormErrors>({});
  const [notice, setNotice] = useState<NoticeState>(null);

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
          ? profileSnapshot.data() as AutomationProfileDocument
          : null;
        const webhookData = webhookSnapshot.exists()
          ? webhookSnapshot.data() as WebhookConfigDocument
          : null;
        const nextFormState = {
          automationEnabled:
            (typeof nextProfileData?.webhookEnabled === "boolean"
              ? nextProfileData.webhookEnabled
              : webhookData?.enabled === true),
          webhookUrl: typeof webhookData?.url === "string" ? webhookData.url : "",
          webhookSecret: typeof webhookData?.secret === "string" ? webhookData.secret : "",
          assetFiltersInput: normalizeAssetFilters(webhookData?.assetFilters).join(", "),
        };

        setHasWebhookConfig(webhookSnapshot.exists());
        setInitialFormState(nextFormState);
        setFormState(nextFormState);
        setErrors({});
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
  }, [authLoading, currentUser]);

  const normalizedPlan = useMemo(
    () => getEffectiveManagedPlan(profile),
    [profile]
  );
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

  const normalizedAssetFilters = useMemo(
    () => normalizeAssetFilters(formState.assetFiltersInput),
    [formState.assetFiltersInput]
  );

  const handleFieldChange = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));

    setErrors((current) => ({
      ...current,
      [field]: undefined,
    }));

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
      setNotice({
        tone: "success",
        message: "Automation settings saved successfully.",
      });
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
    setNotice({
      tone: "info",
      message: "Unsaved changes were reset.",
    });
  };

  const handleTestConnection = () => {
    setNotice({
      tone: "info",
      message:
        "Test delivery will be available here soon.",
    });
  };

  if (authLoading || isLoading) {
    return (
      <section style={pageStyle}>
        <h1>Automation</h1>
        <p style={{ margin: 0 }}>Loading your automation settings...</p>
      </section>
    );
  }

  if (!currentUser) {
    return (
      <section style={pageStyle}>
        <h1>Automation</h1>
        <p style={{ margin: 0 }}>
          You need to be signed in to manage automation settings.
        </p>
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
          <strong>{notice.tone === "success" ? "Saved" : notice.tone === "error" ? "Error" : "Info"}</strong>
          <p style={{ margin: 0 }}>{notice.message}</p>
        </div>
      ) : null}

      <div style={statusGridStyle}>
        <StatusCard
          label="Plan"
          value={capitalizeLabel(normalizedPlan)}
          detail={deliveryLabel}
        />
        <StatusCard
          label="Automation"
          value={formState.automationEnabled ? "Enabled" : "Disabled"}
          detail={formState.automationEnabled ? "Approved signals can be delivered to your endpoint." : "Automatic delivery is currently turned off."}
        />
        <StatusCard
          label="Delivery Setup"
          value={hasWebhookConfig ? "Configured" : "Not configured"}
          detail={hasWebhookConfig ? "Your delivery endpoint is ready." : "Your delivery settings will be created when you save."}
        />
      </div>

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
                style={tertiaryButtonStyle}
              >
                {isSecretVisible ? "Hide" : "Show"}
              </button>
            </div>
            {errors.webhookSecret ? <span style={errorTextStyle}>{errors.webhookSecret}</span> : null}
          </label>

          <label style={fieldGroupStyle}>
            <span style={fieldLabelStyle}>Asset filters</span>
            <input
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
          <code style={codePreviewStyle}>
            {JSON.stringify(normalizedAssetFilters)}
          </code>
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
            style={secondaryButtonStyle}
          >
            Test connection
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={isSaving}
            style={secondaryButtonStyle}
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

const capitalizeLabel = (value: string) => (
  value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : "Unknown"
);

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

const primaryButtonStyle = (isDisabled: boolean) => ({
  border: 0,
  borderRadius: "12px",
  padding: "0.9rem 1.2rem",
  backgroundColor: isDisabled ? "#98a2b3" : "#101828",
  color: "#ffffff",
  fontWeight: 700,
  cursor: isDisabled ? "not-allowed" : "pointer",
});

const secondaryButtonStyle = {
  border: "1px solid #d0d5dd",
  borderRadius: "12px",
  padding: "0.9rem 1.2rem",
  backgroundColor: "#ffffff",
  color: "#344054",
  fontWeight: 700,
  cursor: "pointer",
};

const tertiaryButtonStyle = {
  border: "1px solid #d0d5dd",
  borderRadius: "12px",
  padding: "0.85rem 1rem",
  backgroundColor: "#ffffff",
  color: "#344054",
  fontWeight: 700,
  cursor: "pointer",
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
