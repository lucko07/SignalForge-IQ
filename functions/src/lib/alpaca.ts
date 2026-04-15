import type {
  AlpacaAccount,
  AlpacaOrderRequest,
  AlpacaOrderResponse,
  AlpacaPosition,
} from "../execution/types.js";

const DEFAULT_PAPER_BASE_URL = "https://paper-api.alpaca.markets";
const PAPER_HOSTNAME = "paper-api.alpaca.markets";

type AlpacaRequestOptions = {
  method?: "GET" | "POST";
  path: string;
  body?: Record<string, unknown> | null;
};

type AlpacaErrorDetails = {
  status: number;
  code: string | null;
  payload: unknown;
};

export class AlpacaApiError extends Error {
  public readonly details: AlpacaErrorDetails;

  constructor(message: string, details: AlpacaErrorDetails) {
    super(message);
    this.name = "AlpacaApiError";
    this.details = details;
  }
}

const requireEnv = (name: string) => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required server configuration for ${name}.`);
  }

  return value;
};

const getPaperBaseUrl = () => {
  const configuredValue = process.env.ALPACA_PAPER_BASE_URL?.trim()
    || process.env.ALPACA_BASE_URL?.trim()
    || DEFAULT_PAPER_BASE_URL;
  const parsed = new URL(configuredValue);

  if (parsed.hostname !== PAPER_HOSTNAME) {
    throw new Error("Alpaca execution is restricted to the paper trading environment.");
  }

  return parsed.origin;
};

const getAuthHeaders = () => ({
  "APCA-API-KEY-ID": requireEnv("ALPACA_API_KEY"),
  "APCA-API-SECRET-KEY": requireEnv("ALPACA_SECRET_KEY"),
});

const parseJsonSafely = async (response: Response) => {
  const responseText = await response.text();

  if (!responseText) {
    return null;
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return responseText;
  }
};

const requestAlpaca = async <T>({
  method = "GET",
  path,
  body = null,
}: AlpacaRequestOptions): Promise<T> => {
  const url = `${getPaperBaseUrl()}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await parseJsonSafely(response);

  if (!response.ok) {
    const code = typeof payload === "object" && payload !== null && "code" in payload
      ? String(payload.code)
      : null;
    const message = typeof payload === "object" && payload !== null && "message" in payload
      ? String(payload.message)
      : `Alpaca API request failed with status ${response.status}.`;
    throw new AlpacaApiError(message, {
      status: response.status,
      code,
      payload,
    });
  }

  return payload as T;
};

export const getAccount = async (): Promise<AlpacaAccount> => requestAlpaca<AlpacaAccount>({
  path: "/v2/account",
});

export const getOpenPositions = async (): Promise<AlpacaPosition[]> => requestAlpaca<AlpacaPosition[]>({
  path: "/v2/positions",
});

export const createOrder = async (
  orderRequest: AlpacaOrderRequest
): Promise<AlpacaOrderResponse> => requestAlpaca<AlpacaOrderResponse>({
  method: "POST",
  path: "/v2/orders",
  body: orderRequest,
});

export const getOrderById = async (orderId: string): Promise<AlpacaOrderResponse> => {
  const normalizedOrderId = orderId.trim();

  if (!normalizedOrderId) {
    throw new Error("orderId is required.");
  }

  return requestAlpaca<AlpacaOrderResponse>({
    path: `/v2/orders/${encodeURIComponent(normalizedOrderId)}`,
  });
};
