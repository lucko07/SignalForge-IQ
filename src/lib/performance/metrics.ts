import type {
  AnalyticsRow,
  ChartPoint,
  EquityCurvePoint,
  PerformanceSummaryRecord,
  PerformanceTrade,
} from "../../types/performance";

const roundMetric = (value: number) => Number(value.toFixed(2));

const isClosedTrade = (trade: PerformanceTrade) => trade.result !== "open";

const sortTradesChronologically = (trades: PerformanceTrade[]) => (
  [...trades].sort((left, right) => getTradeSortTimestamp(left) - getTradeSortTimestamp(right))
);

const getTradeSortTimestamp = (trade: PerformanceTrade) => {
  const exitTimestamp = toMillis(trade.exitTime);
  const entryTimestamp = toMillis(trade.entryTime);
  const createdTimestamp = toMillis(trade.createdAt);

  return exitTimestamp ?? entryTimestamp ?? createdTimestamp ?? 0;
};

export const toMillis = (value: unknown) => {
  if (!value) {
    return null;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate().getTime();
  }

  const parsedDate = value instanceof Date ? value : new Date(String(value));

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.getTime();
};

export const formatDateLabel = (value: unknown, fallback = "Unknown") => {
  const millis = toMillis(value);

  if (millis === null) {
    return fallback;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(millis));
};

export const formatDateKey = (value: unknown) => {
  const millis = toMillis(value);

  if (millis === null) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(millis));
};

export const buildPerformanceSummary = (
  trades: PerformanceTrade[],
  strategyVersion = "overall"
): PerformanceSummaryRecord => {
  const closedTrades = trades.filter(isClosedTrade);
  const openTrades = trades.length - closedTrades.length;
  const wins = closedTrades.filter((trade) => trade.result === "win").length;
  const losses = closedTrades.filter((trade) => trade.result === "loss").length;
  const breakevens = closedTrades.filter((trade) => trade.result === "breakeven").length;
  const positiveR = closedTrades
    .map((trade) => trade.rrActual ?? 0)
    .filter((value) => value > 0);
  const negativeR = closedTrades
    .map((trade) => trade.rrActual ?? 0)
    .filter((value) => value < 0);
  const totalPositiveR = positiveR.reduce((sum, value) => sum + value, 0);
  const totalNegativeR = negativeR.reduce((sum, value) => sum + value, 0);
  const netR = closedTrades.reduce((sum, trade) => sum + (trade.rrActual ?? 0), 0);
  const avgR = closedTrades.length > 0 ? netR / closedTrades.length : 0;
  const avgWinR = positiveR.length > 0 ? totalPositiveR / positiveR.length : 0;
  const avgLossR = negativeR.length > 0 ? Math.abs(totalNegativeR / negativeR.length) : 0;
  const winRateDecimal = closedTrades.length > 0 ? wins / closedTrades.length : 0;
  const lossRateDecimal = closedTrades.length > 0 ? losses / closedTrades.length : 0;
  const expectancy = (winRateDecimal * avgWinR) - (lossRateDecimal * avgLossR);
  const profitFactor = totalNegativeR === 0
    ? totalPositiveR
    : totalPositiveR / Math.abs(totalNegativeR);
  const streaks = calculateStreaks(closedTrades);

  return {
    strategyVersion,
    totalTrades: trades.length,
    wins,
    losses,
    breakevens,
    openTrades,
    winRate: roundMetric(winRateDecimal * 100),
    netR: roundMetric(netR),
    avgR: roundMetric(avgR),
    profitFactor: roundMetric(profitFactor || 0),
    expectancy: roundMetric(expectancy),
    maxDrawdownR: roundMetric(calculateMaxDrawdownR(closedTrades)),
    currentStreak: streaks.currentStreak,
    bestStreak: streaks.bestStreak,
    worstStreak: streaks.worstStreak,
  };
};

export const buildEquityCurve = (trades: PerformanceTrade[]): EquityCurvePoint[] => {
  let cumulativeR = 0;

  return sortTradesChronologically(trades.filter(isClosedTrade)).map((trade, index) => {
    cumulativeR += trade.rrActual ?? 0;

    return {
      label: formatDateLabel(trade.exitTime ?? trade.entryTime, `Trade ${index + 1}`),
      value: roundMetric(cumulativeR),
      cumulativeR: roundMetric(cumulativeR),
    };
  });
};

export const buildDailyNetR = (trades: PerformanceTrade[]): ChartPoint[] => {
  const dailyMap = new Map<string, number>();

  trades.filter(isClosedTrade).forEach((trade) => {
    const dateKey = formatDateKey(trade.exitTime ?? trade.entryTime);
    dailyMap.set(dateKey, (dailyMap.get(dateKey) ?? 0) + (trade.rrActual ?? 0));
  });

  return [...dailyMap.entries()]
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([label, value]) => ({
      label,
      value: roundMetric(value),
    }));
};

export const buildAnalyticsRows = (
  trades: PerformanceTrade[],
  accessor: (trade: PerformanceTrade) => string
): AnalyticsRow[] => {
  const grouped = new Map<string, PerformanceTrade[]>();

  trades.forEach((trade) => {
    const label = accessor(trade) || "Unknown";
    grouped.set(label, [...(grouped.get(label) ?? []), trade]);
  });

  return [...grouped.entries()]
    .map(([label, groupTrades]) => {
      const summary = buildPerformanceSummary(groupTrades, label);
      const closedTrades = groupTrades.filter(isClosedTrade).length;

      return {
        label,
        totalTrades: groupTrades.length,
        closedTrades,
        wins: summary.wins,
        losses: summary.losses,
        breakevens: summary.breakevens,
        winRate: summary.winRate,
        netR: summary.netR,
        avgR: summary.avgR,
        profitFactor: summary.profitFactor,
      };
    })
    .sort((left, right) => right.netR - left.netR);
};

export const calculateMaxDrawdownR = (trades: PerformanceTrade[]) => {
  let cumulativeR = 0;
  let peakR = 0;
  let maxDrawdown = 0;

  sortTradesChronologically(trades.filter(isClosedTrade)).forEach((trade) => {
    cumulativeR += trade.rrActual ?? 0;
    peakR = Math.max(peakR, cumulativeR);
    maxDrawdown = Math.max(maxDrawdown, peakR - cumulativeR);
  });

  return maxDrawdown;
};

export const calculateStreaks = (trades: PerformanceTrade[]) => {
  let currentStreak = 0;
  let bestStreak = 0;
  let worstStreak = 0;

  sortTradesChronologically(trades).forEach((trade) => {
    if (trade.result === "win") {
      currentStreak = currentStreak >= 0 ? currentStreak + 1 : 1;
    } else if (trade.result === "loss") {
      currentStreak = currentStreak <= 0 ? currentStreak - 1 : -1;
    } else {
      currentStreak = 0;
    }

    bestStreak = Math.max(bestStreak, currentStreak);
    worstStreak = Math.min(worstStreak, currentStreak);
  });

  return { currentStreak, bestStreak, worstStreak };
};
