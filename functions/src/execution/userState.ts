import type { Firestore } from "firebase-admin/firestore";
import type { AutomationSettings, BrokerConnection, ExecutionRecord } from "./types.js";

const DEFAULT_BROKER_CONNECTION: BrokerConnection = {
  provider: "alpaca",
  mode: "paper",
  connected: false,
  lastValidatedAt: null,
  paperTradingEnabled: false,
};

const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  enabled: false,
  provider: "alpaca",
  mode: "paper",
  symbolAllowlist: ["BTCUSD"],
  longsEnabled: true,
  shortsEnabled: false,
  maxOpenPositions: 1,
  maxTradesPerDay: 3,
  sizingMode: "fixed_notional",
  notionalUsd: 100,
  killSwitch: false,
};

const normalizeBoolean = (value: unknown, fallback: boolean) => (
  typeof value === "boolean" ? value : fallback
);

const normalizePositiveInteger = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizePositiveNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeSymbolAllowlist = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [...DEFAULT_AUTOMATION_SETTINGS.symbolAllowlist];
  }

  const normalized = value
    .map((item) => (typeof item === "string" ? item.trim().toUpperCase() : ""))
    .filter(Boolean);

  return normalized.length > 0 ? [...new Set(normalized)] : [...DEFAULT_AUTOMATION_SETTINGS.symbolAllowlist];
};

export const getDefaultBrokerConnection = (): BrokerConnection => ({
  ...DEFAULT_BROKER_CONNECTION,
});

export const getDefaultAutomationSettings = (): AutomationSettings => ({
  ...DEFAULT_AUTOMATION_SETTINGS,
  symbolAllowlist: [...DEFAULT_AUTOMATION_SETTINGS.symbolAllowlist],
});

export const normalizeBrokerConnection = (value: unknown): BrokerConnection => {
  const source = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};

  return {
    provider: source.provider === "alpaca" ? "alpaca" : DEFAULT_BROKER_CONNECTION.provider,
    mode: source.mode === "paper" ? "paper" : DEFAULT_BROKER_CONNECTION.mode,
    connected: normalizeBoolean(source.connected, DEFAULT_BROKER_CONNECTION.connected),
    lastValidatedAt:
      source.lastValidatedAt instanceof Date
      || typeof source.lastValidatedAt === "string"
      || (
        typeof source.lastValidatedAt === "object"
        && source.lastValidatedAt !== null
        && "toDate" in source.lastValidatedAt
      )
        ? source.lastValidatedAt as BrokerConnection["lastValidatedAt"]
        : DEFAULT_BROKER_CONNECTION.lastValidatedAt,
    paperTradingEnabled: normalizeBoolean(
      source.paperTradingEnabled,
      DEFAULT_BROKER_CONNECTION.paperTradingEnabled
    ),
    createdAt:
      source.createdAt instanceof Date
      || typeof source.createdAt === "string"
      || (
        typeof source.createdAt === "object"
        && source.createdAt !== null
        && "toDate" in source.createdAt
      )
        ? source.createdAt as BrokerConnection["createdAt"]
        : null,
    updatedAt:
      source.updatedAt instanceof Date
      || typeof source.updatedAt === "string"
      || (
        typeof source.updatedAt === "object"
        && source.updatedAt !== null
        && "toDate" in source.updatedAt
      )
        ? source.updatedAt as BrokerConnection["updatedAt"]
        : null,
  };
};

export const normalizeAutomationSettings = (value: unknown): AutomationSettings => {
  const source = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};

  return {
    enabled: normalizeBoolean(source.enabled, DEFAULT_AUTOMATION_SETTINGS.enabled),
    provider: source.provider === "alpaca" ? "alpaca" : DEFAULT_AUTOMATION_SETTINGS.provider,
    mode: source.mode === "paper" ? "paper" : DEFAULT_AUTOMATION_SETTINGS.mode,
    symbolAllowlist: normalizeSymbolAllowlist(source.symbolAllowlist),
    longsEnabled: normalizeBoolean(source.longsEnabled, DEFAULT_AUTOMATION_SETTINGS.longsEnabled),
    shortsEnabled: normalizeBoolean(source.shortsEnabled, DEFAULT_AUTOMATION_SETTINGS.shortsEnabled),
    maxOpenPositions: normalizePositiveInteger(source.maxOpenPositions, DEFAULT_AUTOMATION_SETTINGS.maxOpenPositions),
    maxTradesPerDay: normalizePositiveInteger(source.maxTradesPerDay, DEFAULT_AUTOMATION_SETTINGS.maxTradesPerDay),
    sizingMode: source.sizingMode === "fixed_notional"
      ? "fixed_notional"
      : DEFAULT_AUTOMATION_SETTINGS.sizingMode,
    notionalUsd: normalizePositiveNumber(source.notionalUsd, DEFAULT_AUTOMATION_SETTINGS.notionalUsd),
    killSwitch: normalizeBoolean(source.killSwitch, DEFAULT_AUTOMATION_SETTINGS.killSwitch),
  };
};

export const isBrokerConnection = (value: unknown): value is BrokerConnection => {
  const normalized = normalizeBrokerConnection(value);
  return normalized.provider === "alpaca" && normalized.mode === "paper";
};

export const isAutomationSettings = (value: unknown): value is AutomationSettings => {
  const normalized = normalizeAutomationSettings(value);
  return normalized.provider === "alpaca" && normalized.mode === "paper";
};

export const isExecutionRecord = (value: unknown): value is ExecutionRecord => {
  const source = typeof value === "object" && value !== null ? value as Record<string, unknown> : null;

  if (!source) {
    return false;
  }

  return typeof source.tradeId === "string"
    && typeof source.clientOrderId === "string"
    && typeof source.symbol === "string"
    && source.provider === "alpaca"
    && source.mode === "paper";
};

export const getBrokerConnection = async (db: Firestore, uid: string) => {
  const snapshot = await db
    .collection("users")
    .doc(uid)
    .collection("brokerConnections")
    .doc("alpaca")
    .get();

  return snapshot.exists ? normalizeBrokerConnection(snapshot.data()) : getDefaultBrokerConnection();
};

export const getAutomationSettings = async (db: Firestore, uid: string) => {
  const snapshot = await db
    .collection("users")
    .doc(uid)
    .collection("automationSettings")
    .doc("default")
    .get();

  return snapshot.exists ? normalizeAutomationSettings(snapshot.data()) : getDefaultAutomationSettings();
};
