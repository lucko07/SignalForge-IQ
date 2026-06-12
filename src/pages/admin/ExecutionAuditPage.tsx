import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getRecentExecutionRecords,
  type ExecutionMode,
  type ExecutionProvider,
  type ExecutionRecord,
} from "../../lib/automationFirestore";

type FilterState = {
  provider: "all" | ExecutionProvider;
  mode: "all" | ExecutionMode;
  status: string;
  symbol: string;
  startDate: string;
  endDate: string;
};

const DEFAULT_FILTERS: FilterState = {
  provider: "all",
  mode: "all",
  status: "all",
  symbol: "",
  startDate: "",
  endDate: "",
};

function ExecutionAuditPage() {
  const [records, setRecords] = useState<ExecutionRecord[]>([]);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadRecords = async () => {
    setIsLoading(true);
    setLoadError("");

    try {
      const nextRecords = await getRecentExecutionRecords(250);
      setRecords(nextRecords);
    } catch (error) {
      setRecords([]);
      setLoadError(error instanceof Error ? error.message : "Unable to load execution audit records.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRecords();
  }, []);

  const statusOptions = useMemo(() => {
    const statuses = records
      .map((record) => record.status.trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));

    return ["all", ...new Set(statuses)];
  }, [records]);

  const filteredRecords = useMemo(() => records.filter((record) => {
    if (filters.provider !== "all" && record.provider !== filters.provider) {
      return false;
    }

    if (filters.mode !== "all" && record.mode !== filters.mode) {
      return false;
    }

    if (filters.status !== "all" && record.status !== filters.status) {
      return false;
    }

    const symbolFilter = filters.symbol.trim().toUpperCase();
    if (symbolFilter && !record.symbol.toUpperCase().includes(symbolFilter)) {
      return false;
    }

    const createdAt = timestampToDate(record.createdAt);
    if (filters.startDate) {
      const startDate = new Date(`${filters.startDate}T00:00:00`);
      if (!createdAt || createdAt < startDate) {
        return false;
      }
    }

    if (filters.endDate) {
      const endDate = new Date(`${filters.endDate}T23:59:59.999`);
      if (!createdAt || createdAt > endDate) {
        return false;
      }
    }

    return true;
  }), [filters, records]);

  const summary = useMemo(() => ({
    total: filteredRecords.length,
    rejected: filteredRecords.filter((record) => record.status === "rejected").length,
    errors: filteredRecords.filter((record) => ["error", "failed", "protection_failed"].includes(record.status)).length,
    liveBlocked: filteredRecords.filter((record) => (
      record.provider === "kraken"
      && record.mode === "live"
      && record.errorCode === "kraken_live_not_enabled"
    )).length,
  }), [filteredRecords]);

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  return (
    <section style={pageStyle}>
      <div style={heroStyle}>
        <div>
          <p style={eyebrowStyle}>Administration</p>
          <h1 style={titleStyle}>Execution Audit</h1>
          <p style={bodyStyle}>
            Read-only execution records from Firestore. This page cannot submit, cancel, transfer,
            withdraw, or place live orders.
          </p>
        </div>
        <div style={heroActionsStyle}>
          <Link to="/admin/signals" style={linkStyle}>Signal review</Link>
          <Link to="/admin/data" style={linkStyle}>Data tools</Link>
        </div>
      </div>

      <div style={warningStyle}>
        <strong>Read-only audit surface.</strong>
        <p style={{ margin: 0 }}>
          Secrets and raw broker payloads are not displayed. Live order placement remains disabled.
        </p>
      </div>

      <div style={summaryGridStyle}>
        <MetricCard label="Shown" value={String(summary.total)} />
        <MetricCard label="Rejected" value={String(summary.rejected)} />
        <MetricCard label="Errors" value={String(summary.errors)} />
        <MetricCard label="Kraken Live Blocks" value={String(summary.liveBlocked)} />
      </div>

      <div style={panelStyle}>
        <div style={panelHeaderStyle}>
          <div>
            <h2 style={sectionTitleStyle}>Filters</h2>
            <p style={mutedTextStyle}>Recent records are loaded newest first, then filtered locally.</p>
          </div>
          <button type="button" onClick={() => void loadRecords()} disabled={isLoading} style={buttonStyle(isLoading)}>
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div style={filterGridStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Provider</span>
            <select
              value={filters.provider}
              onChange={(event) => updateFilter("provider", event.target.value as FilterState["provider"])}
              style={inputStyle}
            >
              <option value="all">All providers</option>
              <option value="alpaca">Alpaca</option>
              <option value="kraken">Kraken</option>
            </select>
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Mode</span>
            <select
              value={filters.mode}
              onChange={(event) => updateFilter("mode", event.target.value as FilterState["mode"])}
              style={inputStyle}
            >
              <option value="all">All modes</option>
              <option value="paper">Paper</option>
              <option value="live">Live</option>
            </select>
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Status</span>
            <select
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
              style={inputStyle}
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status === "all" ? "All statuses" : formatLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Symbol</span>
            <input
              value={filters.symbol}
              onChange={(event) => updateFilter("symbol", event.target.value)}
              placeholder="BTCUSD"
              style={inputStyle}
            />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Start date</span>
            <input
              type="date"
              value={filters.startDate}
              onChange={(event) => updateFilter("startDate", event.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>End date</span>
            <input
              type="date"
              value={filters.endDate}
              onChange={(event) => updateFilter("endDate", event.target.value)}
              style={inputStyle}
            />
          </label>
        </div>

        <div>
          <button type="button" onClick={() => setFilters(DEFAULT_FILTERS)} style={secondaryButtonStyle}>
            Reset filters
          </button>
        </div>
      </div>

      <div style={panelStyle}>
        <div style={panelHeaderStyle}>
          <div>
            <h2 style={sectionTitleStyle}>Recent Executions</h2>
            <p style={mutedTextStyle}>{filteredRecords.length} of {records.length} loaded records shown.</p>
          </div>
        </div>

        {loadError ? <div style={errorStyle}>{loadError}</div> : null}
        {isLoading ? <div style={emptyStyle}>Loading execution records...</div> : null}
        {!isLoading && filteredRecords.length === 0 ? (
          <div style={emptyStyle}>No execution records match the selected filters.</div>
        ) : null}
        {!isLoading && filteredRecords.length > 0 ? (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Created</th>
                  <th style={thStyle}>Provider</th>
                  <th style={thStyle}>Mode</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Symbol</th>
                  <th style={thStyle}>Side</th>
                  <th style={thStyle}>Trade</th>
                  <th style={thStyle}>Client Order</th>
                  <th style={thStyle}>Broker</th>
                  <th style={thStyle}>Error</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={record.id ?? record.tradeId}>
                    <td style={tdStyle}>{formatTimestamp(record.createdAt)}</td>
                    <td style={tdStyle}>{formatLabel(record.provider)}</td>
                    <td style={tdStyle}>{formatLabel(record.mode)}</td>
                    <td style={tdStyle}>
                      <span style={statusPillStyle(record.status)}>{formatLabel(record.status)}</span>
                    </td>
                    <td style={tdStyle}>{record.symbol || "Unknown"}</td>
                    <td style={tdStyle}>{record.side ? formatLabel(record.side) : "Unknown"}</td>
                    <td style={tdStyle}>
                      <div style={cellStackStyle}>
                        <span>{record.tradeId}</span>
                        {record.signalId ? <span style={smallTextStyle}>Signal {record.signalId}</span> : null}
                      </div>
                    </td>
                    <td style={tdStyle}>{record.clientOrderId || "Not assigned"}</td>
                    <td style={tdStyle}>
                      <div style={cellStackStyle}>
                        <span>{record.brokerOrderId ?? record.alpacaOrderId ?? "Not submitted"}</span>
                        <span style={smallTextStyle}>
                          {[record.brokerVenue, record.brokerPair, record.brokerAccountType]
                            .filter(Boolean)
                            .join(" / ") || "No broker metadata"}
                        </span>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={cellStackStyle}>
                        <span>{record.errorCode ?? "None"}</span>
                        {record.errorMessage ? <span style={smallTextStyle}>{record.errorMessage}</span> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={metricCardStyle}>
      <span style={labelStyle}>{label}</span>
      <strong style={{ color: "#101828", fontSize: "1.35rem" }}>{value}</strong>
    </div>
  );
}

const timestampToDate = (value: unknown) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (
    typeof value === "object"
    && value !== null
    && "toDate" in value
    && typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }

  if (
    typeof value === "object"
    && value !== null
    && "seconds" in value
    && typeof (value as { seconds?: unknown }).seconds === "number"
  ) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }

  return null;
};

const formatTimestamp = (value: unknown) => {
  const date = timestampToDate(value);

  if (!date) {
    return "Not available";
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const formatLabel = (value: string) => (
  value
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ")
);

const pageStyle = {
  display: "grid",
  gap: "1rem",
};

const heroStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "1rem",
  flexWrap: "wrap" as const,
  padding: "1.5rem",
  borderRadius: "8px",
  border: "1px solid #1f2937",
  backgroundColor: "#111827",
};

const heroActionsStyle = {
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap" as const,
};

const eyebrowStyle = {
  margin: 0,
  color: "#38bdf8",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  fontSize: "0.8rem",
};

const titleStyle = {
  margin: "0.2rem 0 0",
  color: "#f8fafc",
  fontSize: "2.1rem",
};

const bodyStyle = {
  margin: "0.5rem 0 0",
  color: "#cbd5e1",
  lineHeight: 1.6,
  maxWidth: "58rem",
};

const linkStyle = {
  textDecoration: "none",
  padding: "0.75rem 0.9rem",
  borderRadius: "8px",
  border: "1px solid #334155",
  backgroundColor: "#0f172a",
  color: "#f8fafc",
  fontWeight: 700,
};

const warningStyle = {
  display: "grid",
  gap: "0.35rem",
  padding: "1rem",
  borderRadius: "8px",
  border: "1px solid #f7b267",
  backgroundColor: "#fff7ed",
  color: "#9a3412",
};

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "0.75rem",
};

const metricCardStyle = {
  display: "grid",
  gap: "0.35rem",
  padding: "1rem",
  borderRadius: "8px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#ffffff",
};

const panelStyle = {
  display: "grid",
  gap: "1rem",
  padding: "1rem",
  borderRadius: "8px",
  border: "1px solid #d0d5dd",
  backgroundColor: "#f8fafc",
};

const panelHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "1rem",
  flexWrap: "wrap" as const,
};

const sectionTitleStyle = {
  margin: 0,
  color: "#101828",
};

const mutedTextStyle = {
  margin: "0.25rem 0 0",
  color: "#667085",
};

const filterGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "0.85rem",
};

const fieldStyle = {
  display: "grid",
  gap: "0.35rem",
};

const labelStyle = {
  color: "#475467",
  fontSize: "0.8rem",
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
};

const inputStyle = {
  width: "100%",
  borderRadius: "8px",
  border: "1px solid #d0d5dd",
  padding: "0.7rem 0.75rem",
  backgroundColor: "#ffffff",
  color: "#101828",
};

const buttonStyle = (disabled: boolean) => ({
  border: 0,
  borderRadius: "8px",
  padding: "0.75rem 0.95rem",
  backgroundColor: disabled ? "#98a2b3" : "#101828",
  color: "#ffffff",
  fontWeight: 700,
  cursor: disabled ? "not-allowed" : "pointer",
});

const secondaryButtonStyle = {
  border: "1px solid #d0d5dd",
  borderRadius: "8px",
  padding: "0.75rem 0.95rem",
  backgroundColor: "#ffffff",
  color: "#344054",
  fontWeight: 700,
  cursor: "pointer",
};

const emptyStyle = {
  padding: "1rem",
  borderRadius: "8px",
  border: "1px dashed #d0d5dd",
  backgroundColor: "#ffffff",
  color: "#475467",
};

const errorStyle = {
  padding: "1rem",
  borderRadius: "8px",
  border: "1px solid #fda29b",
  backgroundColor: "#fef3f2",
  color: "#b42318",
  fontWeight: 700,
};

const tableWrapStyle = {
  overflowX: "auto" as const,
  borderRadius: "8px",
  border: "1px solid #d0d5dd",
};

const tableStyle = {
  width: "100%",
  minWidth: "1100px",
  borderCollapse: "collapse" as const,
  backgroundColor: "#ffffff",
};

const thStyle = {
  padding: "0.8rem",
  borderBottom: "1px solid #d0d5dd",
  color: "#475467",
  fontSize: "0.78rem",
  textAlign: "left" as const,
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
};

const tdStyle = {
  padding: "0.85rem 0.8rem",
  borderBottom: "1px solid #eaecf0",
  color: "#101828",
  verticalAlign: "top" as const,
  fontSize: "0.92rem",
};

const statusPillStyle = (status: string) => {
  const normalized = status.trim().toLowerCase();
  const isBad = ["rejected", "error", "failed", "broker_rejected", "protection_failed"].includes(normalized);
  const isGood = ["filled", "accepted", "submitted", "closed"].includes(normalized);

  return {
    display: "inline-flex",
    borderRadius: "999px",
    padding: "0.25rem 0.55rem",
    backgroundColor: isBad ? "#fef3f2" : isGood ? "#ecfdf3" : "#f8fafc",
    color: isBad ? "#b42318" : isGood ? "#067647" : "#344054",
    fontWeight: 700,
    whiteSpace: "nowrap" as const,
  };
};

const cellStackStyle = {
  display: "grid",
  gap: "0.25rem",
  maxWidth: "260px",
  overflowWrap: "anywhere" as const,
};

const smallTextStyle = {
  color: "#667085",
  fontSize: "0.82rem",
};

export default ExecutionAuditPage;
