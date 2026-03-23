import { adminDb, FieldValue } from "../lib/firebaseAdmin.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  const payload = parseJsonBody(req.body);

  if (!payload) {
    console.warn("[tradingview-webhook] Invalid payload received", {
      contentType: req.headers["content-type"],
      bodyType: typeof req.body,
    });

    return res.status(400).json({
      success: false,
      error: "Invalid JSON payload",
    });
  }

  console.log("[tradingview-webhook] Incoming TradingView payload", payload);

  try {
    const savedSignal = await adminDb.collection("signals").add(buildSignalDocument(payload));

    return res.status(200).json({
      success: true,
      message: "TradingView webhook received",
      id: savedSignal.id,
    });
  } catch (error) {
    console.error("[tradingview-webhook] Failed to save TradingView payload", serializeError(error));

    return res.status(500).json({
      success: false,
      error: "Failed to save TradingView payload",
    });
  }
}

function parseJsonBody(body) {
  if (!body) {
    return null;
  }

  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      return isPlainObject(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  if (isPlainObject(body)) {
    return body;
  }

  return null;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function buildSignalDocument(payload) {
  return {
    source: getOptionalValue(payload.source),
    strategy: getOptionalValue(payload.strategy),
    symbol: getOptionalValue(payload.symbol),
    signal: getOptionalValue(payload.signal),
    timeframe: getOptionalValue(payload.timeframe),
    entry: getOptionalValue(payload.entry),
    stop_loss: getOptionalValue(payload.stop_loss),
    take_profit: getOptionalValue(payload.take_profit),
    confidence: getOptionalValue(payload.confidence),
    score: getOptionalValue(payload.score),
    timestamp: getOptionalValue(payload.timestamp),
    rawPayload: payload,
    createdAt: FieldValue.serverTimestamp(),
  };
}

function getOptionalValue(value) {
  return value ?? null;
}

function serializeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}
