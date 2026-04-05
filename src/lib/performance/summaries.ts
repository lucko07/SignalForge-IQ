import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import type { PerformanceSummaryRecord, PerformanceTrade } from "../../types/performance";
import { buildAnalyticsRows, buildDailyNetR, buildEquityCurve, buildPerformanceSummary } from "./metrics";

const performanceSummaryCollection = collection(db, "performance_summary");

const sanitizeStrategyVersionKey = (value: string) => (
  value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-") || "overall"
);

export const getStoredPerformanceSummaries = async () => {
  const snapshot = await getDocs(query(performanceSummaryCollection));

  return snapshot.docs.map((documentSnapshot) => ({
    ...(documentSnapshot.data() as PerformanceSummaryRecord),
    strategyVersion: String(documentSnapshot.data().strategyVersion ?? documentSnapshot.id),
    lastUpdated: documentSnapshot.data().lastUpdated,
  }));
};

export const buildPerformanceSnapshot = (trades: PerformanceTrade[]) => {
  const overall = buildPerformanceSummary(trades, "overall");
  const strategyVersions = [...new Set(trades.map((trade) => trade.strategyVersion).filter(Boolean))];
  const summaries = [
    overall,
    ...strategyVersions.map((strategyVersion) => buildPerformanceSummary(
      trades.filter((trade) => trade.strategyVersion === strategyVersion),
      strategyVersion
    )),
  ];

  return {
    summaries,
    equityCurve: buildEquityCurve(trades),
    dailyNetR: buildDailyNetR(trades),
    bySymbol: buildAnalyticsRows(trades, (trade) => trade.symbol || "Unknown"),
    byDayOfWeek: buildAnalyticsRows(trades, (trade) => trade.dayOfWeek || "Unknown"),
    byEntryHour: buildAnalyticsRows(
      trades,
      (trade) => (trade.entryHourNY === null ? "Unknown" : `${trade.entryHourNY}:00 NY`)
    ),
    byStrategyVersion: buildAnalyticsRows(trades, (trade) => trade.strategyVersion || "legacy"),
  };
};

export const rebuildPerformanceSummaries = async (trades: PerformanceTrade[]) => {
  const { summaries } = buildPerformanceSnapshot(trades);

  await Promise.all(summaries.map((summary) => setDoc(
    doc(db, "performance_summary", sanitizeStrategyVersionKey(summary.strategyVersion)),
    {
      ...summary,
      lastUpdated: serverTimestamp(),
    },
    { merge: true }
  )));

  return summaries;
};
