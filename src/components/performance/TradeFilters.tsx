import type { ChangeEvent } from "react";
import type { PerformanceFilters } from "../../types/performance";

type TradeFiltersProps = {
  filters: PerformanceFilters;
  symbols: string[];
  strategyVersions: string[];
  onChange: (nextFilters: PerformanceFilters) => void;
  onReset: () => void;
};

function TradeFilters({
  filters,
  symbols,
  strategyVersions,
  onChange,
  onReset,
}: TradeFiltersProps) {
  const handleFieldChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = event.target;
    const nextValue =
      type === "checkbox" && event.target instanceof HTMLInputElement
        ? event.target.checked
        : value;

    onChange({
      ...filters,
      [name]: nextValue,
    });
  };

  return (
    <section style={filterShellStyle}>
      <div style={filterGridStyle}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Search</span>
          <input name="search" value={filters.search} onChange={handleFieldChange} style={inputStyle} placeholder="Trade ID, symbol, setup..." />
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>Symbol</span>
          <select name="symbol" value={filters.symbol} onChange={handleFieldChange} style={inputStyle}>
            <option value="">All symbols</option>
            {symbols.map((symbol) => (
              <option key={symbol} value={symbol}>{symbol}</option>
            ))}
          </select>
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>Side</span>
          <select name="side" value={filters.side} onChange={handleFieldChange} style={inputStyle}>
            <option value="all">All sides</option>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>Result</span>
          <select name="result" value={filters.result} onChange={handleFieldChange} style={inputStyle}>
            <option value="all">All results</option>
            <option value="win">Win</option>
            <option value="loss">Loss</option>
            <option value="breakeven">Breakeven</option>
            <option value="open">Open</option>
          </select>
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>Strategy</span>
          <select name="strategyVersion" value={filters.strategyVersion} onChange={handleFieldChange} style={inputStyle}>
            <option value="">All strategies</option>
            {strategyVersions.map((strategyVersion) => (
              <option key={strategyVersion} value={strategyVersion}>{strategyVersion}</option>
            ))}
          </select>
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>Date from</span>
          <input type="date" name="dateFrom" value={filters.dateFrom} onChange={handleFieldChange} style={inputStyle} />
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>Date to</span>
          <input type="date" name="dateTo" value={filters.dateTo} onChange={handleFieldChange} style={inputStyle} />
        </label>
      </div>
      <div style={toggleRowStyle}>
        <label style={toggleLabelStyle}>
          <input type="checkbox" name="includeArchived" checked={filters.includeArchived} onChange={handleFieldChange} />
          Include archived
        </label>
        <label style={toggleLabelStyle}>
          <input type="checkbox" name="includeTest" checked={filters.includeTest} onChange={handleFieldChange} />
          Include test
        </label>
        <label style={toggleLabelStyle}>
          <input type="checkbox" name="includeInvalid" checked={filters.includeInvalid} onChange={handleFieldChange} />
          Include invalid
        </label>
        <button type="button" onClick={onReset} style={resetButtonStyle}>
          Reset filters
        </button>
      </div>
    </section>
  );
}

const filterShellStyle = {
  display: "grid",
  gap: "1rem",
  padding: "1rem",
  borderRadius: "20px",
  border: "1px solid #1f2937",
  backgroundColor: "#0f172a",
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
  color: "#94a3b8",
  fontWeight: 700,
  fontSize: "0.85rem",
};

const inputStyle = {
  width: "100%",
  padding: "0.8rem 0.9rem",
  borderRadius: "12px",
  border: "1px solid #334155",
  backgroundColor: "#020617",
  color: "#f8fafc",
};

const toggleRowStyle = {
  display: "flex",
  gap: "1rem",
  flexWrap: "wrap" as const,
  alignItems: "center",
};

const toggleLabelStyle = {
  display: "inline-flex",
  gap: "0.45rem",
  alignItems: "center",
  color: "#cbd5e1",
};

const resetButtonStyle = {
  border: "1px solid #334155",
  borderRadius: "999px",
  padding: "0.55rem 0.9rem",
  backgroundColor: "#111827",
  color: "#f8fafc",
  fontWeight: 700,
};

export default TradeFilters;
