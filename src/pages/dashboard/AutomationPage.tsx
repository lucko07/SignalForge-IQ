import { useEffect, useMemo, useState } from "react";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/auth-context";
import { db } from "../../lib/firebase";

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

function AutomationPage() {
  const { currentUser, loading: authLoading, refreshProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSecretVisible, setIsSecretVisible] = useState(false);
  const [profileData, setProfileData] = useState<AutomationProfileDocument | null>(null);
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

        setProfileData(nextProfileData);
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
          message:
            error instanceof Error && error.message.trim()
              ? error.message.trim()
              : "Unable to load automation settings right now.",
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

  const normalizedPlan = useMemo(() => {
    const rawPlan = profileData?.plan ?? profileData?.currentPlan ?? "free";
    return typeof rawPlan === "string" ? rawPlan.trim().toLowerCase() : "free";
  }, [profileData]);

  const deliveryLabel = useMemo(() => {
    if (normalizedPlan === "elite") {
      return "Real-time delivery";
    }

    if (normalizedPlan === "pro") {
      return "Standard delivery";
    }

    return "Plan review recommended";
  }, [normalizedPlan]);

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
      nextErrors.webhookUrl = "Webhook URL is required when automation is enabled.";
    }

    if (formState.automationEnabled && !formState.webhookSecret.trim()) {
      nextErrors.webhookSecret = "Webhook secret is required when automation is enabled.";
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
      const userReference = doc(db, "users", currentUser.uid);
      const webhookReference = doc(db, "users", currentUser.uid, "webhooks", "default");

      await Promise.all([
        setDoc(
          userReference,
          {
            webhookEnabled: formState.automationEnabled,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ),
        setDoc(
          webhookReference,
          {
            enabled: formState.automationEnabled,
            url: formState.webhookUrl.trim(),
            secret: formState.webhookSecret.trim(),
            assetFilters: normalizedAssetFilters,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ),
      ]);

      const nextInitialState = {
        automationEnabled: formState.automationEnabled,
        webhookUrl: formState.webhookUrl.trim(),
        webhookSecret: formState.webhookSecret.trim(),
        assetFiltersInput: normalizedAssetFilters.join(", "),
      };

      setHasWebhookConfig(true);
      setInitialFormState(nextInitialState);
      setFormState(nextInitialState);
      setProfileData((current) => ({
        ...current,
        webhookEnabled: nextInitialState.automationEnabled,
      }));
      setNotice({
        tone: "success",
        message: "Automation settings saved successfully.",
      });
      await refreshProfile();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : "Unable to save automation settings right now.",
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
        "Test connection is available in the interface now. Backend test delivery can be wired in next.",
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
            Connect a webhook endpoint to receive approved signals automatically. Your settings are
            stored securely in Firestore and can be updated any time without affecting the rest of
            your account profile.
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
          detail={formState.automationEnabled ? "Signals can be sent to your endpoint." : "No webhook delivery will be attempted."}
        />
        <StatusCard
          label="Webhook Config"
          value={hasWebhookConfig ? "Configured" : "Not configured"}
          detail={hasWebhookConfig ? "Default webhook document found." : "A default webhook document will be created on save."}
        />
      </div>

      {normalizedPlan !== "elite" && normalizedPlan !== "pro" ? (
        <div style={warningCardStyle}>
          <strong>Plan check recommended</strong>
          <p style={{ margin: 0 }}>
            Webhook automation may not be available on your current plan. You can still save your
            settings now so the backend is ready when access is enabled.
          </p>
        </div>
      ) : null}

      <div style={infoPanelStyle}>
        <strong>Webhook behavior</strong>
        <p style={{ margin: 0 }}>
          SignalForge IQ sends JSON `POST` requests to your configured endpoint. Make sure your
          receiver can accept JSON payloads and validate the shared secret on incoming requests.
        </p>
        <p style={{ margin: 0 }}>
          Elite members currently see {deliveryLabel.toLowerCase()}, while Pro is designed to
          support standard delivery behavior as the backend expands.
        </p>
      </div>

      <div style={formCardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={{ margin: 0, color: "#101828" }}>Webhook Settings</h2>
            <p style={{ margin: "0.45rem 0 0", color: "#475467" }}>
              Configure the default webhook stored at `users/{currentUser.uid}/webhooks/default`.
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
            >
              <span style={toggleKnobStyle(formState.automationEnabled)} />
              <span>{formState.automationEnabled ? "Enabled" : "Disabled"}</span>
            </button>
          </label>

          <label style={fieldGroupStyle}>
            <span style={fieldLabelStyle}>Webhook URL</span>
            <input
              type="url"
              value={formState.webhookUrl}
              onChange={(event) => handleFieldChange("webhookUrl", event.target.value)}
              placeholder="https://example.com/webhooks/signalforge"
              style={inputStyle(Boolean(errors.webhookUrl))}
            />
            {errors.webhookUrl ? <span style={errorTextStyle}>{errors.webhookUrl}</span> : null}
          </label>

          <label style={fieldGroupStyle}>
            <span style={fieldLabelStyle}>Webhook secret</span>
            <div style={secretRowStyle}>
              <input
                type={isSecretVisible ? "text" : "password"}
                value={formState.webhookSecret}
                onChange={(event) => handleFieldChange("webhookSecret", event.target.value)}
                placeholder="Enter your shared secret"
                style={{ ...inputStyle(Boolean(errors.webhookSecret)), flex: 1 }}
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
            />
            <span style={helperTextStyle}>
              Enter comma-separated symbols. They will be trimmed, uppercased, deduplicated, and
              saved as a Firestore array of strings.
            </span>
            {errors.assetFiltersInput ? (
              <span style={errorTextStyle}>{errors.assetFiltersInput}</span>
            ) : null}
          </label>
        </div>

        <div style={previewCardStyle}>
          <strong>Stored preview</strong>
          <code style={codePreviewStyle}>
            {JSON.stringify(normalizedAssetFilters)}
          </code>
        </div>

        <div style={actionsRowStyle}>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            style={primaryButtonStyle(isSaving)}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={handleTestConnection}
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
            Clear/reset
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
