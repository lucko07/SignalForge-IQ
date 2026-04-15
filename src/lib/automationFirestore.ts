import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type DocumentSnapshot,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "./firebase";

export type BrokerProvider = "alpaca";
export type BrokerMode = "paper";
export type AutomationSizingMode = "fixed_notional";

export type BrokerConnection = {
  provider: BrokerProvider;
  mode: BrokerMode;
  connected: boolean;
  lastValidatedAt: unknown | null;
  paperTradingEnabled: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type AutomationSettings = {
  enabled: boolean;
  provider: BrokerProvider;
  mode: BrokerMode;
  symbolAllowlist: string[];
  longsEnabled: boolean;
  shortsEnabled: boolean;
  maxOpenPositions: number;
  maxTradesPerDay: number;
  sizingMode: AutomationSizingMode;
  notionalUsd: number;
  killSwitch: boolean;
};

export type ExecutionRecord = {
  id?: string;
  tradeId: string;
  signalId: string | null;
  uid: string | null;
  provider: BrokerProvider;
  mode: BrokerMode;
  symbol: string;
  side: string;
  positionSide: string;
  orderType: string;
  timeInForce: string;
  qty: string | null;
  notional: string | null;
  alpacaOrderId: string | null;
  clientOrderId: string;
  status: string;
  submittedAt: unknown | null;
  filledAt: unknown | null;
  canceledAt: unknown | null;
  filledQty: string | null;
  filledAvgPrice: string | null;
  rawStatus: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: unknown;
  updatedAt: unknown;
};

export type ExecutionStatusSummary = {
  queued: number;
  submitted: number;
  accepted: number;
  partiallyFilled: number;
  filled: number;
  closed: number;
  rejected: number;
  skipped: number;
  failed: number;
};

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

const getObjectData = (value: unknown) => (
  typeof value === "object" && value !== null ? value as Record<string, unknown> : {}
);

export const getDefaultBrokerConnection = (): BrokerConnection => ({
  ...DEFAULT_BROKER_CONNECTION,
});

export const getDefaultAutomationSettings = (): AutomationSettings => ({
  ...DEFAULT_AUTOMATION_SETTINGS,
  symbolAllowlist: [...DEFAULT_AUTOMATION_SETTINGS.symbolAllowlist],
});

export const normalizeBrokerConnection = (value: unknown): BrokerConnection => {
  const source = getObjectData(value);

  return {
    provider: source.provider === "alpaca" ? "alpaca" : DEFAULT_BROKER_CONNECTION.provider,
    mode: source.mode === "paper" ? "paper" : DEFAULT_BROKER_CONNECTION.mode,
    connected: normalizeBoolean(source.connected, DEFAULT_BROKER_CONNECTION.connected),
    lastValidatedAt: source.lastValidatedAt ?? DEFAULT_BROKER_CONNECTION.lastValidatedAt,
    paperTradingEnabled: normalizeBoolean(
      source.paperTradingEnabled,
      DEFAULT_BROKER_CONNECTION.paperTradingEnabled
    ),
    createdAt: source.createdAt ?? null,
    updatedAt: source.updatedAt ?? null,
  };
};

export const normalizeAutomationSettings = (value: unknown): AutomationSettings => {
  const source = getObjectData(value);

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
  const source = getObjectData(value);

  return typeof source.tradeId === "string"
    && typeof source.clientOrderId === "string"
    && typeof source.symbol === "string"
    && source.provider === "alpaca"
    && source.mode === "paper";
};

const readDocumentData = async (reference: ReturnType<typeof doc>) => {
  const snapshot = await getDoc(reference);
  return snapshot;
};

export const getBrokerConnection = async (uid: string) => {
  const snapshot = await readDocumentData(doc(db, "users", uid, "brokerConnections", "alpaca"));
  return snapshot.exists() ? normalizeBrokerConnection(snapshot.data()) : getDefaultBrokerConnection();
};

export const getAutomationSettings = async (uid: string) => {
  const snapshot = await readDocumentData(doc(db, "users", uid, "automationSettings", "default"));
  return snapshot.exists() ? normalizeAutomationSettings(snapshot.data()) : getDefaultAutomationSettings();
};

export const saveAlpacaPaperAutomationSettingsDocument = async (
  uid: string,
  updates: Partial<AutomationSettings>
) => {
  const reference = doc(db, "users", uid, "automationSettings", "default");
  const currentSettings = await getAutomationSettings(uid);
  const nextSettings = normalizeAutomationSettings({
    ...currentSettings,
    ...updates,
    provider: "alpaca",
    mode: "paper",
  });

  if (import.meta.env.DEV) {
    console.info("[automationFirestore] Writing paper automation settings", {
      uid,
      documentPath: reference.path,
      payload: {
        ...nextSettings,
        provider: "alpaca",
        mode: "paper",
      },
    });
  }

  try {
    await setDoc(
      reference,
      {
        ...nextSettings,
        provider: "alpaca",
        mode: "paper",
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("[automationFirestore] Paper automation settings write failed", {
        uid,
        documentPath: reference.path,
        error,
      });
    }
    throw error;
  }

  const confirmedSnapshot = await getDoc(reference);
  const confirmedSettings = confirmedSnapshot.exists()
    ? normalizeAutomationSettings(confirmedSnapshot.data())
    : nextSettings;

  if (import.meta.env.DEV) {
    console.info("[automationFirestore] Paper automation settings re-fetch result", {
      uid,
      nextSettings: confirmedSettings,
      documentPath: reference.path,
    });
  }

  return confirmedSettings;
};

export const mapExecutionRecord = (
  snapshot: DocumentSnapshot<DocumentData>
): ExecutionRecord | null => {
  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();
  const source = getObjectData(data);

  if (!isExecutionRecord(source)) {
    return null;
  }

  return {
    id: snapshot.id,
    tradeId: source.tradeId,
    signalId: typeof source.signalId === "string" ? source.signalId : null,
    uid: typeof source.uid === "string" ? source.uid : null,
    provider: "alpaca",
    mode: "paper",
    symbol: source.symbol,
    side: typeof source.side === "string" ? source.side : "",
    positionSide: typeof source.positionSide === "string" ? source.positionSide : "",
    orderType: typeof source.orderType === "string" ? source.orderType : "",
    timeInForce: typeof source.timeInForce === "string" ? source.timeInForce : "",
    qty: typeof source.qty === "string" ? source.qty : null,
    notional: typeof source.notional === "string" ? source.notional : null,
    alpacaOrderId: typeof source.alpacaOrderId === "string" ? source.alpacaOrderId : null,
    clientOrderId: source.clientOrderId,
    status: typeof source.status === "string" ? source.status : "",
    submittedAt: source.submittedAt ?? null,
    filledAt: source.filledAt ?? null,
    canceledAt: source.canceledAt ?? null,
    filledQty: typeof source.filledQty === "string" ? source.filledQty : null,
    filledAvgPrice: typeof source.filledAvgPrice === "string" ? source.filledAvgPrice : null,
    rawStatus: typeof source.rawStatus === "string" ? source.rawStatus : null,
    errorCode: typeof source.errorCode === "string" ? source.errorCode : null,
    errorMessage: typeof source.errorMessage === "string" ? source.errorMessage : null,
    createdAt: source.createdAt ?? null,
    updatedAt: source.updatedAt ?? null,
  };
};

export const getRecentExecutionRecords = async (maxResults = 12) => {
  const executionQuery = query(
    collection(db, "executions"),
    orderBy("createdAt", "desc"),
    limit(maxResults)
  );
  const snapshot = await getDocs(executionQuery);

  return snapshot.docs
    .map((documentSnapshot) => mapExecutionRecord(documentSnapshot))
    .filter((record): record is ExecutionRecord => record !== null);
};

export const summarizeExecutionStatuses = (
  records: ExecutionRecord[]
): ExecutionStatusSummary => {
  return records.reduce<ExecutionStatusSummary>((summary, record) => {
    const normalizedStatus = record.status.trim().toLowerCase();
    if (normalizedStatus === "queued" || normalizedStatus === "processing") {
      summary.queued += 1;
    } else if (normalizedStatus === "submitted") {
      summary.submitted += 1;
    } else if (normalizedStatus === "accepted") {
      summary.accepted += 1;
    } else if (normalizedStatus === "partially_filled") {
      summary.partiallyFilled += 1;
    } else if (normalizedStatus === "filled") {
      summary.filled += 1;
    } else if (normalizedStatus === "closed") {
      summary.closed += 1;
    } else if (
      normalizedStatus === "rejected"
      || normalizedStatus === "canceled"
      || normalizedStatus === "expired"
    ) {
      summary.rejected += 1;
    } else if (
      normalizedStatus === "skipped"
      || normalizedStatus === "duplicate"
      || normalizedStatus === "position_conflict"
      || normalizedStatus === "already_closed"
      || normalizedStatus === "no_open_position"
      || normalizedStatus === "duplicate_exit"
    ) {
      summary.skipped += 1;
    } else if (normalizedStatus === "error" || normalizedStatus === "failed") {
      summary.failed += 1;
    }

    return summary;
  }, {
    queued: 0,
    submitted: 0,
    accepted: 0,
    partiallyFilled: 0,
    filled: 0,
    closed: 0,
    rejected: 0,
    skipped: 0,
    failed: 0,
  });
};
