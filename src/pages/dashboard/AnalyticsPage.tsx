import { useEffect, useMemo, useState } from "react";
import { getPerformanceTrades } from "../../lib/performance/trades";
import { buildPerformanceSnapshot } from "../../lib/performance/summaries";
import type { AnalyticsRow, PerformanceTrade } from "../../types/performance";

function AnalyticsPage() {
  const [trades, setTrades] = useState<PerformanceTrade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const loadTrades = async () => {
      try {
        const nextTrades = await getPerformanceTrades();
        setTrades(nextTrades);
        setLoadError("");
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Unable to load analytics.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadTrades();
  }, []);

  const analytics = useMemo(() => buildPerformanceSnapshot(trades), [trades]);

  return (
    <section style={pageStyle}>
      <div style={heroStyle}>
        <p style={eyebrowStyle}>Deep Dive</p>
        <h1 style={titleStyle}>Analytics</h1>
        <p style={bodyStyle}>
          Compare performance by symbol, day of week, New York entry hour, and strategy version.
        </p>
      </div>

      {isLoading ? <InfoCard label="Loading analytics..." /> : null}
      {!isLoading && loadError ? <ErrorCard label={loadError} /> : null}

      {!isLoading && !loadError ? (
        <div style={gridStyle}>
          <AnalyticsCard title="By Symbol" rows={analytics.bySymbol} />
          <AnalyticsCard title="By Day Of Week" rows={analytics.byDayOfWeek} />
          <AnalyticsCard title="By Entry Hour" rows={analytics.byEntryHour} />
          <AnalyticsCard title="By Strategy Version" rows={analytics.byStrategyVersion} />
        </div>
      ) : null}
    </section>
  );
}

function AnalyticsCard({ title, rows }: { title: string; rows: AnalyticsRow[] }) {
  return (
    <article style={cardStyle}>
      <div>
        <h2 style={{ margin: 0, color: "#f8fafc" }}>{title}</h2>
        <p style={{ margin: "0.35rem 0 0", color: "#94a3b8" }}>
          Ranked by net R
        </p>
      </div>
      {rows.length === 0 ? (
        <div style={emptyStateStyle}>No data available.</div>
      ) : (
        <div style={{ display: "grid", gap: "0.55rem" }}>
          {rows.slice(0, 8).map((row) => (
            <div key={row.label} style={rowStyle}>
              <div>
                <strong style={{ color: "#f8fafc" }}>{row.label}</strong>
                <p style={{ margin: "0.2rem 0 0", color: "#94a3b8" }}>
                  {row.closedTrades} closed • {row.winRate.toFixed(2)}% win rate
                </p>
              </div>
              <div style={{ textAlign: "right" as const }}>
                <strong style={{ color: row.netR >= 0 ? "#86efac" : "#fca5a5" }}>{row.netR.toFixed(2)}R</strong>
                <p style={{ margin: "0.2rem 0 0", color: "#94a3b8" }}>
                  PF {row.profitFactor.toFixed(2)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function InfoCard({ label }: { label: string }) {
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
  gap: "0.75rem",
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
  margin: 0,
  color: "#f8fafc",
  fontSize: "2.3rem",
};

const bodyStyle = {
  margin: 0,
  color: "#94a3b8",
  lineHeight: 1.7,
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "1rem",
};

const cardStyle = {
  display: "grid",
  gap: "0.85rem",
  padding: "1rem",
  borderRadius: "20px",
  border: "1px solid #1f2937",
  backgroundColor: "#0f172a",
};

const rowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "0.75rem",
  alignItems: "center",
  padding: "0.8rem",
  borderRadius: "14px",
  backgroundColor: "#111827",
  border: "1px solid #1f2937",
};

const emptyStateStyle = {
  minHeight: "160px",
  display: "grid",
  placeItems: "center",
  borderRadius: "16px",
  border: "1px dashed #334155",
  color: "#94a3b8",
};

const infoCardStyle = {
  padding: "1rem",
  borderRadius: "18px",
  border: "1px solid #1f2937",
  backgroundColor: "#0f172a",
  color: "#e2e8f0",
};

export default AnalyticsPage;
