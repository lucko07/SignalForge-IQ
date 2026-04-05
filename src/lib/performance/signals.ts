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
import type { PerformanceSignal } from "../../types/performance";
import { isVisiblePerformanceRecord, mapPerformanceSignal } from "./records";

export const getPerformanceSignals = async (options?: {
  includeArchived?: boolean;
  includeTest?: boolean;
  includeInvalid?: boolean;
}) => {
  const snapshot = await getDocs(query(collection(db, "signals")));

  return snapshot.docs
    .map(mapPerformanceSignal)
    .filter((signal) => isVisiblePerformanceRecord(signal, options));
};

export const updateSignalFlags = async (
  signalIds: string[],
  updates: Partial<Pick<PerformanceSignal, "isArchived" | "isTest" | "isValid">>
) => {
  if (signalIds.length === 0) {
    return;
  }

  const batch = writeBatch(db);

  signalIds.forEach((signalId) => {
    batch.update(doc(db, "signals", signalId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
};

export const archiveSignals = async (signalIds: string[]) => {
  await updateSignalFlags(signalIds, { isArchived: true });
};

export const markSignalsAsTest = async (signalIds: string[], isTest: boolean) => {
  await updateSignalFlags(signalIds, { isTest });
};

export const markSignalsAsValid = async (signalIds: string[], isValid: boolean) => {
  await updateSignalFlags(signalIds, { isValid });
};

export const safeDeleteSignal = async (signalId: string) => {
  const signalReference = doc(db, "signals", signalId);
  const signalSnapshot = await getDoc(signalReference);

  if (!signalSnapshot.exists()) {
    throw new Error("Signal not found.");
  }

  if (signalSnapshot.data().isTest !== true) {
    throw new Error("Only records marked isTest=true can be safely deleted.");
  }

  await deleteDoc(signalReference);
};
