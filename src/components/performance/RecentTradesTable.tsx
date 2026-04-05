import { formatDateLabel } from "../../lib/performance/metrics";
import type { PerformanceTrade } from "../../types/performance";

type RecentTradesTableProps = {
  trades: PerformanceTrade[];
};

function RecentTradesTable({ trades }: RecentTradesTableProps) {
  return (
    <article style={tableShellStyle}>
      <div>
        <h3 style={{ margin: 0, color: "#f8fafc" }}>Recent Trades</h3>
        <p style={{ margin: "0.3rem 0 0", color: "#94a3b8" }}>
          Latest append-only trade records
        </p>
      </div>
      {trades.length === 0 ? (
        <div style={emptyStateStyle}>No trades available.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                {["Symbol", "Strategy", "Side", "Result", "R", "PnL %", "Entry", "Exit"].map((label) => (
                  <th key={label} style={headerCellStyle}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => (
                <tr key={trade.id}>
                  <td style={bodyCellStyle}>{trade.symbol}</td>
                  <td style={bodyCellStyle}>{trade.strategyVersion}</td>
                  <td style={bodyCellStyle}>{trade.side.toUpperCase()}</td>
                  <td style={bodyCellStyle}>{trade.result}</td>
                  <td style={bodyCellStyle}>{trade.rrActual === null ? "-" : `${trade.rrActual.toFixed(2)}R`}</td>
                  <td style={bodyCellStyle}>{trade.pnlPercent === null ? "-" : `${trade.pnlPercent.toFixed(2)}%`}</td>
                  <td style={bodyCellStyle}>{formatDateLabel(trade.entryTime)}</td>
                  <td style={bodyCellStyle}>{formatDateLabel(trade.exitTime, trade.result === "open" ? "Open" : "Unknown")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

const tableShellStyle = {
  display: "grid",
  gap: "0.75rem",
  padding: "1rem",
  borderRadius: "20px",
  border: "1px solid #1f2937",
  backgroundColor: "#0f172a",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse" as const,
  color: "#e2e8f0",
  fontSize: "0.95rem",
};

const headerCellStyle = {
  textAlign: "left" as const,
  padding: "0.75rem",
  borderBottom: "1px solid #1f2937",
  color: "#94a3b8",
  fontWeight: 700,
  whiteSpace: "nowrap" as const,
};

const bodyCellStyle = {
  padding: "0.75rem",
  borderBottom: "1px solid #111827",
  whiteSpace: "nowrap" as const,
};

const emptyStateStyle = {
  minHeight: "180px",
  display: "grid",
  placeItems: "center",
  borderRadius: "16px",
  border: "1px dashed #334155",
  color: "#94a3b8",
};

export default RecentTradesTable;
