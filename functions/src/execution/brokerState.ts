import { getPositionBySymbol } from "../lib/alpaca.js";
import type { AlpacaPosition } from "./types.js";

export type BrokerReconciliationState =
  | "no_position"
  | "same_side_open"
  | "opposite_side_open"
  | "state_mismatch";

export type FirestoreTradeState = "open" | "closed" | "unknown";

export type BrokerPositionSnapshot = {
  symbol: string;
  side: "long" | "short" | null;
  qty: string | null;
  marketValue: string | null;
  avgEntryPrice: string | null;
};

export type BrokerPositionReconciliation = {
  state: BrokerReconciliationState;
  symbol: string;
  firestoreTradeState: FirestoreTradeState;
  desiredSide: "long" | "short" | null;
  brokerPosition: AlpacaPosition | null;
  brokerSnapshot: BrokerPositionSnapshot | null;
  reason: string;
};

const normalizeSymbol = (value: unknown) => (
  typeof value === "string" ? value.trim().toUpperCase() : ""
);

const normalizeSide = (value: unknown): "long" | "short" | null => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "long" || normalized === "short") {
    return normalized;
  }

  return null;
};

const normalizeFirestoreTradeState = (value: unknown): FirestoreTradeState => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "open") {
    return "open";
  }

  if (
    normalized === "closed"
    || normalized === "win"
    || normalized === "loss"
    || normalized === "breakeven"
    || normalized === "rejected"
    || normalized === "not_executed"
    || normalized === "error"
  ) {
    return "closed";
  }

  return "unknown";
};

const toSnapshot = (position: AlpacaPosition | null): BrokerPositionSnapshot | null => {
  if (!position) {
    return null;
  }

  return {
    symbol: normalizeSymbol(position.symbol),
    side: normalizeSide(position.side),
    qty: typeof position.qty === "string" ? position.qty : null,
    marketValue: typeof position.market_value === "string" ? position.market_value : null,
    avgEntryPrice: typeof position.avg_entry_price === "string" ? position.avg_entry_price : null,
  };
};

export const findOpenPositionForSymbol = (positions: AlpacaPosition[], symbol: string) => {
  const normalizedSymbol = normalizeSymbol(symbol);
  if (!normalizedSymbol) {
    return null;
  }

  return positions.find((position) => normalizeSymbol(position.symbol) === normalizedSymbol) ?? null;
};

export const reconcileBrokerPositionState = ({
  symbol,
  desiredSide,
  firestoreTradeState,
  brokerPosition,
}: {
  symbol: string;
  desiredSide?: "long" | "short" | null;
  firestoreTradeState?: FirestoreTradeState | string | null;
  brokerPosition: AlpacaPosition | null;
}): BrokerPositionReconciliation => {
  const normalizedSymbol = normalizeSymbol(symbol);
  const normalizedDesiredSide = normalizeSide(desiredSide);
  const normalizedTradeState = normalizeFirestoreTradeState(firestoreTradeState);
  const brokerSide = normalizeSide(brokerPosition?.side);

  if (!brokerPosition) {
    return {
      state: normalizedTradeState === "open" ? "state_mismatch" : "no_position",
      symbol: normalizedSymbol,
      desiredSide: normalizedDesiredSide,
      firestoreTradeState: normalizedTradeState,
      brokerPosition: null,
      brokerSnapshot: null,
      reason: normalizedTradeState === "open"
        ? "firestore-open-but-broker-flat"
        : "broker-flat",
    };
  }

  if (normalizedDesiredSide && brokerSide && normalizedDesiredSide !== brokerSide) {
    return {
      state: "opposite_side_open",
      symbol: normalizedSymbol,
      desiredSide: normalizedDesiredSide,
      firestoreTradeState: normalizedTradeState,
      brokerPosition,
      brokerSnapshot: toSnapshot(brokerPosition),
      reason: "opposite-side-position-open",
    };
  }

  if (normalizedTradeState === "closed") {
    return {
      state: "state_mismatch",
      symbol: normalizedSymbol,
      desiredSide: normalizedDesiredSide,
      firestoreTradeState: normalizedTradeState,
      brokerPosition,
      brokerSnapshot: toSnapshot(brokerPosition),
      reason: "firestore-closed-but-broker-open",
    };
  }

  return {
    state: "same_side_open",
    symbol: normalizedSymbol,
    desiredSide: normalizedDesiredSide,
    firestoreTradeState: normalizedTradeState,
    brokerPosition,
    brokerSnapshot: toSnapshot(brokerPosition),
    reason: "same-side-position-open",
  };
};

export const fetchBrokerPositionReconciliation = async ({
  symbol,
  desiredSide,
  firestoreTradeState,
}: {
  symbol: string;
  desiredSide?: "long" | "short" | null;
  firestoreTradeState?: FirestoreTradeState | string | null;
}) => {
  const brokerPosition = await getPositionBySymbol(symbol);
  return reconcileBrokerPositionState({
    symbol,
    desiredSide,
    firestoreTradeState,
    brokerPosition,
  });
};
