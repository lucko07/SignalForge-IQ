import type { ExecutionAutomationSettings } from "./types.js";

const DEFAULT_NOTIONAL_USD = 100;

const toBoolean = (value: unknown, fallback = false) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return fallback;
};

const toPositiveNumber = (value: unknown, fallback: number) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const getExecutionAutomationSettings = (): ExecutionAutomationSettings => ({
  enabled: toBoolean(process.env.ALPACA_PAPER_EXECUTION_ENABLED, false),
  provider: "alpaca",
  mode: "paper",
  symbolAllowlist: ["BTCUSD"],
  longsEnabled: true,
  shortsEnabled: false,
  maxOpenPositions: 1,
  maxTradesPerDay: 3,
  sizingMode: "fixed_notional",
  notionalUsd: toPositiveNumber(process.env.ALPACA_PAPER_DEFAULT_NOTIONAL_USD, DEFAULT_NOTIONAL_USD),
  killSwitch: false,
});
