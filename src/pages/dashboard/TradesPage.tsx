import { useEffect, useMemo, useState } from "react";
import TradeFilters from "../../components/performance/TradeFilters";
import { formatDateLabel, toMillis } from "../../lib/performance/metrics";
import { buildTradeSearchText, sortTradesDescending } from "../../lib/performance/records";
import { getPerformanceTrades } from "../../lib/performance/trades";
import type {
  PerformanceFilters,
  PerformanceTrade,
  SortDirection,
  TradeSortKey,
} from "../../types/performance";

const defaultFilters: PerformanceFilters = {
  search: "",
  symbol: "",
  side: "all",
  result: "all",
  strategyVersion: "",
  dateFrom: "",
  dateTo: "",
  includeArchived: false,
  includeTest: false,
  includeInvalid: false,
};

function TradesPage() {
  const [trades, setTrades] = useState<PerformanceTrade[]>([]);
  const [filters, setFilters] = useState<PerformanceFilters>(defaultFilters);
  const [sortKey, setSortKey] = useState<TradeSortKey>("entryTime");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const loadTrades = async () => {
      try {
        const nextTrades = await getPerformanceTrades({
          includeArchived: true,
          includeTest: true,
          includeInvalid: true,
        });
        setTrades(sortTradesDescending(nextTrades));
        setLoadError("");
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Unable to load trades.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadTrades();
  }, []);

  const symbols = useMemo(() => [...new Set(trades.map((trade) => trade.symbol).filter(Boolean))].sort(), [trades]);
  const strategyVersions = useMemo(
    () => [...new Set(trades.map((trade) => trade.strategyVersion).filter(Boolean))].sort(),
    [trades]
  );

  const filteredTrades = useMemo(() => {
    return trades
      .filter((trade) => filters.includeArchived || !trade.isArchived)
      .filter((trade) => filters.includeTest || !trade.isTest)
      .filter((trade) => filters.includeInvalid || trade.isValid)
      .filter((trade) => !filters.symbol || trade.symbol === filters.symbol)
      .filter((trade) => filters.side === "all" || trade.side === filters.side)
      .filter((trade) => filters.result === "all" || trade.result === filters.result)
      .filter((trade) => !filters.strategyVersion || trade.strategyVersion === filters.strategyVersion)
      .filter((trade) => {
        if (!filters.search.trim()) {
          return true;
        }

        return buildTradeSearchText(trade).includes(filters.search.trim().toLowerCase());
      })
      .filter((trade) => {
        const tradeMillis = toMillis(trade.exitTime ?? trade.entryTime ?? trade.createdAt);

        if (tradeMillis === null) {
          return !filters.dateFrom && !filters.dateTo;
        }

        const fromMillis = filters.dateFrom ? new Date(filters.dateFrom).getTime() : null;
        const toMillisValue = filters.dateTo ? new Date(filters.dateTo).getTime() + 86_399_999 : null;

        if (fromMillis !== null && tradeMillis < fromMillis) {
          return false;
        }

        if (toMillisValue !== null && tradeMillis > toMillisValue) {
          return false;
        }

        return true;
      });
  }, [filters, trades]);

  const sortedTrades = useMemo(() => {
    return [...filteredTrades].sort((left, right) => {
      const sortValue = getSortableValue(left, sortKey, sortDirection, right);
      return sortValue;
    });
  }, [filteredTrades, sortDirection, sortKey]);

  const toggleSort = (nextSortKey: TradeSortKey) => {
    if (sortKey === nextSortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection(nextSortKey === "symbol" || nextSortKey === "strategyVersion" ? "asc" : "desc");
  };

  return (
    <section style={pageStyle}>
      <div style={heroStyle}>
        <div>
          <p style={eyebrowStyle}>Trade Journal</p>
          <h1 style={titleStyle}>Trades</h1>
          <p style={bodyStyle}>
            Filter and inspect completed and open trades without including archived, test, or invalid data by default.
          </p>
        </div>
      </div>

      <TradeFilters
        filters={filters}
        symbols={symbols}
        strategyVersions={strategyVersions}
        onChange={setFilters}
        onReset={() => setFilters(defaultFilters)}
      />

      {isLoading ? <InfoCard label="Loading trades..." /> : null}
      {!isLoading && loadError ? <ErrorCard label={loadError} /> : null}

      {!isLoading && !loadError ? (
        <article style={tableShellStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0, color: "#f8fafc" }}>Filtered Trades</h2>
              <p style={{ margin: "0.35rem 0 0", color: "#94a3b8" }}>
                {sortedTrades.length} trade{sortedTrades.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          {sortedTrades.length === 0 ? (
            <div style={emptyStateStyle}>No trades match the current filters.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {[
                      ["symbol", "Symbol"],
                      ["strategyVersion", "Strategy"],
                      ["timeframe", "TF"],
                      ["side", "Side"],
                      ["result", "Result"],
                      ["rrActual", "R Actual"],
                      ["pnlPercent", "PnL %"],
                      ["entryPrice", "Entry"],
                      ["exitPrice", "Exit"],
                      ["entryTime", "Entry Time"],
                      ["exitTime", "Exit Time"],
                    ].map(([key, label]) => (
                      <th key={key} style={headerCellStyle}>
                        <button type="button" onClick={() => toggleSort(key as TradeSortKey)} style={sortButtonStyle}>
                          {label}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedTrades.map((trade) => (
                    <tr key={trade.id}>
                      <td style={bodyCellStyle}>{trade.symbol}</td>
                      <td style={bodyCellStyle}>{trade.strategyVersion}</td>
                      <td style={bodyCellStyle}>{trade.timeframe}</td>
                      <td style={bodyCellStyle}>{trade.side.toUpperCase()}</td>
                      <td style={bodyCellStyle}>{trade.result}</td>
                      <td style={bodyCellStyle}>{trade.rrActual === null ? "-" : `${trade.rrActual.toFixed(2)}R`}</td>
                      <td style={bodyCellStyle}>{trade.pnlPercent === null ? "-" : `${trade.pnlPercent.toFixed(2)}%`}</td>
                      <td style={bodyCellStyle}>{formatNumber(trade.entryPrice)}</td>
                      <td style={bodyCellStyle}>{formatNumber(trade.exitPrice)}</td>
                      <td style={bodyCellStyle}>{formatDateLabel(trade.entryTime)}</td>
                      <td style={bodyCellStyle}>{formatDateLabel(trade.exitTime, trade.result === "open" ? "Open" : "Unknown")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      ) : null}
    </section>
  );
}

function getSortableValue(
  left: PerformanceTrade,
  sortKey: TradeSortKey,
  sortDirection: SortDirection,
  right: PerformanceTrade
) {
  const directionMultiplier = sortDirection === "asc" ? 1 : -1;

  if (sortKey === "entryTime" || sortKey === "exitTime") {
    const leftValue = toMillis(left[sortKey]) ?? 0;
    const rightValue = toMillis(right[sortKey]) ?? 0;
    return (leftValue - rightValue) * directionMultiplier;
  }

  const leftValue = left[sortKey];
  const rightValue = right[sortKey];

  if (typeof leftValue === "number" || typeof rightValue === "number") {
    return (((leftValue as number | null) ?? 0) - ((rightValue as number | null) ?? 0)) * directionMultiplier;
  }

  return String(leftValue ?? "").localeCompare(String(rightValue ?? "")) * directionMultiplier;
}

function InfoCard({ label }: { label: string }) {
  return <div style={infoCardStyle}>{label}</div>;
}

function ErrorCard({ label }: { label: string }) {
  return <div style={{ ...infoCardStyle, border: "1px solid #7f1d1d", color: "#fecaca" }}>{label}</div>;
}

const formatNumber = (value: number | null) => (value === null ? "-" : value.toFixed(2));

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

const tableShellStyle = {
  display: "grid",
  gap: "1rem",
  padding: "1rem",
  borderRadius: "20px",
  border: "1px solid #1f2937",
  backgroundColor: "#0f172a",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse" as const,
  color: "#e2e8f0",
};

const headerCellStyle = {
  padding: "0.75rem",
  borderBottom: "1px solid #1f2937",
  textAlign: "left" as const,
};

const sortButtonStyle = {
  border: 0,
  backgroundColor: "transparent",
  color: "#94a3b8",
  fontWeight: 700,
  cursor: "pointer",
  padding: 0,
};

const bodyCellStyle = {
  padding: "0.75rem",
  borderBottom: "1px solid #111827",
  whiteSpace: "nowrap" as const,
};

const emptyStateStyle = {
  minHeight: "220px",
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

export default TradesPage;
