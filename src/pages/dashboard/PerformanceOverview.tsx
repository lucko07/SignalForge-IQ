import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DailyNetRChart from "../../components/performance/DailyNetRChart";
import EquityCurveChart from "../../components/performance/EquityCurveChart";
import MetricCard from "../../components/performance/MetricCard";
import RecentTradesTable from "../../components/performance/RecentTradesTable";
import { getPerformanceTrades } from "../../lib/performance/trades";
import { buildPerformanceSnapshot } from "../../lib/performance/summaries";
import { sortTradesDescending } from "../../lib/performance/records";
import type { PerformanceTrade } from "../../types/performance";

function PerformanceOverview() {
  const [trades, setTrades] = useState<PerformanceTrade[]>([]);
  const [selectedStrategyVersion, setSelectedStrategyVersion] = useState("overall");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const loadTrades = async () => {
      try {
        const nextTrades = await getPerformanceTrades();
        setTrades(nextTrades);
        setLoadError("");
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Unable to load performance data.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadTrades();
  }, []);

  const strategyVersions = useMemo(
    () => [...new Set(trades.map((trade) => trade.strategyVersion).filter(Boolean))].sort(),
    [trades]
  );

  const filteredTrades = useMemo(
    () => (
      selectedStrategyVersion === "overall"
        ? trades
        : trades.filter((trade) => trade.strategyVersion === selectedStrategyVersion)
    ),
    [selectedStrategyVersion, trades]
  );

  const snapshot = useMemo(() => buildPerformanceSnapshot(filteredTrades), [filteredTrades]);
  const summary = snapshot.summaries[0];
  const recentTrades = useMemo(() => sortTradesDescending(filteredTrades).slice(0, 8), [filteredTrades]);

  return (
    <section style={pageStyle}>
      <div style={heroStyle}>
        <div>
          <p style={eyebrowStyle}>Track Record</p>
          <h1 style={titleStyle}>Performance Dashboard</h1>
          <p style={bodyStyle}>
            Historical trade tracking, strategy-version comparisons, and aggregated R-based performance.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <select
            value={selectedStrategyVersion}
            onChange={(event) => setSelectedStrategyVersion(event.target.value)}
            style={selectStyle}
          >
            <option value="overall">Overall</option>
            {strategyVersions.map((strategyVersion) => (
              <option key={strategyVersion} value={strategyVersion}>
                {strategyVersion}
              </option>
            ))}
          </select>
          <Link to="/dashboard/trades" style={linkButtonStyle}>
            Open trades
          </Link>
          <Link to="/dashboard/analytics" style={linkButtonStyle}>
            Open analytics
          </Link>
        </div>
      </div>

      {isLoading ? <LoadingCard label="Loading performance overview..." /> : null}
      {!isLoading && loadError ? <ErrorCard label={loadError} /> : null}

      {!isLoading && !loadError ? (
        <>
          <div style={metricGridStyle}>
            <MetricCard label="Total Trades" value={String(summary.totalTrades)} />
            <MetricCard label="Win Rate" value={`${summary.winRate.toFixed(2)}%`} tone="positive" />
            <MetricCard label="Net R" value={`${summary.netR.toFixed(2)}R`} tone={summary.netR >= 0 ? "positive" : "negative"} />
            <MetricCard label="Average R" value={`${summary.avgR.toFixed(2)}R`} />
            <MetricCard label="Profit Factor" value={summary.profitFactor.toFixed(2)} />
            <MetricCard label="Max Drawdown" value={`${summary.maxDrawdownR.toFixed(2)}R`} tone="warning" />
            <MetricCard label="Current Streak" value={String(summary.currentStreak)} />
            <MetricCard label="Best Streak" value={String(summary.bestStreak)} tone="positive" />
          </div>

          <div style={chartGridStyle}>
            <EquityCurveChart points={snapshot.equityCurve} />
            <DailyNetRChart points={snapshot.dailyNetR} />
          </div>

          <RecentTradesTable trades={recentTrades} />
        </>
      ) : null}
    </section>
  );
}

function LoadingCard({ label }: { label: string }) {
  return <div style={infoCardStyle}>{label}</div>;
}

function ErrorCard({ label }: { label: string }) {
  return <div style={{ ...infoCardStyle, border: "1px solid #7f1d1d", color: "#fecaca" }}>{label}</div>;
}

const pageStyle = {
  display: "grid",
  gap: "1rem",
};

const heroStyle = {
  display: "grid",
  gap: "1rem",
  padding: "1.5rem",
  borderRadius: "24px",
  border: "1px solid #1f2937",
  background: "linear-gradient(135deg, #020617 0%, #111827 55%, #0f172a 100%)",
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
  margin: "0.35rem 0 0",
  color: "#f8fafc",
  fontSize: "2.3rem",
};

const bodyStyle = {
  margin: "0.5rem 0 0",
  color: "#94a3b8",
  lineHeight: 1.7,
};

const selectStyle = {
  padding: "0.85rem 1rem",
  borderRadius: "12px",
  border: "1px solid #334155",
  backgroundColor: "#020617",
  color: "#f8fafc",
};

const linkButtonStyle = {
  textDecoration: "none",
  padding: "0.85rem 1rem",
  borderRadius: "12px",
  border: "1px solid #334155",
  backgroundColor: "#111827",
  color: "#f8fafc",
  fontWeight: 700,
};

const metricGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: "0.85rem",
};

const chartGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "1rem",
};

const infoCardStyle = {
  padding: "1rem",
  borderRadius: "18px",
  border: "1px solid #1f2937",
  backgroundColor: "#0f172a",
  color: "#e2e8f0",
};

export default PerformanceOverview;
