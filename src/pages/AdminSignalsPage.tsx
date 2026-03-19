import { useEffect, useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";
import { Link } from "react-router-dom";
import SignalCard from "../components/SignalCard";
import { useAuth } from "../context/AuthProvider";
import {
  approvePendingSignal,
  closeSignal,
  closeSignalReasons,
  type CloseSignalReason,
  rejectPendingSignal,
  signalStatuses,
  subscribeToSignals,
  subscribeToPendingSignals,
  updateSignalStatus,
  updatePendingSignal,
} from "../lib/firestore";
import type { PendingSignal, Signal, SignalInput, SignalStatus } from "../lib/firestore";

type AdminSignalForm = {
  symbol: string;
  assetType: string;
  direction: string;
  entry: string;
  stopLoss: string;
  target: string;
  thesis: string;
  status: string;
  source: string;
};

const initialFormState: AdminSignalForm = {
  symbol: "",
  assetType: "crypto",
  direction: "LONG",
  entry: "",
  stopLoss: "",
  target: "",
  thesis: "",
  status: "ACTIVE",
  source: "webhook",
};

const initialCloseFormState = {
  closeReason: "TAKE_PROFIT" as CloseSignalReason,
  exitPrice: "",
};

function AdminSignalsPage() {
  const { currentUser } = useAuth();
  const [pendingSignals, setPendingSignals] = useState<PendingSignal[]>([]);
  const [approvedSignals, setApprovedSignals] = useState<Signal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isApprovedSignalsLoading, setIsApprovedSignalsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [approvedSignalsError, setApprovedSignalsError] = useState("");
  const [editingSignalId, setEditingSignalId] = useState<string | null>(null);
  const [formData, setFormData] = useState<AdminSignalForm>(initialFormState);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busySignalId, setBusySignalId] = useState<string | null>(null);
  const [busyApprovedSignalId, setBusyApprovedSignalId] = useState<string | null>(null);
  const [closingSignalId, setClosingSignalId] = useState<string | null>(null);
  const [closeFormData, setCloseFormData] = useState(initialCloseFormState);
  const [closeFormError, setCloseFormError] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeToPendingSignals(
      (signals) => {
        setPendingSignals(signals);
        setLoadError("");
        setIsLoading(false);
      },
      () => {
        setPendingSignals([]);
        setLoadError("Unable to load pending signals right now.");
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToSignals(
      (signals) => {
        setApprovedSignals(signals);
        setApprovedSignalsError("");
        setIsApprovedSignalsLoading(false);
      },
      undefined,
      () => {
        setApprovedSignals([]);
        setApprovedSignalsError("Unable to load approved signals right now.");
        setIsApprovedSignalsLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const handleFieldChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const startEditing = (signal: PendingSignal) => {
    setEditingSignalId(signal.id);
    setFormData({
      symbol: signal.symbol,
      assetType: signal.assetType,
      direction: signal.direction,
      entry: signal.entry,
      stopLoss: signal.stopLoss,
      target: signal.target,
      thesis: signal.thesis,
      status: signal.status,
      source: signal.source ?? "webhook",
    });
    setFormError("");
    setActionError("");
  };

  const resetEditor = () => {
    setEditingSignalId(null);
    setFormData(initialFormState);
    setFormError("");
  };

  const handleSaveEdits = async (pendingSignalId: string) => {
    const normalizedData = getValidatedFormData(formData);

    if (!normalizedData) {
      setFormError("Fill in all signal fields before saving.");
      return;
    }

    setBusySignalId(pendingSignalId);
    setActionError("");

    try {
      await updatePendingSignal(pendingSignalId, normalizedData);
      resetEditor();
    } catch (error) {
      console.error("Failed to save pending signal edits.", error);
      setFormError(getFirebaseErrorMessage(error, "Unable to save edits right now."));
    } finally {
      setBusySignalId(null);
    }
  };

  const handleApprove = async (signal: PendingSignal) => {
    const approvalUpdates =
      editingSignalId === signal.id ? getValidatedFormData(formData) : undefined;

    if (editingSignalId === signal.id && !approvalUpdates) {
      setFormError("Fill in all signal fields before approving.");
      return;
    }

    setBusySignalId(signal.id);
    setActionError("");

    try {
      await approvePendingSignal(
        signal.id,
        currentUser?.uid ?? "admin",
        approvalUpdates ?? undefined
      );
      resetEditor();
    } catch (error) {
      console.error("Failed to approve pending signal.", error);
      setActionError(getFirebaseErrorMessage(error, "Unable to approve this signal right now."));
    } finally {
      setBusySignalId(null);
    }
  };

  const handleReject = async (pendingSignalId: string) => {
    setBusySignalId(pendingSignalId);
    setActionError("");

    try {
      await rejectPendingSignal(pendingSignalId, currentUser?.uid ?? "admin");

      if (editingSignalId === pendingSignalId) {
        resetEditor();
      }
    } catch (error) {
      console.error("Failed to reject pending signal.", error);
      setActionError(getFirebaseErrorMessage(error, "Unable to reject this signal right now."));
    } finally {
      setBusySignalId(null);
    }
  };

  const handleLifecycleStatusUpdate = async (
    signalId: string,
    status: SignalStatus
  ) => {
    setBusyApprovedSignalId(signalId);
    setActionError("");

    try {
      await updateSignalStatus(signalId, status, currentUser?.uid ?? "admin");
    } catch (error) {
      console.error("Failed to update signal status.", error);
      setActionError(getFirebaseErrorMessage(error, "Unable to update this signal right now."));
    } finally {
      setBusyApprovedSignalId(null);
    }
  };

  const startClosingSignal = (signal: Signal) => {
    setClosingSignalId(signal.id);
    setCloseFormData({
      closeReason: signal.status === "CANCELLED" ? "CANCELLED" : "TAKE_PROFIT",
      exitPrice: signal.exitPrice ?? "",
    });
    setCloseFormError("");
    setActionError("");
  };

  const resetCloseForm = () => {
    setClosingSignalId(null);
    setCloseFormData(initialCloseFormState);
    setCloseFormError("");
  };

  const handleCloseFieldChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;

    setCloseFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleCloseSignal = async (signal: Signal) => {
    const requiresExitPrice = closeFormData.closeReason !== "CANCELLED";
    const normalizedExitPrice = closeFormData.exitPrice.trim();

    if (requiresExitPrice && !normalizedExitPrice) {
      setCloseFormError("Exit price is required for this close action.");
      return;
    }

    setBusyApprovedSignalId(signal.id);
    setActionError("");
    setCloseFormError("");

    try {
      await closeSignal(
        signal.id,
        closeFormData.closeReason,
        currentUser?.uid ?? "admin",
        requiresExitPrice ? normalizedExitPrice : undefined
      );
      resetCloseForm();
    } catch (error) {
      console.error("Failed to close signal.", error);
      setCloseFormError(getFirebaseErrorMessage(error, "Unable to close this signal right now."));
    } finally {
      setBusyApprovedSignalId(null);
    }
  };

  return (
    <section style={{ maxWidth: "920px", margin: "0 auto", display: "grid", gap: "1rem" }}>
      <div
        style={{
          padding: "1.5rem",
          border: "1px solid #d0d5dd",
          borderRadius: "20px",
          backgroundColor: "#f8fafc",
          display: "grid",
          gap: "0.75rem",
        }}
      >
        <div>
          <h1 style={{ margin: "0 0 0.4rem" }}>Signal Review</h1>
          <p style={{ margin: 0, color: "#475467" }}>
            Review incoming signals, edit them if needed, then approve, reject,
            and manage their lifecycle statuses.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <span style={summaryPillStyle}>
            {pendingSignals.length} pending signal{pendingSignals.length === 1 ? "" : "s"}
          </span>
          <span style={summaryPillStyle}>
            {approvedSignals.length} approved signal{approvedSignals.length === 1 ? "" : "s"}
          </span>
          <Link to="/dashboard" style={secondaryLinkStyle}>
            Back to dashboard
          </Link>
        </div>
      </div>

      {isLoading ? <p style={{ margin: 0 }}>Loading pending signals...</p> : null}

      {!isLoading && loadError ? (
        <div style={errorBannerStyle}>
          <strong>Pending queue unavailable.</strong>
          <p style={{ margin: "0.4rem 0 0" }}>{loadError}</p>
        </div>
      ) : null}

      {!isLoading && !loadError && pendingSignals.length === 0 ? (
        <div style={emptyStateStyle}>
          <h2 style={{ margin: 0, color: "#101828" }}>No pending signals</h2>
          <p style={{ margin: 0, color: "#475467" }}>
            New signals will appear here for review before they are published to
            the live feed.
          </p>
        </div>
      ) : null}

      {!isLoading && pendingSignals.length > 0 ? (
        <div style={{ display: "grid", gap: "1rem" }}>
          {pendingSignals.map((signal) => {
            const isEditing = editingSignalId === signal.id;
            const isBusy = busySignalId === signal.id;

            return (
              <article
                key={signal.id}
                style={{
                  display: "grid",
                  gap: "1rem",
                  padding: "1rem",
                  border: "1px solid #d0d5dd",
                  borderRadius: "20px",
                  backgroundColor: "#f8fafc",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "0.75rem",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={summaryPillStyle}>Review status: {signal.reviewStatus}</span>
                  <span style={{ color: "#667085", fontSize: "0.9rem" }}>
                    Pending ID: {signal.id}
                  </span>
                </div>

                <SignalCard signal={signal} />

                <div style={reviewGridStyle}>
                  <ReviewField label="Symbol" value={signal.symbol} />
                  <ReviewField label="Asset Type" value={signal.assetType} />
                  <ReviewField label="Direction" value={signal.direction} />
                  <ReviewField label="Entry" value={signal.entry} />
                  <ReviewField label="Stop Loss" value={signal.stopLoss} />
                  <ReviewField label="Target" value={signal.target} />
                  <ReviewField label="Status" value={signal.status} />
                  <ReviewField label="Review Status" value={signal.reviewStatus} />
                  <ReviewField label="Created At" value={formatAdminDate(signal.createdAt)} />
                  <ReviewField label="Source" value={formatVisibleSource(signal.source)} />
                </div>

                <div style={auditBlockStyle}>
                  <span style={labelStyle}>Thesis</span>
                  <p style={{ margin: 0, color: "#475467" }}>{signal.thesis}</p>
                </div>

                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => handleApprove(signal)}
                    disabled={isBusy}
                    style={primaryButtonStyle(isBusy)}
                  >
                    {isBusy ? "Working..." : "Approve"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReject(signal.id)}
                    disabled={isBusy}
                    style={dangerButtonStyle(isBusy)}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => (isEditing ? resetEditor() : startEditing(signal))}
                    disabled={isBusy}
                    style={secondaryButtonStyle(isBusy)}
                  >
                    {isEditing ? "Cancel edit" : "Edit before approve"}
                  </button>
                </div>

                {isEditing ? (
                  <div
                    style={{
                      display: "grid",
                      gap: "1rem",
                      padding: "1rem",
                      borderRadius: "16px",
                      backgroundColor: "#ffffff",
                      border: "1px solid #eaecf0",
                    }}
                  >
                    <div style={gridStyle}>
                      <label style={fieldStyle}>
                        <span style={labelStyle}>Symbol</span>
                        <input
                          name="symbol"
                          value={formData.symbol}
                          onChange={handleFieldChange}
                          style={inputStyle}
                        />
                      </label>

                      <label style={fieldStyle}>
                        <span style={labelStyle}>Asset Type</span>
                        <select
                          name="assetType"
                          value={formData.assetType}
                          onChange={handleFieldChange}
                          style={inputStyle}
                        >
                          <option value="crypto">Crypto</option>
                          <option value="forex">Forex</option>
                          <option value="stocks">Stocks</option>
                          <option value="indices">Indices</option>
                          <option value="commodities">Commodities</option>
                        </select>
                      </label>
                    </div>

                    <div style={gridStyle}>
                      <label style={fieldStyle}>
                        <span style={labelStyle}>Direction</span>
                        <select
                          name="direction"
                          value={formData.direction}
                          onChange={handleFieldChange}
                          style={inputStyle}
                        >
                          <option value="LONG">LONG</option>
                          <option value="SHORT">SHORT</option>
                        </select>
                      </label>

                      <label style={fieldStyle}>
                        <span style={labelStyle}>Status</span>
                        <select
                          name="status"
                          value={formData.status}
                          onChange={handleFieldChange}
                          style={inputStyle}
                        >
                          {signalStatuses.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label style={fieldStyle}>
                        <span style={labelStyle}>Source</span>
                        <input
                          name="source"
                          value={formData.source}
                          onChange={handleFieldChange}
                          style={inputStyle}
                        />
                      </label>
                    </div>

                    <div style={gridStyle}>
                      <label style={fieldStyle}>
                        <span style={labelStyle}>Entry</span>
                        <input
                          name="entry"
                          value={formData.entry}
                          onChange={handleFieldChange}
                          style={inputStyle}
                        />
                      </label>

                      <label style={fieldStyle}>
                        <span style={labelStyle}>Stop Loss</span>
                        <input
                          name="stopLoss"
                          value={formData.stopLoss}
                          onChange={handleFieldChange}
                          style={inputStyle}
                        />
                      </label>

                      <label style={fieldStyle}>
                        <span style={labelStyle}>Target</span>
                        <input
                          name="target"
                          value={formData.target}
                          onChange={handleFieldChange}
                          style={inputStyle}
                        />
                      </label>
                    </div>

                    <label style={fieldStyle}>
                      <span style={labelStyle}>Thesis</span>
                      <textarea
                        name="thesis"
                        value={formData.thesis}
                        onChange={handleFieldChange}
                        rows={4}
                        style={{ ...inputStyle, resize: "vertical" }}
                      />
                    </label>

                    {formError ? <p style={{ ...messageStyle, color: "#b42318" }}>{formError}</p> : null}

                    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => handleSaveEdits(signal.id)}
                        disabled={isBusy}
                        style={secondaryButtonStyle(isBusy)}
                      >
                        Save edits
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApprove(signal)}
                        disabled={isBusy}
                        style={primaryButtonStyle(isBusy)}
                      >
                        Approve edited signal
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}

      {actionError ? <p style={{ ...messageStyle, color: "#b42318" }}>{actionError}</p> : null}

      <div
        style={{
          padding: "1.5rem",
          border: "1px solid #d0d5dd",
          borderRadius: "20px",
          backgroundColor: "#f8fafc",
          display: "grid",
          gap: "0.5rem",
        }}
      >
        <h2 style={{ margin: 0, color: "#101828" }}>Approved Signal Lifecycle</h2>
        <p style={{ margin: 0, color: "#475467" }}>
          Manage the status of approved signals in the live feed.
        </p>
      </div>

      {isApprovedSignalsLoading ? <p style={{ margin: 0 }}>Loading approved signals...</p> : null}

      {!isApprovedSignalsLoading && approvedSignalsError ? (
        <div style={errorBannerStyle}>
          <strong>Approved signals unavailable.</strong>
          <p style={{ margin: "0.4rem 0 0" }}>{approvedSignalsError}</p>
        </div>
      ) : null}

      {!isApprovedSignalsLoading && !approvedSignalsError && approvedSignals.length === 0 ? (
        <div style={emptyStateStyle}>
          <h2 style={{ margin: 0, color: "#101828" }}>No approved signals</h2>
          <p style={{ margin: 0, color: "#475467" }}>
            Approved signals will appear here after moderation and can then be moved
            through the lifecycle.
          </p>
        </div>
      ) : null}

      {!isApprovedSignalsLoading && approvedSignals.length > 0 ? (
        <div style={{ display: "grid", gap: "1rem" }}>
          {approvedSignals.map((signal) => {
            const isBusy = busyApprovedSignalId === signal.id;

            return (
              <article
                key={signal.id}
                style={{
                  display: "grid",
                  gap: "1rem",
                  padding: "1rem",
                  border: "1px solid #d0d5dd",
                  borderRadius: "20px",
                  backgroundColor: "#f8fafc",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "0.75rem",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={summaryPillStyle}>Live status: {signal.status}</span>
                  <span style={{ color: "#667085", fontSize: "0.9rem" }}>
                    Signal ID: {signal.id}
                  </span>
                </div>

                <SignalCard signal={signal} />

                <div style={reviewGridStyle}>
                  <ReviewField label="Current Status" value={signal.status} />
                  <ReviewField label="Outcome" value={signal.outcome ?? "Open"} />
                  <ReviewField label="Created At" value={formatAdminDate(signal.createdAt)} />
                  <ReviewField label="Approved At" value={formatAdminDate(signal.approvedAt)} />
                  <ReviewField label="Closed At" value={formatAdminDate(signal.closedAt)} />
                  <ReviewField
                    label="Last Status Update"
                    value={formatAdminDate(signal.statusUpdatedAt)}
                  />
                  <ReviewField label="Approved By" value={signal.approvedBy ?? "Unknown"} />
                  <ReviewField
                    label="Status Updated By"
                    value={signal.statusUpdatedBy ?? signal.updatedBy ?? "Unknown"}
                  />
                </div>

                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => handleLifecycleStatusUpdate(signal.id, "ACTIVE")}
                    disabled={isBusy || signal.status === "ACTIVE"}
                    style={secondaryButtonStyle(isBusy || signal.status === "ACTIVE")}
                  >
                    Mark ACTIVE
                  </button>
                  <button
                    type="button"
                    onClick={() => (closingSignalId === signal.id ? resetCloseForm() : startClosingSignal(signal))}
                    disabled={isBusy}
                    style={secondaryButtonStyle(isBusy)}
                  >
                    {closingSignalId === signal.id ? "Cancel close" : "Close / update outcome"}
                  </button>
                </div>

                {closingSignalId === signal.id ? (
                  <div
                    style={{
                      display: "grid",
                      gap: "1rem",
                      padding: "1rem",
                      borderRadius: "16px",
                      backgroundColor: "#ffffff",
                      border: "1px solid #eaecf0",
                    }}
                  >
                    <div style={gridStyle}>
                      <label style={fieldStyle}>
                        <span style={labelStyle}>Close Action</span>
                        <select
                          name="closeReason"
                          value={closeFormData.closeReason}
                          onChange={handleCloseFieldChange}
                          style={inputStyle}
                        >
                          {closeSignalReasons.map((reason) => (
                            <option key={reason} value={reason}>
                              {reason}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label style={fieldStyle}>
                        <span style={labelStyle}>Exit Price</span>
                        <input
                          name="exitPrice"
                          value={closeFormData.exitPrice}
                          onChange={handleCloseFieldChange}
                          placeholder={
                            closeFormData.closeReason === "CANCELLED"
                              ? "Optional for cancelled signals"
                              : "Required exit price"
                          }
                          style={inputStyle}
                        />
                      </label>
                    </div>

                    {closeFormError ? (
                      <p style={{ ...messageStyle, color: "#b42318" }}>{closeFormError}</p>
                    ) : null}

                    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => handleCloseSignal(signal)}
                        disabled={isBusy}
                        style={primaryButtonStyle(isBusy)}
                      >
                        {isBusy ? "Working..." : "Save close"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

type ReviewFieldProps = {
  label: string;
  value: string;
};

function ReviewField({ label, value }: ReviewFieldProps) {
  return (
    <div
      style={{
        display: "grid",
        gap: "0.25rem",
        padding: "0.85rem",
        borderRadius: "14px",
        backgroundColor: "#ffffff",
        border: "1px solid #eaecf0",
      }}
    >
      <span style={labelStyle}>{label}</span>
      <strong style={{ color: "#101828" }}>{value}</strong>
    </div>
  );
}

function formatVisibleSource(source?: string) {
  const normalizedSource = source?.trim();

  if (!normalizedSource) {
    return "Automated";
  }

  if (normalizedSource.toLowerCase() === "webhook") {
    return "Automated";
  }

  return normalizedSource;
}

const getFirebaseErrorMessage = (error: unknown, fallbackMessage: string) => {
  if (error instanceof Error && error.message.trim()) {
    return `${fallbackMessage} ${error.message.trim()}`;
  }

  return fallbackMessage;
};

const getValidatedFormData = (formData: AdminSignalForm): SignalInput | null => {
  const normalizedData = {
    symbol: formData.symbol.trim().toUpperCase(),
    assetType: formData.assetType.trim().toLowerCase(),
    direction: formData.direction.trim().toUpperCase(),
    entry: formData.entry.trim(),
    stopLoss: formData.stopLoss.trim(),
    target: formData.target.trim(),
    thesis: formData.thesis.trim(),
    status: normalizeSignalStatus(formData.status),
    source: formData.source.trim(),
  };

  const hasEmptyField = Object.values(normalizedData).some((value) => !value);

  if (hasEmptyField) {
    return null;
  }

  return normalizedData;
};

const normalizeSignalStatus = (value: string): SignalStatus => {
  const normalizedValue = value.trim().toUpperCase();

  if (signalStatuses.includes(normalizedValue as SignalStatus)) {
    return normalizedValue as SignalStatus;
  }

  return "PENDING";
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "1rem",
};

const reviewGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "0.75rem",
};

const auditBlockStyle: CSSProperties = {
  display: "grid",
  gap: "0.35rem",
  padding: "1rem",
  borderRadius: "16px",
  backgroundColor: "#ffffff",
  border: "1px solid #eaecf0",
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
};

const labelStyle: CSSProperties = {
  color: "#344054",
  fontWeight: 600,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "0.85rem 0.9rem",
  borderRadius: "12px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#ffffff",
  fontSize: "1rem",
  fontFamily: "inherit",
};

const emptyStateStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
  padding: "1.5rem",
  border: "1px solid #d0d5dd",
  borderRadius: "20px",
  backgroundColor: "#ffffff",
};

const errorBannerStyle: CSSProperties = {
  padding: "1rem",
  borderRadius: "16px",
  backgroundColor: "#fef3f2",
  color: "#b42318",
  border: "1px solid #fecdca",
};

const messageStyle: CSSProperties = {
  margin: 0,
  fontWeight: 600,
};

const summaryPillStyle: CSSProperties = {
  padding: "0.4rem 0.75rem",
  borderRadius: "999px",
  backgroundColor: "#f2f4f7",
  color: "#344054",
  fontWeight: 700,
  fontSize: "0.85rem",
};

const secondaryLinkStyle: CSSProperties = {
  textDecoration: "none",
  padding: "0.75rem 1rem",
  borderRadius: "12px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#ffffff",
  color: "#344054",
  fontWeight: 700,
};

const primaryButtonStyle = (isDisabled: boolean): CSSProperties => ({
  border: 0,
  borderRadius: "12px",
  padding: "0.85rem 1rem",
  backgroundColor: isDisabled ? "#98a2b3" : "#101828",
  color: "#ffffff",
  fontWeight: 700,
  cursor: isDisabled ? "not-allowed" : "pointer",
});

const secondaryButtonStyle = (isDisabled: boolean): CSSProperties => ({
  borderRadius: "12px",
  padding: "0.85rem 1rem",
  border: "1px solid #d0d5dd",
  backgroundColor: "#ffffff",
  color: "#344054",
  fontWeight: 700,
  cursor: isDisabled ? "not-allowed" : "pointer",
});

const dangerButtonStyle = (isDisabled: boolean): CSSProperties => ({
  borderRadius: "12px",
  padding: "0.85rem 1rem",
  border: "1px solid #fda29b",
  backgroundColor: isDisabled ? "#fee4e2" : "#fef3f2",
  color: "#b42318",
  fontWeight: 700,
  cursor: isDisabled ? "not-allowed" : "pointer",
});

const formatAdminDate = (value: unknown) => {
  if (!value) {
    return "Pending timestamp";
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(value.toDate());
  }

  const parsedDate = value instanceof Date ? value : new Date(String(value));

  if (Number.isNaN(parsedDate.getTime())) {
    return "Pending timestamp";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsedDate);
};

export default AdminSignalsPage;
