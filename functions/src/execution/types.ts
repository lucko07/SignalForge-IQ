import type { FieldValue, Timestamp } from "firebase-admin/firestore";

export type ExecutionProvider = "alpaca";
export type ExecutionMode = "paper";
export type ExecutionSizingMode = "fixed_notional";
export type ExecutionPositionSide = "long" | "short";
export type ExecutionOrderType = "market";
export type ExecutionTimeInForce = "gtc";

export type BrokerConnection = {
  provider: ExecutionProvider;
  mode: ExecutionMode;
  connected: boolean;
  lastValidatedAt: Timestamp | Date | string | null;
  paperTradingEnabled: boolean;
  createdAt?: Timestamp | Date | string | null;
  updatedAt?: Timestamp | Date | string | null;
};

export type AutomationSettings = {
  enabled: boolean;
  provider: ExecutionProvider;
  mode: ExecutionMode;
  symbolAllowlist: string[];
  longsEnabled: boolean;
  shortsEnabled: boolean;
  maxOpenPositions: number;
  maxTradesPerDay: number;
  sizingMode: ExecutionSizingMode;
  notionalUsd: number;
  killSwitch: boolean;
};

export type ExecutionStatus =
  | "queued"
  | "processing"
  | "submitted"
  | "accepted"
  | "partially_filled"
  | "filled"
  | "closed"
  | "already_closed"
  | "no_open_position"
  | "duplicate_exit"
  | "rejected"
  | "canceled"
  | "expired"
  | "duplicate"
  | "position_conflict"
  | "skipped"
  | "error";

export type NormalizedTradeRecord = {
  tradeId: string;
  signalId?: string | null;
  strategyVersion?: string | null;
  symbol?: string | null;
  timeframe?: string | null;
  side?: "long" | "short" | null;
  entryPrice?: number | null;
  stopPrice?: number | null;
  targetPrice?: number | null;
  result?: "open" | "win" | "loss" | "breakeven" | null;
  isArchived?: boolean;
  isTest?: boolean;
  isValid?: boolean;
  createdAt?: Timestamp | Date | string | null;
  updatedAt?: Timestamp | Date | string | null;
};

export type AlpacaAccount = {
  id: string;
  account_number: string;
  status: string;
  currency: string;
  buying_power: string;
  cash: string;
  portfolio_value: string;
  crypto_status?: string | null;
  trading_blocked?: boolean;
  transfers_blocked?: boolean;
  account_blocked?: boolean;
  created_at?: string;
};

export type AlpacaPosition = {
  asset_id?: string;
  symbol: string;
  exchange?: string;
  asset_class?: string;
  qty: string;
  side: string;
  market_value?: string;
  cost_basis?: string;
  unrealized_pl?: string;
  unrealized_plpc?: string;
  current_price?: string;
};

export type AlpacaOrderRequest = {
  symbol: "BTCUSD";
  side: "buy";
  type: "market";
  time_in_force: "gtc";
  notional: string;
  client_order_id: string;
};

export type AlpacaOrderResponse = {
  id: string;
  client_order_id: string;
  created_at: string;
  updated_at?: string;
  submitted_at?: string;
  filled_at?: string | null;
  expired_at?: string | null;
  canceled_at?: string | null;
  failed_at?: string | null;
  replaced_at?: string | null;
  replaced_by?: string | null;
  replaces?: string | null;
  asset_id?: string;
  symbol: string;
  asset_class?: string;
  notional?: string | null;
  qty?: string | null;
  filled_qty?: string | null;
  filled_avg_price?: string | null;
  order_class?: string;
  order_type?: string;
  type: string;
  side: string;
  time_in_force: string;
  limit_price?: string | null;
  stop_price?: string | null;
  status: string;
  extended_hours?: boolean;
};

export type ExecutionAutomationSettings = AutomationSettings;

export type ExecutionRecord = {
  tradeId: string;
  signalId: string | null;
  uid: string | null;
  provider: ExecutionProvider;
  mode: ExecutionMode;
  symbol: string;
  side: "long" | "short";
  positionSide: ExecutionPositionSide;
  orderType: ExecutionOrderType;
  timeInForce: ExecutionTimeInForce;
  qty: string | null;
  notional: string | null;
  alpacaOrderId: string | null;
  clientOrderId: string;
  status: ExecutionStatus;
  submittedAt: FieldValue | Timestamp | null;
  filledAt: Timestamp | string | null;
  canceledAt: Timestamp | string | null;
  filledQty: string | null;
  filledAvgPrice: string | null;
  rawStatus: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: FieldValue;
  updatedAt: FieldValue;
};

export type ExecutionDocument = ExecutionRecord & {
  executionId: string;
  timeframe: string | null;
  strategyVersion: string | null;
  brokerOrderStatus: string | null;
  brokerAccountId: string | null;
  brokerPositionConflict: boolean;
  automationSettings: ExecutionAutomationSettings;
  validation: {
    tradeEligible: boolean;
    reason: string | null;
    tradeResult: string | null;
    isArchived: boolean;
    isValid: boolean;
    isTest: boolean;
  };
  orderRequest: AlpacaOrderRequest | null;
  orderResponse: AlpacaOrderResponse | null;
  brokerSnapshot: {
    openPositionSymbols: string[];
  } | null;
  error: {
    code: string | null;
    message: string;
  } | null;
};
