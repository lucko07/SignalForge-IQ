import {
  addDoc,
  collection,
  deleteField,
  type DocumentData,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  type QueryDocumentSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

export type UserProfile = {
  uid: string;
  fullName: string;
  email: string;
  plan: UserPlan;
  role: UserRole;
  currentPlan?: UserPlan;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  billingStatus?: string;
  cancelAtPeriodEnd?: boolean;
  subscriptionEndsAt?: Timestamp | null;
};

export const hasActiveBillingAccess = (
  profile: Pick<UserProfile, "plan" | "role" | "billingStatus"> | null
) => {
  if (!profile) {
    return false;
  }

  if (profile.role === "admin" || profile.plan === "admin") {
    return true;
  }

  if (profile.plan !== "pro" && profile.plan !== "elite") {
    return false;
  }

  if (!profile.billingStatus) {
    return true;
  }

  return (
    profile.billingStatus === "active"
    || profile.billingStatus === "trialing"
    || profile.billingStatus === "past_due"
  );
};

export const isStripeManagedPlan = (
  profile: Pick<UserProfile, "plan" | "role"> | null
) => {
  if (!profile) {
    return false;
  }

  return profile.role !== "admin" && (profile.plan === "pro" || profile.plan === "elite");
};

export const userPlans = ["free", "pro", "elite", "admin"] as const;

export type UserPlan = (typeof userPlans)[number];

export type UserRole = "member" | "admin";

export const signalStatuses = [
  "PENDING",
  "ACTIVE",
  "TAKE_PROFIT",
  "STOPPED",
  "CLOSED",
  "CANCELLED",
] as const;

export type SignalStatus = (typeof signalStatuses)[number];

export const signalOutcomes = [
  "WIN",
  "LOSS",
  "BREAKEVEN",
  "CANCELLED",
] as const;

export type SignalOutcome = (typeof signalOutcomes)[number];

export const closeSignalReasons = [
  "TAKE_PROFIT",
  "STOPPED",
  "BREAKEVEN",
  "MANUAL_CLOSE",
  "CANCELLED",
] as const;

export type CloseSignalReason = (typeof closeSignalReasons)[number];

export type PerformanceSummary = {
  totalClosedSignals: number;
  wins: number;
  losses: number;
  breakevenCount: number;
  cancelledCount: number;
  winRate: number;
  averagePnlPercent: number;
};

export type Signal = {
  id: string;
  symbol: string;
  assetType: string;
  direction: string;
  entry: string;
  stopLoss: string;
  target: string;
  thesis: string;
  status: SignalStatus;
  source?: string;
  timeframe?: string;
  confidence?: string;
  strategyName?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  updatedBy?: string;
  approvedAt?: unknown;
  approvedBy?: string;
  statusUpdatedAt?: unknown;
  statusUpdatedBy?: string;
  outcome?: SignalOutcome;
  exitPrice?: string;
  exitReason?: CloseSignalReason;
  closedAt?: unknown;
  pnlPercent?: number;
  rrResult?: number;
};

export type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

export type PendingSignal = Signal & {
  reviewStatus: ReviewStatus;
  ingestedBy?: string;
  ingestionTimestamp?: unknown;
  approvedAt?: unknown;
  approvedBy?: string;
  reviewedAt?: unknown;
  reviewedBy?: string;
};

export type SignalInput = Omit<
  Signal,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "updatedBy"
  | "approvedAt"
  | "approvedBy"
  | "statusUpdatedAt"
  | "statusUpdatedBy"
  | "outcome"
  | "exitPrice"
  | "exitReason"
  | "closedAt"
  | "pnlPercent"
  | "rrResult"
>;

type SignalCallback = (signals: Signal[]) => void;
type PendingSignalCallback = (signals: PendingSignal[]) => void;
type SignalErrorCallback = (error: Error) => void;

const editableSignalFieldNames = [
  "symbol",
  "assetType",
  "direction",
  "entry",
  "stopLoss",
  "target",
  "thesis",
  "status",
  "source",
  "timeframe",
  "confidence",
  "strategyName",
] satisfies Array<keyof SignalInput>;

export const createUserProfile = async ({
  uid,
  fullName,
  email,
  plan: _plan,
  role: _role = "member",
}: UserProfile) => {
  await setDoc(doc(db, "users", uid), {
    fullName,
    email,
    createdAt: serverTimestamp(),
  });
};

export const getUserProfile = async (uid: string) => {
  const snapshot = await getDoc(doc(db, "users", uid));

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();

  return {
    uid: String(data.uid ?? uid),
    fullName: String(data.fullName ?? ""),
    email: String(data.email ?? ""),
    plan: normalizeUserPlan(data.plan),
    role: normalizeUserRole(data.role),
    currentPlan: data.currentPlan ? normalizeUserPlan(data.currentPlan) : undefined,
    stripeCustomerId: data.stripeCustomerId ? String(data.stripeCustomerId) : undefined,
    stripeSubscriptionId: data.stripeSubscriptionId ? String(data.stripeSubscriptionId) : undefined,
    billingStatus: data.billingStatus ? String(data.billingStatus).trim().toLowerCase() : undefined,
    cancelAtPeriodEnd: data.cancelAtPeriodEnd === true,
    subscriptionEndsAt: data.subscriptionEndsAt instanceof Timestamp ? data.subscriptionEndsAt : null,
    createdAt: data.createdAt,
  } satisfies UserProfile & { createdAt?: unknown };
};

export const getSignals = async (maxResults?: number) => {
  const signalsQuery = createSignalsQuery(maxResults);
  const snapshot = await getDocs(signalsQuery);

  return snapshot.docs.map(mapSignalDocument);
};

export const subscribeToSignals = (
  callback: SignalCallback,
  maxResults?: number,
  onError?: SignalErrorCallback
) => {
  const signalsQuery = createSignalsQuery(maxResults);

  return onSnapshot(
    signalsQuery,
    (snapshot) => {
      callback(snapshot.docs.map(mapSignalDocument));
    },
    (error) => {
      if (onError) {
        onError(error);
      }
    }
  );
};

export const subscribeToPendingSignals = (
  callback: PendingSignalCallback,
  onError?: SignalErrorCallback
) => {
  const pendingSignalsQuery = query(
    collection(db, "pendingSignals"),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(
    pendingSignalsQuery,
    (snapshot) => {
      callback(
        snapshot.docs
          .map(mapPendingSignalDocument)
          .filter((signal) => signal.reviewStatus === "PENDING")
      );
    },
    (error) => {
      if (onError) {
        onError(error);
      }
    }
  );
};

export const createSignal = async (signalData: SignalInput) => {
  await addDoc(collection(db, "signals"), {
    ...normalizeSignalInput(signalData),
    createdAt: serverTimestamp(),
  });
};

export const updatePendingSignal = async (
  pendingSignalId: string,
  updates: Partial<SignalInput>
) => {
  const normalizedUpdates = stripUndefinedFields(normalizeSignalInput(updates));

  if (Object.keys(normalizedUpdates).length === 0) {
    return;
  }

  await updateDoc(doc(db, "pendingSignals", pendingSignalId), normalizedUpdates);
};

export const approvePendingSignal = async (
  pendingSignalId: string,
  approvedBy: string,
  updates: Partial<SignalInput> = {}
) => {
  const pendingSignalReference = doc(db, "pendingSignals", pendingSignalId);
  const approvedSignalReference = doc(db, "signals", pendingSignalId);
  const pendingSignalSnapshot = await getDoc(pendingSignalReference);

  if (!pendingSignalSnapshot.exists()) {
    throw new Error("Pending signal not found.");
  }

  const currentPendingSignal = mapPendingSignalDocument(pendingSignalSnapshot);
  const mergedSignalFields = getMergedSignalFields(currentPendingSignal, updates);
  const sanitizedMergedSignalFields = stripUndefinedFields(mergedSignalFields);
  const batch = writeBatch(db);

  batch.set(approvedSignalReference, {
    ...sanitizedMergedSignalFields,
    createdAt: currentPendingSignal.createdAt ?? serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: approvedBy,
    source: mergedSignalFields.source ?? currentPendingSignal.source ?? "webhook",
    ingestedBy: currentPendingSignal.ingestedBy ?? "function",
    ingestionTimestamp:
      currentPendingSignal.ingestionTimestamp
      ?? currentPendingSignal.createdAt
      ?? serverTimestamp(),
    reviewStatus: "APPROVED",
    approvedAt: serverTimestamp(),
    approvedBy,
    statusUpdatedAt: serverTimestamp(),
    statusUpdatedBy: approvedBy,
  });

  batch.update(pendingSignalReference, {
    ...sanitizedMergedSignalFields,
    reviewStatus: "APPROVED",
    approvedAt: serverTimestamp(),
    approvedBy,
    reviewedAt: serverTimestamp(),
    reviewedBy: approvedBy,
  });

  await batch.commit();
};

export const updateSignalStatus = async (
  signalId: string,
  status: SignalStatus,
  updatedBy: string
) => {
  await updateDoc(doc(db, "signals", signalId), {
    status,
    updatedAt: serverTimestamp(),
    updatedBy,
    statusUpdatedAt: serverTimestamp(),
    statusUpdatedBy: updatedBy,
    ...(status === "ACTIVE"
      ? {
        outcome: deleteField(),
        exitPrice: deleteField(),
        exitReason: deleteField(),
        closedAt: deleteField(),
        pnlPercent: deleteField(),
        rrResult: deleteField(),
      }
      : {}),
  });
};

export const updateSignalFields = async (
  signalId: string,
  updates: Partial<SignalInput>,
  updatedBy: string
) => {
  const normalizedUpdates = stripUndefinedFields(normalizeSignalInput(updates));

  if (Object.keys(normalizedUpdates).length === 0) {
    return;
  }

  await updateDoc(doc(db, "signals", signalId), {
    ...normalizedUpdates,
    updatedAt: serverTimestamp(),
    updatedBy,
    ...(normalizedUpdates.status
      ? {
        statusUpdatedAt: serverTimestamp(),
        statusUpdatedBy: updatedBy,
      }
      : {}),
  });
};

export const closeSignal = async (
  signalId: string,
  closeReason: CloseSignalReason,
  updatedBy: string,
  exitPrice?: string
) => {
  const signalSnapshot = await getDoc(doc(db, "signals", signalId));

  if (!signalSnapshot.exists()) {
    throw new Error("Signal not found.");
  }

  const currentSignal = mapPendingSignalDocument(signalSnapshot);
  const normalizedExitPrice = normalizeOptionalText(exitPrice);
  const closingData = buildSignalClosingData(currentSignal, closeReason, normalizedExitPrice);

  await updateDoc(doc(db, "signals", signalId), stripUndefinedFields({
    ...closingData,
    updatedAt: serverTimestamp(),
    updatedBy,
    statusUpdatedAt: serverTimestamp(),
    statusUpdatedBy: updatedBy,
    closedAt: serverTimestamp(),
  }));
};

export const updateSignalOutcome = async (
  signalId: string,
  updates: Pick<Signal, "outcome" | "exitPrice" | "exitReason" | "pnlPercent" | "rrResult">,
  updatedBy: string
) => {
  await updateDoc(doc(db, "signals", signalId), stripUndefinedFields({
    outcome: updates.outcome,
    exitPrice: normalizeOptionalText(updates.exitPrice),
    exitReason: updates.exitReason,
    pnlPercent: updates.pnlPercent,
    rrResult: updates.rrResult,
    updatedAt: serverTimestamp(),
    updatedBy,
  }));
};

export const getPerformanceSummary = async (): Promise<PerformanceSummary> => {
  const snapshot = await getDocs(query(collection(db, "signals"), orderBy("createdAt", "desc")));
  const signals = snapshot.docs.map(mapSignalDocument);
  const closedSignals = signals.filter((signal) => isSignalClosed(signal));

  const wins = closedSignals.filter((signal) => signal.outcome === "WIN").length;
  const losses = closedSignals.filter((signal) => signal.outcome === "LOSS").length;
  const breakevenCount = closedSignals.filter((signal) => signal.outcome === "BREAKEVEN").length;
  const cancelledCount = closedSignals.filter((signal) => signal.outcome === "CANCELLED").length;
  const pnlValues = closedSignals
    .map((signal) => signal.pnlPercent)
    .filter((value): value is number => typeof value === "number");
  const averagePnlPercent =
    pnlValues.length > 0
      ? Number((pnlValues.reduce((sum, value) => sum + value, 0) / pnlValues.length).toFixed(2))
      : 0;
  const resolvedTrades = wins + losses + breakevenCount;
  const winRate = resolvedTrades > 0 ? Number(((wins / resolvedTrades) * 100).toFixed(2)) : 0;

  return {
    totalClosedSignals: closedSignals.length,
    wins,
    losses,
    breakevenCount,
    cancelledCount,
    winRate,
    averagePnlPercent,
  };
};

export const rejectPendingSignal = async (
  pendingSignalId: string,
  rejectedBy: string
) => {
  await updateDoc(doc(db, "pendingSignals", pendingSignalId), stripUndefinedFields({
    reviewStatus: "REJECTED",
    reviewedAt: serverTimestamp(),
    reviewedBy: rejectedBy,
  }));
};

const createSignalsQuery = (maxResults?: number) => {
  const signalsCollection = collection(db, "signals");

  return typeof maxResults === "number"
    ? query(signalsCollection, orderBy("createdAt", "desc"), limit(maxResults))
    : query(signalsCollection, orderBy("createdAt", "desc"));
};

const mapSignalDocument = (signalDocument: QueryDocumentSnapshot<DocumentData>) => {
  const data = signalDocument.data();

  return {
    id: signalDocument.id,
    symbol: String(data.symbol ?? ""),
    assetType: String(data.assetType ?? ""),
    direction: String(data.direction ?? ""),
    entry: String(data.entry ?? ""),
    stopLoss: String(data.stopLoss ?? ""),
    target: String(data.target ?? ""),
    thesis: String(data.thesis ?? ""),
    status: normalizeSignalStatus(data.status),
    source: data.source ? String(data.source) : undefined,
    timeframe: data.timeframe ? String(data.timeframe) : undefined,
    confidence: data.confidence ? String(data.confidence) : undefined,
    strategyName: data.strategyName ? String(data.strategyName) : undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    updatedBy: data.updatedBy ? String(data.updatedBy) : undefined,
    approvedAt: data.approvedAt,
    approvedBy: data.approvedBy ? String(data.approvedBy) : undefined,
    statusUpdatedAt: data.statusUpdatedAt,
    statusUpdatedBy: data.statusUpdatedBy ? String(data.statusUpdatedBy) : undefined,
    outcome: normalizeSignalOutcome(data.outcome),
    exitPrice: data.exitPrice ? String(data.exitPrice) : undefined,
    exitReason: normalizeCloseSignalReason(data.exitReason),
    closedAt: data.closedAt,
    pnlPercent: typeof data.pnlPercent === "number" ? data.pnlPercent : undefined,
    rrResult: typeof data.rrResult === "number" ? data.rrResult : undefined,
  } satisfies Signal;
};

const mapPendingSignalDocument = (
  signalDocument:
    | QueryDocumentSnapshot<DocumentData>
    | { id: string; data: () => DocumentData }
) => {
  const data = signalDocument.data();

  return {
    id: signalDocument.id,
    symbol: String(data.symbol ?? ""),
    assetType: String(data.assetType ?? ""),
    direction: String(data.direction ?? ""),
    entry: String(data.entry ?? ""),
    stopLoss: String(data.stopLoss ?? ""),
    target: String(data.target ?? ""),
    thesis: String(data.thesis ?? ""),
    status: normalizeSignalStatus(data.status),
    source: data.source ? String(data.source) : undefined,
    timeframe: data.timeframe ? String(data.timeframe) : undefined,
    confidence: data.confidence ? String(data.confidence) : undefined,
    strategyName: data.strategyName ? String(data.strategyName) : undefined,
    createdAt: data.createdAt,
    reviewStatus: normalizeReviewStatus(data.reviewStatus),
    ingestedBy: data.ingestedBy ? String(data.ingestedBy) : undefined,
    ingestionTimestamp: data.ingestionTimestamp,
    approvedAt: data.approvedAt,
    approvedBy: data.approvedBy ? String(data.approvedBy) : undefined,
    reviewedAt: data.reviewedAt,
    reviewedBy: data.reviewedBy ? String(data.reviewedBy) : undefined,
  } satisfies PendingSignal;
};

const normalizeSignalInput = (signalData: Partial<SignalInput>) => {
  const normalizedEntries = Object.entries(signalData).flatMap(([key, value]) => {
    if (typeof value !== "string") {
      return [];
    }

    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return [];
    }

    if (key === "symbol") {
      return [[key, trimmedValue.toUpperCase()]];
    }

    if (key === "assetType") {
      return [[key, trimmedValue.toLowerCase()]];
    }

    if (key === "direction") {
      return [[key, trimmedValue.toUpperCase()]];
    }

    if (key === "status") {
      return [[key, normalizeSignalStatus(trimmedValue)]];
    }

    return [[key, trimmedValue]];
  });

  return Object.fromEntries(normalizedEntries) as Partial<SignalInput>;
};

const normalizeOptionalText = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue || undefined;
};

const stripUndefinedFields = <T extends Record<string, unknown>>(data: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  ) as Partial<T>;

const getMergedSignalFields = (
  currentSignal: PendingSignal,
  updates: Partial<SignalInput>
): SignalInput => {
  const normalizedUpdates = normalizeSignalInput(updates);
  const mergedSignal = editableSignalFieldNames.reduce<Partial<SignalInput>>((result, fieldName) => {
    const updatedValue = normalizedUpdates[fieldName];
    const currentValue = currentSignal[fieldName];

    if (fieldName === "status") {
      if (updatedValue) {
        result.status = normalizeSignalStatus(updatedValue);
        return result;
      }

      result.status = currentSignal.status;
      return result;
    }

    if (updatedValue) {
      result[fieldName] = updatedValue;
      return result;
    }

    if (typeof currentValue === "string" && currentValue.trim()) {
      result[fieldName] = currentValue;
    }

    return result;
  }, {});

  return {
    symbol: mergedSignal.symbol ?? currentSignal.symbol,
    assetType: mergedSignal.assetType ?? currentSignal.assetType,
    direction: mergedSignal.direction ?? currentSignal.direction,
    entry: mergedSignal.entry ?? currentSignal.entry,
    stopLoss: mergedSignal.stopLoss ?? currentSignal.stopLoss,
    target: mergedSignal.target ?? currentSignal.target,
    thesis: mergedSignal.thesis ?? currentSignal.thesis,
    status: mergedSignal.status ?? currentSignal.status,
    source: mergedSignal.source ?? currentSignal.source ?? "webhook",
    timeframe: mergedSignal.timeframe,
    confidence: mergedSignal.confidence,
    strategyName: mergedSignal.strategyName,
  };
};

const normalizeReviewStatus = (value: unknown): ReviewStatus => {
  const normalizedValue = typeof value === "string" ? value.trim().toUpperCase() : "";

  if (
    normalizedValue === "PENDING"
    || normalizedValue === "APPROVED"
    || normalizedValue === "REJECTED"
  ) {
    return normalizedValue;
  }

  return "PENDING";
};

const normalizeSignalStatus = (value: unknown): SignalStatus => {
  const normalizedValue = typeof value === "string" ? value.trim().toUpperCase() : "";

  if (signalStatuses.includes(normalizedValue as SignalStatus)) {
    return normalizedValue as SignalStatus;
  }

  return "PENDING";
};

const normalizeSignalOutcome = (value: unknown): SignalOutcome | undefined => {
  const normalizedValue = typeof value === "string" ? value.trim().toUpperCase() : "";

  if (signalOutcomes.includes(normalizedValue as SignalOutcome)) {
    return normalizedValue as SignalOutcome;
  }

  return undefined;
};

const normalizeCloseSignalReason = (value: unknown): CloseSignalReason | undefined => {
  const normalizedValue = typeof value === "string" ? value.trim().toUpperCase() : "";

  if (closeSignalReasons.includes(normalizedValue as CloseSignalReason)) {
    return normalizedValue as CloseSignalReason;
  }

  return undefined;
};

const parseNumericValue = (value: string) => {
  const normalizedValue = value.replace(/,/g, "").trim();
  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const buildSignalClosingData = (
  signal: Signal,
  closeReason: CloseSignalReason,
  exitPrice?: string
) => {
  if (closeReason !== "CANCELLED" && !exitPrice) {
    throw new Error("Exit price is required when closing a signal.");
  }

  const entryValue = parseNumericValue(signal.entry);
  const stopLossValue = parseNumericValue(signal.stopLoss);
  const targetValue = parseNumericValue(signal.target);
  const exitValue = exitPrice ? parseNumericValue(exitPrice) : null;

  if (closeReason !== "CANCELLED" && (entryValue === null || exitValue === null)) {
    throw new Error("Entry and exit prices must be numeric to close a signal.");
  }

  const pnlPercent =
    closeReason === "CANCELLED" || entryValue === null || exitValue === null
      ? undefined
      : calculatePnlPercent(signal.direction, entryValue, exitValue);
  const outcome = getOutcomeFromCloseReason(closeReason, pnlPercent);

  return {
    status: closeReason === "CANCELLED" ? "CANCELLED" : "CLOSED",
    outcome,
    exitPrice,
    exitReason: closeReason,
    pnlPercent,
    rrResult:
      closeReason === "CANCELLED" || entryValue === null || stopLossValue === null || targetValue === null || exitValue === null
        ? undefined
        : calculateRiskRewardResult(signal.direction, entryValue, stopLossValue, targetValue, exitValue),
  } satisfies Partial<Signal>;
};

const calculatePnlPercent = (
  direction: string,
  entry: number,
  exit: number
) => {
  if (entry === 0) {
    throw new Error("Entry price cannot be zero.");
  }

  const pnl =
    direction.trim().toUpperCase() === "SHORT"
      ? ((entry - exit) / entry) * 100
      : ((exit - entry) / entry) * 100;

  return Number(pnl.toFixed(2));
};

const calculateRiskRewardResult = (
  direction: string,
  entry: number,
  stopLoss: number,
  target: number,
  exit: number
) => {
  const isShort = direction.trim().toUpperCase() === "SHORT";
  const risk = isShort ? stopLoss - entry : entry - stopLoss;
  const reward = isShort ? entry - target : target - entry;
  const realizedReward = isShort ? entry - exit : exit - entry;

  if (risk <= 0 || reward <= 0) {
    return Number((realizedReward || 0).toFixed(2));
  }

  return Number((realizedReward / risk).toFixed(2));
};

const getOutcomeFromCloseReason = (
  closeReason: CloseSignalReason,
  pnlPercent?: number
): SignalOutcome => {
  if (closeReason === "TAKE_PROFIT") {
    return "WIN";
  }

  if (closeReason === "STOPPED") {
    return "LOSS";
  }

  if (closeReason === "BREAKEVEN") {
    return "BREAKEVEN";
  }

  if (closeReason === "CANCELLED") {
    return "CANCELLED";
  }

  if ((pnlPercent ?? 0) > 0) {
    return "WIN";
  }

  if ((pnlPercent ?? 0) < 0) {
    return "LOSS";
  }

  return "BREAKEVEN";
};

const isSignalClosed = (signal: Signal) =>
  signal.status === "CLOSED" || signal.status === "CANCELLED";

const normalizeUserPlan = (value: unknown): UserPlan => {
  const normalizedValue = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (userPlans.includes(normalizedValue as UserPlan)) {
    return normalizedValue as UserPlan;
  }

  return "free";
};

const normalizeUserRole = (value: unknown): UserRole => {
  return value === "admin" ? "admin" : "member";
};
