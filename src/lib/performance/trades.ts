import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import type { PerformanceTrade } from "../../types/performance";
import { isVisiblePerformanceRecord, mapPerformanceTrade } from "./records";

export const getPerformanceTrades = async (options?: {
  includeArchived?: boolean;
  includeTest?: boolean;
  includeInvalid?: boolean;
}) => {
  const snapshot = await getDocs(query(collection(db, "trades")));

  return snapshot.docs
    .map(mapPerformanceTrade)
    .filter((trade) => isVisiblePerformanceRecord(trade, options));
};

export const updateTradeFlags = async (
  tradeIds: string[],
  updates: Partial<Pick<PerformanceTrade, "isArchived" | "isTest" | "isValid">>
) => {
  if (tradeIds.length === 0) {
    return;
  }

  const batch = writeBatch(db);

  tradeIds.forEach((tradeId) => {
    batch.update(doc(db, "trades", tradeId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
};

export const archiveTrades = async (tradeIds: string[]) => {
  await updateTradeFlags(tradeIds, { isArchived: true });
};

export const markTradesAsTest = async (tradeIds: string[], isTest: boolean) => {
  await updateTradeFlags(tradeIds, { isTest });
};

export const markTradesAsValid = async (tradeIds: string[], isValid: boolean) => {
  await updateTradeFlags(tradeIds, { isValid });
};

export const safeDeleteTrade = async (tradeId: string) => {
  const tradeReference = doc(db, "trades", tradeId);
  const tradeSnapshot = await getDoc(tradeReference);

  if (!tradeSnapshot.exists()) {
    throw new Error("Trade not found.");
  }

  if (tradeSnapshot.data().isTest !== true) {
    throw new Error("Only records marked isTest=true can be safely deleted.");
  }

  await deleteDoc(tradeReference);
};
