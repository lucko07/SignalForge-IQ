import type { Firestore } from "firebase-admin/firestore";
import type {
  ExecutionAutomationSettings,
  ExecutionStatus,
  NormalizedTradeRecord,
} from "../../types.js";

export const KRAKEN_BROKER_VENUE = "kraken";
export const KRAKEN_PAPER_PAIR = "BTC/USD";
export const KRAKEN_PAPER_SYMBOL = "BTCUSD";
export const KRAKEN_PAPER_DEFAULT_NOTIONAL_USD = 25;

export type KrakenPaperSide = "long" | "short";
export type KrakenPaperCloseScenario = "stop" | "take_profit" | "manual_flat";

export type KrakenPaperExecutionInput = {
  db: Firestore;
  trade: NormalizedTradeRecord;
  automationSettings: ExecutionAutomationSettings;
  executionUid?: string | null;
  accessContext?: "automation" | "admin-paper-test";
};

export type KrakenPaperExecutionResult =
  | { status: "submitted"; executionId: string; orderId: string; clientOrderId: string }
  | { status: "rejected"; executionId: string; reason: string }
  | { status: "duplicate"; executionId: string; reason: string }
  | { status: "skipped"; executionId?: string; reason: string }
  | { status: "error"; executionId?: string; reason: string };

export type KrakenPaperOrderIds = {
  brokerOrderId: string;
  stopOrderId: string;
  takeProfitOrderId: string;
};

export type KrakenPaperCloseResult = {
  tradeId: string;
  executionId: string;
  status: ExecutionStatus;
  protectionStatus: "completed";
  exitPrice: number;
  result: "win" | "loss" | "breakeven";
  canceledOrderId: string | null;
  exitOrderId: string | null;
  pnlDollar: number;
  pnlPercent: number;
  rrActual: number | null;
};
