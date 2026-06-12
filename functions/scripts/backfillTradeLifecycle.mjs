import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const EXECUTION_STATUS_TO_TRADE_STATUS = {
  rejected: "rejected",
  broker_rejected: "rejected",
  failed_validation: "rejected",
  position_conflict: "rejected",
  skipped: "not_executed",
  already_open: "not_executed",
  canceled: "not_executed",
  expired: "not_executed",
  error: "error",
};

const TERMINAL_TRADE_STATUSES = new Set([
  "closed",
  "rejected",
  "not_executed",
  "error",
]);

const CLOSED_TRADE_RESULTS = new Set([
  "win",
  "loss",
  "breakeven",
]);

const writeMode = process.argv.includes("--write");

const normalizeText = (value) => (
  typeof value === "string" ? value.trim().toLowerCase() : ""
);

const getTradeStatus = (trade) => {
  const status = normalizeText(trade?.status);
  if (TERMINAL_TRADE_STATUSES.has(status) || status === "pending_execution" || status === "open") {
    return status;
  }

  const tradeResult = normalizeText(trade?.tradeResult);
  if (TERMINAL_TRADE_STATUSES.has(tradeResult) || tradeResult === "pending_execution" || tradeResult === "open") {
    return tradeResult;
  }

  const result = normalizeText(trade?.result);
  if (TERMINAL_TRADE_STATUSES.has(result) || result === "pending_execution" || result === "open") {
    return result;
  }

  if (CLOSED_TRADE_RESULTS.has(result)) {
    return "closed";
  }

  return null;
};

const buildPatch = ({ tradeStatus, executionStatus, reason }) => {
  if (tradeStatus === "rejected") {
    return {
      status: "rejected",
      tradeResult: "rejected",
      result: "rejected",
      executionStatus,
      rejectionReason: reason,
      finalizedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
  }

  if (tradeStatus === "not_executed") {
    return {
      status: "not_executed",
      tradeResult: "not_executed",
      result: "not_executed",
      executionStatus: executionStatus === "skipped" ? "not_sent" : executionStatus,
      rejectionReason: reason,
      finalizedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
  }

  return {
    status: "error",
    tradeResult: "error",
    result: "error",
    executionStatus: "error",
    rejectionReason: reason,
    finalizedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
};

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const executionStatuses = Object.keys(EXECUTION_STATUS_TO_TRADE_STATUS);
const executionSnapshot = await db
  .collection("executions")
  .where("status", "in", executionStatuses)
  .get();

let candidates = 0;
let updated = 0;
let skippedMissingTrade = 0;
let skippedAlreadyTerminal = 0;

for (const executionDocument of executionSnapshot.docs) {
  const execution = executionDocument.data();
  const mappedTradeStatus = EXECUTION_STATUS_TO_TRADE_STATUS[normalizeText(execution.status)];

  if (!mappedTradeStatus || typeof execution.tradeId !== "string" || !execution.tradeId.trim()) {
    continue;
  }

  const tradeReference = db.collection("trades").doc(execution.tradeId.trim());
  const tradeSnapshot = await tradeReference.get();

  if (!tradeSnapshot.exists) {
    skippedMissingTrade += 1;
    continue;
  }

  const trade = tradeSnapshot.data() ?? {};
  const currentTradeStatus = getTradeStatus(trade);

  if (currentTradeStatus && TERMINAL_TRADE_STATUSES.has(currentTradeStatus)) {
    skippedAlreadyTerminal += 1;
    continue;
  }

  candidates += 1;

  const reason =
    (typeof execution.reconciliationReason === "string" && execution.reconciliationReason.trim())
    || (typeof execution.errorCode === "string" && execution.errorCode.trim())
    || normalizeText(execution.status)
    || "unknown";
  const patch = buildPatch({
    tradeStatus: mappedTradeStatus,
    executionStatus: normalizeText(execution.status) || "unknown",
    reason,
  });

  if (writeMode) {
    await tradeReference.set(patch, { merge: true });
    updated += 1;
    console.log("[write]", execution.tradeId, {
      executionId: executionDocument.id,
      nextTradeStatus: mappedTradeStatus,
      reason,
    });
  } else {
    console.log("[dry-run]", execution.tradeId, {
      executionId: executionDocument.id,
      currentTradeStatus,
      nextTradeStatus: mappedTradeStatus,
      reason,
    });
  }
}

console.log("Backfill summary", {
  mode: writeMode ? "write" : "dry-run",
  executionDocumentsScanned: executionSnapshot.size,
  candidates,
  updated,
  skippedMissingTrade,
  skippedAlreadyTerminal,
});
