import { FieldValue, Timestamp, type DocumentData, type DocumentReference, type Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { TRADES_COLLECTION_NAME } from "./tradeSync.js";

type TradeSide = "long" | "short";
type TradeResult = "open" | "win" | "loss" | "breakeven";

type CloseTradeParams = {
  db: Firestore;
  tradeId?: string;
  signalId?: string;
  exitPrice: number | string;
  exitTime: Timestamp | Date | string;
  closeReason?: string | null;
};

type CloseComputation = {
  exitPrice: number;
  exitTime: Timestamp;
  rrActual: number;
  pnlPercent: number;
  pnlDollar: number | null;
  result: Exclude<TradeResult, "open">;
  closeReason: string;
  quantity: number | null;
  pnlPerShare: number;
};

const toTrimmedText = (value: unknown) => {
  if (typeof value === "string") {
    let cleaned = value.trim();

    while (cleaned.length >= 2 && cleaned.startsWith("\"") && cleaned.endsWith("\"")) {
      cleaned = cleaned.slice(1, -1).trim();
    }

    while (cleaned.length >= 2 && cleaned.startsWith("'") && cleaned.endsWith("'")) {
      cleaned = cleaned.slice(1, -1).trim();
    }

    return cleaned || null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
};

const toNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const textValue = toTrimmedText(value);

  if (!textValue) {
    return null;
  }

  const parsedValue = Number(textValue.replace(/,/g, ""));
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const toTimestamp = (value: unknown) => {
  if (value instanceof Timestamp) {
    return value;
  }

  if (value instanceof Date) {
    return Timestamp.fromDate(value);
  }

  const textValue = toTrimmedText(value);

  if (!textValue) {
    return null;
  }

  const parsedDate = new Date(textValue);
  return Number.isNaN(parsedDate.getTime()) ? null : Timestamp.fromDate(parsedDate);
};

const roundTo = (value: number, decimals: number) => Number(value.toFixed(decimals));

const classifyTradeResult = (
  side: TradeSide,
  exitPrice: number,
  stopPrice: number,
  targetPrice: number
): Exclude<TradeResult, "open"> => {
  if (side === "long") {
    if (exitPrice >= targetPrice) {
      return "win";
    }

    if (exitPrice <= stopPrice) {
      return "loss";
    }

    return "breakeven";
  }

  if (exitPrice <= targetPrice) {
    return "win";
  }

  if (exitPrice >= stopPrice) {
    return "loss";
  }

  return "breakeven";
};

const buildCloseComputation = (
  tradeId: string,
  tradeData: DocumentData,
  exitPriceInput: unknown,
  exitTimeInput: unknown,
  closeReasonInput: unknown
): CloseComputation => {
  const side = tradeData.side as TradeSide | undefined;
  const entryPrice = toNumber(tradeData.entryPrice);
  const stopPrice = toNumber(tradeData.stopPrice);
  const targetPrice = toNumber(tradeData.targetPrice);
  const riskPerShare = toNumber(tradeData.riskPerShare);
  const exitPrice = toNumber(exitPriceInput);
  const exitTime = toTimestamp(exitTimeInput);
  const quantity = toNumber(tradeData.quantity ?? tradeData.shares);
  const closeReason = toTrimmedText(closeReasonInput) ?? "";

  if (side !== "long" && side !== "short") {
    throw new Error(`Trade ${tradeId} is missing a valid side.`);
  }

  if (entryPrice === null || stopPrice === null || targetPrice === null || riskPerShare === null) {
    throw new Error(`Trade ${tradeId} is missing required pricing fields.`);
  }

  if (exitPrice === null) {
    throw new Error("A valid exitPrice is required to close a trade.");
  }

  if (!exitTime) {
    throw new Error("A valid exitTime is required to close a trade.");
  }

  if (riskPerShare <= 0) {
    throw new Error(`Trade ${tradeId} has invalid riskPerShare.`);
  }

  if (entryPrice <= 0) {
    throw new Error(`Trade ${tradeId} has invalid entryPrice.`);
  }

  const pnlPerShare = side === "short"
    ? entryPrice - exitPrice
    : exitPrice - entryPrice;
  const rrActual = roundTo(pnlPerShare / riskPerShare, 2);
  const pnlPercent = roundTo((pnlPerShare / entryPrice) * 100, 2);
  const pnlDollar = quantity !== null ? roundTo(pnlPerShare * quantity, 2) : null;
  const result = classifyTradeResult(side, exitPrice, stopPrice, targetPrice);

  return {
    exitPrice,
    exitTime,
    rrActual,
    pnlPercent,
    pnlDollar,
    result,
    closeReason,
    quantity,
    pnlPerShare: roundTo(pnlPerShare, 4),
  };
};

const findTradeReference = async (
  db: Firestore,
  tradeId?: string,
  signalId?: string
): Promise<DocumentReference<DocumentData> | null> => {
  const tradesCollection = db.collection(TRADES_COLLECTION_NAME);
  const trimmedTradeId = toTrimmedText(tradeId);
  const trimmedSignalId = toTrimmedText(signalId);

  if (trimmedTradeId) {
    const directReference = tradesCollection.doc(trimmedTradeId);
    const directSnapshot = await directReference.get();

    if (directSnapshot.exists) {
      return directReference;
    }

    const tradeIdQuery = await tradesCollection.where("tradeId", "==", trimmedTradeId).limit(1).get();

    if (!tradeIdQuery.empty) {
      return tradeIdQuery.docs[0].ref;
    }
  }

  if (trimmedSignalId) {
    const directReference = tradesCollection.doc(trimmedSignalId);
    const directSnapshot = await directReference.get();

    if (directSnapshot.exists) {
      return directReference;
    }

    const signalIdQuery = await tradesCollection.where("signalId", "==", trimmedSignalId).limit(1).get();

    if (!signalIdQuery.empty) {
      return signalIdQuery.docs[0].ref;
    }
  }

  return null;
};

export const closeTrade = async ({
  db,
  tradeId,
  signalId,
  exitPrice,
  exitTime,
  closeReason,
}: CloseTradeParams) => {
  const tradeReference = await findTradeReference(db, tradeId, signalId);
  const requestedTradeId = toTrimmedText(tradeId);
  const requestedSignalId = toTrimmedText(signalId);

  if (!tradeReference) {
    logger.warn("Trade close skipped because trade was not found.", {
      tradeId: requestedTradeId,
      signalId: requestedSignalId,
    });
    return { status: "not-found" as const };
  }

  const result = await db.runTransaction(async (transaction) => {
    const tradeSnapshot = await transaction.get(tradeReference);

    if (!tradeSnapshot.exists) {
      logger.warn("Trade close skipped because trade was not found during transaction.", {
        tradeId: tradeReference.id,
        signalId: requestedSignalId,
      });
      return { status: "not-found" as const };
    }

    const tradeData = tradeSnapshot.data() as DocumentData;

    if (tradeData.result !== "open") {
      logger.info("Trade close skipped because trade is already closed.", {
        tradeId: tradeReference.id,
        signalId: tradeData.signalId ?? requestedSignalId,
        currentResult: tradeData.result ?? null,
      });
      return {
        status: "already-closed" as const,
        tradeId: tradeReference.id,
        result: tradeData.result ?? null,
      };
    }

    const computation = buildCloseComputation(
      tradeReference.id,
      tradeData,
      exitPrice,
      exitTime,
      closeReason
    );

    logger.info("Trade close computed result summary.", {
      tradeId: tradeReference.id,
      signalId: tradeData.signalId ?? requestedSignalId,
      side: tradeData.side ?? null,
      entryPrice: tradeData.entryPrice ?? null,
      exitPrice: computation.exitPrice,
      riskPerShare: tradeData.riskPerShare ?? null,
      pnlPerShare: computation.pnlPerShare,
      rrActual: computation.rrActual,
      pnlPercent: computation.pnlPercent,
      pnlDollar: computation.pnlDollar,
      quantity: computation.quantity,
      result: computation.result,
      closeReason: computation.closeReason || null,
    });

    transaction.update(tradeReference, {
      exitPrice: computation.exitPrice,
      exitTime: computation.exitTime,
      rrActual: computation.rrActual,
      pnlPercent: computation.pnlPercent,
      pnlDollar: computation.pnlDollar,
      result: computation.result,
      status: "closed",
      closeReason: computation.closeReason,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      status: "closed" as const,
      tradeId: tradeReference.id,
      signalId: tradeData.signalId ?? requestedSignalId,
      result: computation.result,
      rrActual: computation.rrActual,
      pnlPercent: computation.pnlPercent,
      pnlDollar: computation.pnlDollar,
    };
  });

  if (result.status === "closed") {
    logger.info("Trade closed successfully.", result);
  }

  return result;
};
