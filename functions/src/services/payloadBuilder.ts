import { type DeliveryPlan, normalizeDeliveryPlan } from "./deliveryPolicy.js";

type SignalDirection = "LONG" | "SHORT";
type SignalStatus = "ACTIVE" | "CLOSED" | "PENDING";

export type SignalWebhookInput = {
  signalId?: string | null;
  symbol: string;
  assetType: string;
  direction: string;
  entry: string;
  stopLoss: string;
  target: string;
  thesis: string;
  status: string;
  source?: string | null;
  timeframe?: string | null;
  confidence?: string | null;
  strategyName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  reviewStatus?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  checklist?: string[] | null;
  analyst?: string | null;
  riskRewardRatio?: string | number | null;
  marketContext?: string | null;
  invalidationReason?: string | null;
};

export type StandardSignalWebhookPayload = {
  signalId: string | null;
  symbol: string;
  assetType: string;
  direction: SignalDirection;
  entry: string;
  stopLoss: string;
  target: string;
  thesis: string;
  status: SignalStatus;
  source: string;
  timeframe?: string;
  confidence?: string;
  strategyName?: string;
};

export type ExtendedSignalWebhookPayload = StandardSignalWebhookPayload & {
  createdAt?: string;
  updatedAt?: string;
  reviewStatus?: string;
  notes?: string;
  tags?: string[];
  checklist?: string[];
  analyst?: string;
  riskRewardRatio?: string;
  marketContext?: string;
  invalidationReason?: string;
};

const normalizeText = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue || null;
};

const normalizeOptionalList = (value: unknown) => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalizedItems = value
    .map((item) => normalizeText(item))
    .filter((item): item is string => item !== null);

  return normalizedItems.length > 0 ? normalizedItems : undefined;
};

const normalizeDirection = (value: unknown): SignalDirection => {
  const normalizedValue = normalizeText(value)?.toUpperCase();
  return normalizedValue === "SHORT" ? "SHORT" : "LONG";
};

const normalizeStatus = (value: unknown): SignalStatus => {
  const normalizedValue = normalizeText(value)?.toUpperCase();

  if (normalizedValue === "CLOSED") {
    return "CLOSED";
  }

  if (normalizedValue === "PENDING") {
    return "PENDING";
  }

  return "ACTIVE";
};

const withOptionalFields = <T extends Record<string, unknown>>(payload: T) =>
  Object.fromEntries(
    Object.entries(payload).filter(([, value]) => {
      if (value === undefined || value === null) {
        return false;
      }

      if (typeof value === "string") {
        return value.trim() !== "";
      }

      if (Array.isArray(value)) {
        return value.length > 0;
      }

      return true;
    })
  ) as T;

export const buildSignalWebhookPayload = (
  signal: SignalWebhookInput,
  plan: DeliveryPlan | string
): StandardSignalWebhookPayload | ExtendedSignalWebhookPayload => {
  const normalizedPlan = normalizeDeliveryPlan(plan);

  const standardPayload = withOptionalFields({
    signalId: normalizeText(signal.signalId) ?? null,
    symbol: normalizeText(signal.symbol)?.toUpperCase() ?? "",
    assetType: normalizeText(signal.assetType)?.toLowerCase() ?? "",
    direction: normalizeDirection(signal.direction),
    entry: normalizeText(signal.entry) ?? "",
    stopLoss: normalizeText(signal.stopLoss) ?? "",
    target: normalizeText(signal.target) ?? "",
    thesis: normalizeText(signal.thesis) ?? "",
    status: normalizeStatus(signal.status),
    source: normalizeText(signal.source) ?? "signalforge",
    timeframe: normalizeText(signal.timeframe) ?? undefined,
    confidence: normalizeText(signal.confidence) ?? undefined,
    strategyName: normalizeText(signal.strategyName) ?? undefined,
  }) as StandardSignalWebhookPayload;

  if (normalizedPlan === "pro") {
    return standardPayload;
  }

  return withOptionalFields({
    ...standardPayload,
    createdAt: normalizeText(signal.createdAt) ?? undefined,
    updatedAt: normalizeText(signal.updatedAt) ?? undefined,
    reviewStatus: normalizeText(signal.reviewStatus) ?? undefined,
    notes: normalizeText(signal.notes) ?? undefined,
    tags: normalizeOptionalList(signal.tags),
    checklist: normalizeOptionalList(signal.checklist),
    analyst: normalizeText(signal.analyst) ?? undefined,
    riskRewardRatio: signal.riskRewardRatio == null
      ? undefined
      : String(signal.riskRewardRatio).trim(),
    marketContext: normalizeText(signal.marketContext) ?? undefined,
    invalidationReason: normalizeText(signal.invalidationReason) ?? undefined,
  }) as ExtendedSignalWebhookPayload;
};
