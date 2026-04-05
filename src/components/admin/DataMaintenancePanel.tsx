import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  archiveSignals,
  markSignalsAsTest,
  markSignalsAsValid,
  safeDeleteSignal,
} from "../../lib/performance/signals";
import {
  archiveTrades,
  getPerformanceTrades,
  markTradesAsTest,
  markTradesAsValid,
  safeDeleteTrade,
} from "../../lib/performance/trades";
import { getPerformanceSignals } from "../../lib/performance/signals";
import { rebuildPerformanceSummaries } from "../../lib/performance/summaries";
import type { PerformanceSignal, PerformanceTrade } from "../../types/performance";

function DataMaintenancePanel() {
  const [signals, setSignals] = useState<PerformanceSignal[]>([]);
  const [trades, setTrades] = useState<PerformanceTrade[]>([]);
  const [selectedSignalIds, setSelectedSignalIds] = useState<string[]>([]);
  const [selectedTradeIds, setSelectedTradeIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    void loadRecords();
  }, []);

  const visibleSignals = useMemo(() => signals.slice(0, 25), [signals]);
  const visibleTrades = useMemo(() => trades.slice(0, 25), [trades]);

  async function loadRecords() {
    setIsLoading(true);
    setActionError("");

    try {
      const [nextSignals, nextTrades] = await Promise.all([
        getPerformanceSignals({
          includeArchived: true,
          includeTest: true,
          includeInvalid: true,
        }),
        getPerformanceTrades({
          includeArchived: true,
          includeTest: true,
          includeInvalid: true,
        }),
      ]);

      setSignals(nextSignals);
      setTrades(nextTrades);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to load maintenance data.");
    } finally {
      setIsLoading(false);
    }
  }

  const runSignalAction = async (action: () => Promise<void>, successMessage: string) => {
    setActionError("");
    setActionMessage("");

    try {
      await action();
      setActionMessage(successMessage);
      setSelectedSignalIds([]);
      await loadRecords();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Signal maintenance failed.");
    }
  };

  const runTradeAction = async (action: () => Promise<void>, successMessage: string) => {
    setActionError("");
    setActionMessage("");

    try {
      await action();
      setActionMessage(successMessage);
      setSelectedTradeIds([]);
      await loadRecords();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Trade maintenance failed.");
    }
  };

  const handleRebuildSummaries = async () => {
    setActionError("");
    setActionMessage("");

    try {
      await rebuildPerformanceSummaries(
        trades.filter((trade) => !trade.isArchived && !trade.isTest && trade.isValid)
      );
      setActionMessage("Performance summaries rebuilt successfully.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Summary rebuild failed.");
    }
  };

  return (
    <section style={panelStyle}>
      <div>
        <h2 style={{ margin: 0, color: "#f8fafc" }}>Admin Data Utilities</h2>
        <p style={{ margin: "0.4rem 0 0", color: "#94a3b8" }}>
          Archive and classify records safely. Bulk delete is intentionally limited to test records.
        </p>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button type="button" onClick={() => void loadRecords()} style={primaryButtonStyle}>
          Refresh data
        </button>
        <button type="button" onClick={() => void handleRebuildSummaries()} style={secondaryButtonStyle}>
          Rebuild summaries
        </button>
      </div>

      {actionMessage ? <p style={{ margin: 0, color: "#86efac", fontWeight: 700 }}>{actionMessage}</p> : null}
      {actionError ? <p style={{ margin: 0, color: "#fca5a5", fontWeight: 700 }}>{actionError}</p> : null}

      <MaintenanceSection
        title="Signals"
        isLoading={isLoading}
        selectedCount={selectedSignalIds.length}
        actions={(
          <div style={actionRowStyle}>
            <button type="button" onClick={() => void runSignalAction(() => archiveSignals(selectedSignalIds), "Selected signals archived.")} disabled={selectedSignalIds.length === 0} style={primaryButtonStyle}>
              Archive selected
            </button>
            <button type="button" onClick={() => void runSignalAction(() => markSignalsAsTest(selectedSignalIds, true), "Selected signals marked as test.")} disabled={selectedSignalIds.length === 0} style={secondaryButtonStyle}>
              Mark test
            </button>
            <button type="button" onClick={() => void runSignalAction(() => markSignalsAsValid(selectedSignalIds, false), "Selected signals marked invalid.")} disabled={selectedSignalIds.length === 0} style={secondaryButtonStyle}>
              Mark invalid
            </button>
            <button type="button" onClick={() => void runSignalAction(async () => {
              await Promise.all(selectedSignalIds.map((signalId) => safeDeleteSignal(signalId)));
            }, "Selected test signals deleted.")} disabled={selectedSignalIds.length === 0} style={dangerButtonStyle}>
              Safe delete test records
            </button>
          </div>
        )}
      >
        {visibleSignals.map((signal) => (
          <SelectableRow
            key={signal.id}
            checked={selectedSignalIds.includes(signal.id)}
            onToggle={() => setSelectedSignalIds((current) => (
              current.includes(signal.id)
                ? current.filter((signalId) => signalId !== signal.id)
                : [...current, signal.id]
            ))}
            title={`${signal.symbol} • ${signal.strategyVersion}`}
            metadata={[
              signal.side.toUpperCase(),
              signal.status,
              signal.isArchived ? "Archived" : "Live",
              signal.isTest ? "Test" : "Real",
              signal.isValid ? "Valid" : "Invalid",
            ]}
          />
        ))}
      </MaintenanceSection>

      <MaintenanceSection
        title="Trades"
        isLoading={isLoading}
        selectedCount={selectedTradeIds.length}
        actions={(
          <div style={actionRowStyle}>
            <button type="button" onClick={() => void runTradeAction(() => archiveTrades(selectedTradeIds), "Selected trades archived.")} disabled={selectedTradeIds.length === 0} style={primaryButtonStyle}>
              Archive selected
            </button>
            <button type="button" onClick={() => void runTradeAction(() => markTradesAsTest(selectedTradeIds, true), "Selected trades marked as test.")} disabled={selectedTradeIds.length === 0} style={secondaryButtonStyle}>
              Mark test
            </button>
            <button type="button" onClick={() => void runTradeAction(() => markTradesAsValid(selectedTradeIds, false), "Selected trades marked invalid.")} disabled={selectedTradeIds.length === 0} style={secondaryButtonStyle}>
              Mark invalid
            </button>
            <button type="button" onClick={() => void runTradeAction(async () => {
              await Promise.all(selectedTradeIds.map((tradeId) => safeDeleteTrade(tradeId)));
            }, "Selected test trades deleted.")} disabled={selectedTradeIds.length === 0} style={dangerButtonStyle}>
              Safe delete test records
            </button>
          </div>
        )}
      >
        {visibleTrades.map((trade) => (
          <SelectableRow
            key={trade.id}
            checked={selectedTradeIds.includes(trade.id)}
            onToggle={() => setSelectedTradeIds((current) => (
              current.includes(trade.id)
                ? current.filter((tradeId) => tradeId !== trade.id)
                : [...current, trade.id]
            ))}
            title={`${trade.symbol} • ${trade.strategyVersion}`}
            metadata={[
              trade.side.toUpperCase(),
              trade.result,
              trade.isArchived ? "Archived" : "Active",
              trade.isTest ? "Test" : "Real",
              trade.isValid ? "Valid" : "Invalid",
            ]}
          />
        ))}
      </MaintenanceSection>
    </section>
  );
}

function MaintenanceSection({
  title,
  isLoading,
  selectedCount,
  actions,
  children,
}: {
  title: string;
  isLoading: boolean;
  selectedCount: number;
  actions: ReactNode;
  children: ReactNode;
}) {
  return (
    <article style={sectionStyle}>
      <div style={{ display: "grid", gap: "0.35rem" }}>
        <h3 style={{ margin: 0, color: "#f8fafc" }}>{title}</h3>
        <p style={{ margin: 0, color: "#94a3b8" }}>
          {selectedCount} selected
        </p>
      </div>
      {actions}
      <div style={{ display: "grid", gap: "0.65rem" }}>
        {isLoading ? <div style={rowStyle}>Loading records...</div> : children}
      </div>
    </article>
  );
}

function SelectableRow({
  checked,
  onToggle,
  title,
  metadata,
}: {
  checked: boolean;
  onToggle: () => void;
  title: string;
  metadata: string[];
}) {
  return (
    <label style={rowStyle}>
      <input type="checkbox" checked={checked} onChange={onToggle} />
      <div style={{ display: "grid", gap: "0.25rem" }}>
        <strong style={{ color: "#f8fafc" }}>{title}</strong>
        <span style={{ color: "#94a3b8" }}>{metadata.join(" • ")}</span>
      </div>
    </label>
  );
}

const panelStyle = {
  display: "grid",
  gap: "1rem",
  padding: "1rem",
  borderRadius: "24px",
  border: "1px solid #1f2937",
  backgroundColor: "#0f172a",
};

const sectionStyle = {
  display: "grid",
  gap: "0.85rem",
  padding: "1rem",
  borderRadius: "18px",
  border: "1px solid #1f2937",
  backgroundColor: "#020617",
};

const rowStyle = {
  display: "flex",
  gap: "0.75rem",
  alignItems: "flex-start",
  padding: "0.9rem",
  borderRadius: "14px",
  border: "1px solid #1f2937",
  backgroundColor: "#111827",
};

const actionRowStyle = {
  display: "flex",
  gap: "0.65rem",
  flexWrap: "wrap" as const,
};

const primaryButtonStyle = {
  border: 0,
  borderRadius: "12px",
  padding: "0.75rem 1rem",
  backgroundColor: "#2563eb",
  color: "#eff6ff",
  fontWeight: 700,
};

const secondaryButtonStyle = {
  border: "1px solid #334155",
  borderRadius: "12px",
  padding: "0.75rem 1rem",
  backgroundColor: "#111827",
  color: "#e2e8f0",
  fontWeight: 700,
};

const dangerButtonStyle = {
  border: "1px solid #7f1d1d",
  borderRadius: "12px",
  padding: "0.75rem 1rem",
  backgroundColor: "#450a0a",
  color: "#fee2e2",
  fontWeight: 700,
};

export default DataMaintenancePanel;
