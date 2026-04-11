import { FieldValue, Timestamp, type DocumentData, type DocumentReference } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { getDeliveryPolicy, getNextRetryDelaySeconds, type DeliveryPlan } from "./deliveryPolicy.js";
import { buildWebhookSignatureHeaders } from "./signature.js";

const MAX_CAPTURED_RESPONSE_CHARS = 500;

export type WebhookDeliveryStatus =
  | "pending"
  | "sending"
  | "retry_scheduled"
  | "delivered"
  | "failed";

export type WebhookDeliveryRecord = {
  subscriberId?: string | null;
  signalId?: string | null;
  destinationUrl?: string | null;
  plan?: DeliveryPlan | string | null;
  signingSecret?: string | null;
  payload?: unknown;
  status?: WebhookDeliveryStatus | string | null;
  attemptCount?: number | null;
  nextRetryAt?: Timestamp | Date | string | number | null;
  nextAttemptAt?: Timestamp | Date | string | number | null;
  lastAttemptAt?: Timestamp | Date | string | number | null;
  lastSuccessAt?: Timestamp | Date | string | number | null;
  lastErrorAt?: Timestamp | Date | string | number | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  lastResponseStatus?: number | null;
  lastResponseBody?: string | null;
  lastResponseHeaders?: Record<string, string> | null;
  lastDurationMs?: number | null;
  deliveredAt?: Timestamp | Date | string | number | null;
};

export type SendWebhookDeliveryInput = {
  deliveryReference: DocumentReference<DocumentData>;
  delivery: WebhookDeliveryRecord;
  payload: unknown;
  signingSecret?: string | null;
};

export type SendWebhookDeliveryResult = {
  ok: boolean;
  status: WebhookDeliveryStatus;
  attemptCount: number;
  responseStatus: number | null;
  responseBody: string | null;
  durationMs: number;
  nextAttemptAt: Timestamp | null;
  errorCode: string | null;
  errorMessage: string | null;
};

const toTrimmedText = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue || null;
};

const toPositiveInteger = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }

  if (typeof value === "string") {
    const parsedValue = Number(value.trim());
    return Number.isFinite(parsedValue) && parsedValue >= 0 ? Math.floor(parsedValue) : null;
  }

  return null;
};

const captureResponseBody = async (response: Response) => {
  const responseText = await response.text();
  return responseText.length > MAX_CAPTURED_RESPONSE_CHARS
    ? `${responseText.slice(0, MAX_CAPTURED_RESPONSE_CHARS)}...[truncated]`
    : responseText;
};

const captureResponseHeaders = (response: Response) => {
  const capturedHeaders: Record<string, string> = {};
  const allowedHeaders = new Set(["content-type", "x-request-id", "traceparent", "retry-after"]);

  response.headers.forEach((value, key) => {
    if (allowedHeaders.has(key.toLowerCase())) {
      capturedHeaders[key] = value;
    }
  });

  return capturedHeaders;
};

const getDestinationHost = (destinationUrl: string) => {
  try {
    return new URL(destinationUrl).host;
  } catch {
    return "invalid-url";
  }
};

const classifyHttpFailure = (statusCode: number) => {
  if (statusCode === 408 || statusCode === 425 || statusCode === 429) {
    return {
      shouldRetry: true,
      errorCode: `http_${statusCode}`,
      errorMessage: `Webhook endpoint responded with retryable HTTP ${statusCode}.`,
    };
  }

  if (statusCode >= 500) {
    return {
      shouldRetry: true,
      errorCode: `http_${statusCode}`,
      errorMessage: `Webhook endpoint responded with server error HTTP ${statusCode}.`,
    };
  }

  return {
    shouldRetry: false,
    errorCode: `http_${statusCode}`,
    errorMessage: `Webhook endpoint responded with non-retryable HTTP ${statusCode}.`,
  };
};

const classifyThrownError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("abort")) {
    return {
      shouldRetry: true,
      errorCode: "timeout",
      errorMessage: "Webhook request timed out.",
    };
  }

  return {
    shouldRetry: true,
    errorCode: "network_error",
    errorMessage: message,
  };
};

const resolveSigningSecret = (
  delivery: WebhookDeliveryRecord,
  overrideSecret?: string | null
) => toTrimmedText(overrideSecret) ?? toTrimmedText(delivery.signingSecret);

const getRetryTimestamp = (durationSeconds: number) =>
  Timestamp.fromMillis(Date.now() + durationSeconds * 1_000);

export const sendWebhookDelivery = async (
  input: SendWebhookDeliveryInput
): Promise<SendWebhookDeliveryResult> => {
  const { deliveryReference, delivery, payload, signingSecret } = input;
  const destinationUrl = toTrimmedText(delivery.destinationUrl);

  if (!destinationUrl) {
    throw new Error("Webhook delivery is missing a destinationUrl.");
  }

  const policy = getDeliveryPolicy(delivery.plan);
  const secret = resolveSigningSecret(delivery, signingSecret);
  const destinationHost = getDestinationHost(destinationUrl);

  if (!secret) {
    throw new Error("Webhook delivery is missing a signing secret.");
  }

  const existingAttemptCount = toPositiveInteger(delivery.attemptCount) ?? 0;
  const attemptCount = existingAttemptCount + 1;
  const startedAt = Date.now();

  await deliveryReference.set({
    status: "sending",
    attemptCount,
    plan: policy.plan,
    lastAttemptAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  const { rawBody, headers: signatureHeaders } = buildWebhookSignatureHeaders(payload, secret, startedAt);

  try {
    const response = await fetch(destinationUrl, {
      method: "POST",
      headers: signatureHeaders,
      body: rawBody,
      signal: AbortSignal.timeout(policy.requestTimeoutMs),
    });
    const durationMs = Date.now() - startedAt;
    const responseBody = response.ok ? null : await captureResponseBody(response);
    const responseHeaders = captureResponseHeaders(response);

    if (response.ok) {
      await deliveryReference.set({
        status: "delivered",
      attemptCount,
        plan: policy.plan,
        deliveredAt: FieldValue.serverTimestamp(),
        lastSuccessAt: FieldValue.serverTimestamp(),
        lastResponseStatus: response.status,
        lastResponseBody: null,
        lastResponseHeaders: responseHeaders,
        lastDurationMs: durationMs,
      lastErrorAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      nextRetryAt: null,
      nextAttemptAt: null,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

      logger.info("Webhook delivery succeeded.", {
        deliveryId: deliveryReference.id,
        subscriberId: delivery.subscriberId ?? null,
        signalId: delivery.signalId ?? null,
        destinationHost,
        attemptCount,
        responseStatus: response.status,
        durationMs,
        plan: policy.plan,
      });

      return {
        ok: true,
        status: "delivered",
        attemptCount,
        responseStatus: response.status,
        responseBody,
        durationMs,
        nextAttemptAt: null,
        errorCode: null,
        errorMessage: null,
      };
    }

    const failure = classifyHttpFailure(response.status);
    const shouldRetry = failure.shouldRetry && attemptCount < policy.maxAttempts;
    const nextAttemptAt = shouldRetry
      ? getRetryTimestamp(getNextRetryDelaySeconds(policy, attemptCount))
      : null;
    const status: WebhookDeliveryStatus = shouldRetry ? "retry_scheduled" : "failed";

    await deliveryReference.set({
      status,
      attemptCount,
      plan: policy.plan,
      nextRetryAt: nextAttemptAt,
      nextAttemptAt,
      lastErrorAt: FieldValue.serverTimestamp(),
      lastErrorCode: failure.errorCode,
      lastErrorMessage: failure.errorMessage,
      lastResponseStatus: response.status,
      lastResponseBody: responseBody,
      lastResponseHeaders: responseHeaders,
      lastDurationMs: durationMs,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    logger.warn("Webhook delivery received non-success response.", {
      deliveryId: deliveryReference.id,
      subscriberId: delivery.subscriberId ?? null,
      signalId: delivery.signalId ?? null,
      destinationHost,
      attemptCount,
      responseStatus: response.status,
      durationMs,
      status,
      nextAttemptAt: nextAttemptAt?.toDate().toISOString() ?? null,
      errorCode: failure.errorCode,
      plan: policy.plan,
    });

    return {
      ok: false,
      status,
      attemptCount,
      responseStatus: response.status,
      responseBody,
      durationMs,
      nextAttemptAt,
      errorCode: failure.errorCode,
      errorMessage: failure.errorMessage,
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const failure = classifyThrownError(error);
    const shouldRetry = attemptCount < policy.maxAttempts;
    const nextAttemptAt = shouldRetry
      ? getRetryTimestamp(getNextRetryDelaySeconds(policy, attemptCount))
      : null;
    const status: WebhookDeliveryStatus = shouldRetry ? "retry_scheduled" : "failed";

    await deliveryReference.set({
      status,
      attemptCount,
      plan: policy.plan,
      nextRetryAt: nextAttemptAt,
      nextAttemptAt,
      lastErrorAt: FieldValue.serverTimestamp(),
      lastErrorCode: failure.errorCode,
      lastErrorMessage: failure.errorMessage,
      lastResponseStatus: null,
      lastResponseBody: null,
      lastResponseHeaders: null,
      lastDurationMs: durationMs,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    logger.error("Webhook delivery request failed.", {
      deliveryId: deliveryReference.id,
      subscriberId: delivery.subscriberId ?? null,
      signalId: delivery.signalId ?? null,
      destinationHost,
      attemptCount,
      durationMs,
      status,
      nextAttemptAt: nextAttemptAt?.toDate().toISOString() ?? null,
      errorCode: failure.errorCode,
      errorMessage: failure.errorMessage,
      plan: policy.plan,
    });

    return {
      ok: false,
      status,
      attemptCount,
      responseStatus: null,
      responseBody: null,
      durationMs,
      nextAttemptAt,
      errorCode: failure.errorCode,
      errorMessage: failure.errorMessage,
    };
  }
};
