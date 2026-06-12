import { createHash, createHmac } from "node:crypto";

const KRAKEN_REST_BASE_URL = "https://api.kraken.com";

type KrakenPrivateMethod = "Balance" | "OpenOrders" | "TradeBalance";
type KrakenPublicMethod = "Time";

type KrakenResponse<T> = {
  error?: string[];
  result?: T;
};

export type KrakenBalanceResult = Record<string, string>;

export type KrakenOpenOrdersResult = {
  open?: Record<string, unknown>;
};

export type KrakenTradeBalanceResult = Record<string, string>;

export type KrakenServerTimeResult = {
  unixtime?: number;
  rfc1123?: string;
};

export type KrakenReadOnlyErrorCategory =
  | "invalid_signature"
  | "invalid_nonce"
  | "missing_permissions"
  | "network_failure"
  | "kraken_api_error"
  | "configuration_error"
  | "unexpected_response";

export class KrakenReadOnlyClientError extends Error {
  readonly category: KrakenReadOnlyErrorCategory;
  readonly krakenErrors: string[];

  constructor(
    category: KrakenReadOnlyErrorCategory,
    message: string,
    krakenErrors: string[] = []
  ) {
    super(message);
    this.name = "KrakenReadOnlyClientError";
    this.category = category;
    this.krakenErrors = krakenErrors;
  }
}

export type KrakenReadOnlyClientConfig = {
  apiKey: string;
  apiSecret: string;
  baseUrl?: string;
};

export class KrakenReadOnlyClient {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly baseUrl: string;

  constructor({ apiKey, apiSecret, baseUrl = KRAKEN_REST_BASE_URL }: KrakenReadOnlyClientConfig) {
    this.apiKey = apiKey.trim();
    this.apiSecret = apiSecret.trim();
    this.baseUrl = baseUrl;

    if (!this.apiKey || !this.apiSecret) {
      throw new KrakenReadOnlyClientError(
        "configuration_error",
        "Kraken read-only API credentials are not configured."
      );
    }
  }

  getAccountBalance() {
    return this.privateRequest<KrakenBalanceResult>("Balance");
  }

  getOpenOrders() {
    return this.privateRequest<KrakenOpenOrdersResult>("OpenOrders");
  }

  getTradeBalance(asset = "ZUSD") {
    return this.privateRequest<KrakenTradeBalanceResult>("TradeBalance", { asset });
  }

  getServerTime() {
    return this.publicRequest<KrakenServerTimeResult>("Time");
  }

  private async publicRequest<T>(method: KrakenPublicMethod): Promise<T> {
    const path = `/0/public/${method}`;
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: "GET",
        headers: {
          "User-Agent": "SignalForgeIQ-KrakenReadOnly/1.0",
        },
      });
    } catch (error) {
      throw new KrakenReadOnlyClientError(
        "network_failure",
        error instanceof Error ? error.message : "Kraken network request failed."
      );
    }

    return parseKrakenResponse<T>(response, "Kraken public read-only request");
  }

  private async privateRequest<T>(
    method: KrakenPrivateMethod,
    params: Record<string, string | number> = {}
  ): Promise<T> {
    const path = `/0/private/${method}`;
    const nonce = createNonce();
    const form = new URLSearchParams({
      nonce,
      ...Object.fromEntries(
        Object.entries(params).map(([key, value]) => [key, String(value)])
      ),
    });
    const body = form.toString();
    const signature = signKrakenPrivateRequest({
      path,
      nonce,
      body,
      apiSecret: this.apiSecret,
    });

    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: {
          "API-Key": this.apiKey,
          "API-Sign": signature,
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "SignalForgeIQ-KrakenReadOnly/1.0",
        },
        body,
      });
    } catch (error) {
      throw new KrakenReadOnlyClientError(
        "network_failure",
        error instanceof Error ? error.message : "Kraken network request failed."
      );
    }

    return parseKrakenResponse<T>(response, "Kraken read-only request");
  }
}

export const createKrakenReadOnlyClient = (config: KrakenReadOnlyClientConfig) => (
  new KrakenReadOnlyClient(config)
);

const createNonce = () => {
  const highResolution = process.hrtime.bigint().toString().slice(-6);
  return `${Date.now()}${highResolution}`;
};

const signKrakenPrivateRequest = ({
  path,
  nonce,
  body,
  apiSecret,
}: {
  path: string;
  nonce: string;
  body: string;
  apiSecret: string;
}) => {
  const encodedSecret = Buffer.from(apiSecret, "base64");
  const messageHash = createHash("sha256")
    .update(`${nonce}${body}`)
    .digest();

  return createHmac("sha512", encodedSecret)
    .update(Buffer.concat([Buffer.from(path), messageHash]))
    .digest("base64");
};

const parseKrakenResponse = async <T>(
  response: Response,
  requestLabel: string
): Promise<T> => {
  let payload: KrakenResponse<T>;

  try {
    payload = await response.json() as KrakenResponse<T>;
  } catch {
    throw new KrakenReadOnlyClientError(
      "unexpected_response",
      `Kraken returned a non-JSON response with status ${response.status}.`
    );
  }

  const krakenErrors = Array.isArray(payload.error)
    ? payload.error.filter((item) => item.trim() !== "")
    : [];

  if (!response.ok || krakenErrors.length > 0) {
    throw new KrakenReadOnlyClientError(
      classifyKrakenErrors(krakenErrors, response.status),
      krakenErrors.length > 0
        ? `${requestLabel} was rejected.`
        : `${requestLabel} failed with status ${response.status}.`,
      krakenErrors
    );
  }

  if (payload.result === undefined || payload.result === null) {
    throw new KrakenReadOnlyClientError(
      "unexpected_response",
      `${requestLabel} response did not include a result.`
    );
  }

  return payload.result;
};

const classifyKrakenErrors = (
  errors: string[],
  status: number
): KrakenReadOnlyErrorCategory => {
  const normalized = errors.join(" ").toLowerCase();

  if (normalized.includes("invalid signature")) {
    return "invalid_signature";
  }

  if (normalized.includes("invalid nonce")) {
    return "invalid_nonce";
  }

  if (
    normalized.includes("permission")
    || normalized.includes("invalid key")
    || normalized.includes("key expired")
  ) {
    return "missing_permissions";
  }

  if (status >= 500) {
    return "network_failure";
  }

  return "kraken_api_error";
};
