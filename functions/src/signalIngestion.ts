import { FieldValue, getFirestore } from "firebase-admin/firestore";

export const PENDING_COLLECTION_NAME = "pendingSignals";

const allowedDirections = new Set(["LONG", "SHORT"]);
const allowedStatuses = new Set(["ACTIVE", "CLOSED", "PENDING"]);

export type SignalPayload = {
  symbol: string;
  assetType: string;
  direction: string;
  entry: string;
  stopLoss: string;
  target: string;
  thesis: string;
  status: string;
  source?: string;
  timeframe?: string;
  confidence?: string;
  strategyName?: string;
};

type ValidationResult =
  | { valid: true }
  | { valid: false; errors: string[] };

export const validateSignalPayload = (payload: unknown): ValidationResult => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      valid: false,
      errors: ["Request body must be a JSON object."],
    };
  }

  const candidate = payload as Record<string, unknown>;
  const requiredFields = [
    "symbol",
    "assetType",
    "direction",
    "entry",
    "stopLoss",
    "target",
    "thesis",
    "status",
  ];
  const optionalStringFields = ["source", "timeframe", "confidence", "strategyName"];
  const errors: string[] = [];

  for (const field of requiredFields) {
    const value = candidate[field];

    if (typeof value !== "string" || value.trim() === "") {
      errors.push(`${field} is required and must be a non-empty string.`);
    }
  }

  for (const field of optionalStringFields) {
    const value = candidate[field];

    if (value !== undefined && typeof value !== "string") {
      errors.push(`${field} must be a string when provided.`);
    }
  }

  const direction = typeof candidate.direction === "string"
    ? candidate.direction.trim().toUpperCase()
    : "";
  const status = typeof candidate.status === "string"
    ? candidate.status.trim().toUpperCase()
    : "";

  if (direction && !allowedDirections.has(direction)) {
    errors.push("direction must be LONG or SHORT.");
  }

  if (status && !allowedStatuses.has(status)) {
    errors.push("status must be ACTIVE, CLOSED, or PENDING.");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
};

export const normalizeSignalPayload = (payload: SignalPayload) => {
  const normalized = {
    symbol: payload.symbol.trim().toUpperCase(),
    assetType: payload.assetType.trim().toLowerCase(),
    direction: payload.direction.trim().toUpperCase(),
    entry: payload.entry.trim(),
    stopLoss: payload.stopLoss.trim(),
    target: payload.target.trim(),
    thesis: payload.thesis.trim(),
    status: payload.status.trim().toUpperCase(),
    source: payload.source?.trim() || "webhook",
    timeframe: payload.timeframe?.trim(),
    confidence: payload.confidence?.trim(),
    strategyName: payload.strategyName?.trim(),
    reviewStatus: "PENDING",
    ingestionTimestamp: FieldValue.serverTimestamp(),
    ingestedBy: "ingestSignal",
    createdAt: FieldValue.serverTimestamp(),
  };

  return Object.fromEntries(
    Object.entries(normalized).filter(([, value]) => value !== undefined && value !== "")
  );
};

export const saveSignalToFirestore = async (payload: SignalPayload) => {
  const db = getFirestore();
  const collectionName = PENDING_COLLECTION_NAME;
  const normalizedPayload = normalizeSignalPayload(payload);
  const documentReference = await db.collection(collectionName).add(normalizedPayload);

  return {
    id: documentReference.id,
    collectionName,
  };
};
