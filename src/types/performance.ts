export type TradeSide = "long" | "short";
export type TradeResult = "win" | "loss" | "breakeven" | "open";

export type PerformanceSignal = {
  id: string;
  signalId: string;
  strategyVersion: string;
  symbol: string;
  timeframe: string;
  side: TradeSide;
  signalTime: unknown;
  entryPrice: number | null;
  stopPrice: number | null;
  targetPrice: number | null;
  riskPerShare: number | null;
  rrPlanned: number | null;
  status: string;
  source: string;
  isArchived: boolean;
  isTest: boolean;
  isValid: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type PerformanceTrade = {
  id: string;
  tradeId: string;
  signalId: string;
  strategyVersion: string;
  symbol: string;
  timeframe: string;
  side: TradeSide;
  entryTime: unknown;
  entryPrice: number | null;
  exitTime: unknown | null;
  exitPrice: number | null;
  stopPrice: number | null;
  targetPrice: number | null;
  riskPerShare: number | null;
  rewardPerShare: number | null;
  rrPlanned: number | null;
  rrActual: number | null;
  pnlDollar: number | null;
  pnlPercent: number | null;
  result: TradeResult;
  fees: number;
  slippage: number;
  marketSession: string;
  dayOfWeek: string;
  entryHourNY: number | null;
  setupType: string;
  emaFilterPassed: boolean;
  antiChasePassed: boolean;
  isManualReview: boolean;
  notes: string;
  isArchived: boolean;
  isTest: boolean;
  isValid: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type PerformanceSummaryRecord = {
  strategyVersion: string;
  totalTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  openTrades: number;
  winRate: number;
  netR: number;
  avgR: number;
  profitFactor: number;
  expectancy: number;
  maxDrawdownR: number;
  currentStreak: number;
  bestStreak: number;
  worstStreak: number;
  lastUpdated?: unknown;
};

export type PerformanceFilters = {
  search: string;
  symbol: string;
  side: "all" | TradeSide;
  result: "all" | TradeResult;
  strategyVersion: string;
  dateFrom: string;
  dateTo: string;
  includeArchived: boolean;
  includeTest: boolean;
  includeInvalid: boolean;
};

export type SortDirection = "asc" | "desc";

export type TradeSortKey =
  | "symbol"
  | "strategyVersion"
  | "timeframe"
  | "side"
  | "result"
  | "rrActual"
  | "pnlPercent"
  | "entryPrice"
  | "exitPrice"
  | "entryTime"
  | "exitTime";

export type AnalyticsRow = {
  label: string;
  totalTrades: number;
  closedTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;
  netR: number;
  avgR: number;
  profitFactor: number;
};

export type ChartPoint = {
  label: string;
  value: number;
};

export type EquityCurvePoint = ChartPoint & {
  cumulativeR: number;
};
