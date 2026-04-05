import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_ALGORITHM = "sha256";
const SIGNATURE_PREFIX = `${SIGNATURE_ALGORITHM}=`;

export type SignedPayload = {
  rawBody: string;
  signature: string;
};

const toPayloadString = (payload: unknown) =>
  typeof payload === "string" ? payload : JSON.stringify(payload);

export const signWebhookPayload = (payload: unknown, secret: string): SignedPayload => {
  const normalizedSecret = secret.trim();

  if (!normalizedSecret) {
    throw new Error("Webhook signing secret is required.");
  }

  const rawBody = toPayloadString(payload);
  const digest = createHmac(SIGNATURE_ALGORITHM, normalizedSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  return {
    rawBody,
    signature: `${SIGNATURE_PREFIX}${digest}`,
  };
};

export const buildWebhookSignatureHeaders = (
  payload: unknown,
  secret: string,
  timestamp = Date.now()
) => {
  const { rawBody, signature } = signWebhookPayload(payload, secret);

  return {
    rawBody,
    headers: {
      "content-type": "application/json",
      "x-signal-timestamp": String(timestamp),
      "x-signal-signature": signature,
    },
  };
};

export const verifyWebhookSignature = (
  payload: unknown,
  providedSignature: string | null | undefined,
  secret: string
) => {
  if (!providedSignature) {
    return false;
  }

  const expectedSignature = signWebhookPayload(payload, secret).signature;
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const providedBuffer = Buffer.from(providedSignature.trim(), "utf8");

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
};
