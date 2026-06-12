import type { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { CanonicalTradeStatus, TradeLifecycleResult } from "../tradeLifecycle.js";

export type ExecutionProvider = "alpaca" | "kraken";
export type ExecutionMode = "paper" | "live";
export type ExecutionSizingMode = "fixed_notional";
export type ExecutionPositionSide = "long" | "short";
export type ExecutionOrderType = "market";
export type ExecutionTimeInForce = "gtc";
export type ExecutionProtectionStatus =
  | "active"
  | "failed"
  | "completed"
  | "missing_orders";

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
  allowUnprotectedMarketEntry: boolean;
};

export type ExecutionStatus =
  | "queued"
  | "processing"
  | "submitted"
  | "accepted"
  | "partially_filled"
  | "filled"
  | "already_open"
  | "closed"
  | "already_closed"
  | "no_open_position"
  | "no_position_to_close"
  | "duplicate_exit"
  | "duplicate_event"
  | "rejected"
  | "broker_rejected"
  | "failed_validation"
  | "canceled"
  | "expired"
  | "duplicate"
  | "position_conflict"
  | "protection_failed"
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
  result?: TradeLifecycleResult | null;
  status?: CanonicalTradeStatus | null;
  tradeResult?: CanonicalTradeStatus | "closed" | null;
  executionStatus?: string | null;
  rejectionReason?: string | null;
  finalizedAt?: FieldValue | Timestamp | Date | string | null;
  isArchived?: boolean;
  isTest?: boolean;
  isValid?: boolean;
  createdAt?: Timestamp | Date | string | null;
  updatedAt?: Timestamp | Date | string | null;
  executionProvider?: ExecutionProvider | null;
  executionMode?: ExecutionMode | null;
  brokerVenue?: string | null;
  brokerPair?: string | null;
  brokerAccountType?: "paper" | "live" | null;
  marginEnabled?: boolean | null;
  leverage?: number | null;
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
  avg_entry_price?: string;
  current_price?: string;
};

export type AlpacaOrderRequest = {
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop" | "stop_limit";
  time_in_force: "gtc";
  notional?: string;
  qty?: string;
  client_order_id: string;
  limit_price?: string;
  stop_price?: string;
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
  orderClass: "simple";
  takeProfitPrice: number | null;
  stopLossPrice: number | null;
  protectionStatus: ExecutionProtectionStatus | null;
  protectionMode: "synthetic_oco" | null;
  protectionActivatedAt: FieldValue | Timestamp | Date | string | null;
  protectionFailedAt: FieldValue | Timestamp | Date | string | null;
  protectionError: string | null;
  qty: string | null;
  notional: string | null;
  alpacaOrderId: string | null;
  brokerOrderId?: string | null;
  brokerVenue?: string | null;
  brokerPair?: string | null;
  brokerAccountType?: "paper" | "live" | null;
  marginEnabled?: boolean | null;
  leverage?: number | null;
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
  brokerReconciliationState?: "no_position" | "same_side_open" | "opposite_side_open" | "state_mismatch" | null;
  reconciliationReason?: string | null;
  noOp?: boolean;
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
  stopOrderId: string | null;
  takeProfitOrderId: string | null;
  brokerSnapshot: {
    openPositionSymbols: string[];
  } | null;
  error: {
    code: string | null;
    message: string;
  } | null;
};
