import { adminDb, FieldValue } from "../lib/firebaseAdmin.js";
import { enforceRateLimit, getRequestId, getRequestIp } from "../lib/securityRateLimit.js";

const RELAY_EVENTS_COLLECTION = "tradingviewRelayEvents";
const TRADES_COLLECTION = "trades";
const SIGNALS_COLLECTION = "signals";
const MAX_BODY_BYTES = 32 * 1024;
const RATE_LIMIT_WINDOW_MS = Number(process.env.TRADINGVIEW_WEBHOOK_RATE_LIMIT_WINDOW_MS ?? 60 * 1000);
const RATE_LIMIT_MAX = Number(process.env.TRADINGVIEW_WEBHOOK_RATE_LIMIT_MAX ?? 120);
const RELAY_SOURCE = "tradingview-relay";
const FIREBASE_CLOSE_TRADE_URL = process.env.FIREBASE_CLOSE_TRADE_URL ?? "";
const FIREBASE_CLOSE_TRADE_SECRET = process.env.FIREBASE_CLOSE_TRADE_SECRET ?? "";
const DEFAULT_EVENT_SOURCE = "tradingview";
const DEFAULT_MARKET_STATE = "qualified_precision_setup";
const DEFAULT_CONFIDENCE = "qualified";
const PRECISION_PRODUCT_CONFIG = Object.freeze({
  product: "BTC Precision Engine",
  productCode: "btc_precision_engine_v1",
  engine: "precision",
  engineCode: "precision_engine",
  strategyName: "SignalForge IQ BTC Precision Engine v1",
  strategyVersion: "v1",
  uiLabel: "BTC Precision",
});
const MOMENTUM_PRODUCT_CONFIG = Object.freeze({
  product: "BTC Momentum Engine",
  productCode: "btc_momentum_engine_beta",
  engine: "momentum",
  engineCode: "momentum_engine",
  strategyName: "SignalForge IQ BTC Momentum Engine Beta",
  strategyVersion: "beta",
  uiLabel: "BTC Momentum",
});

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const requestId = getRequestId(req);
  const clientIp = getRequestIp(req);

  logInfo("request received", {
    requestId,
    clientIp,
    method: req.method,
    contentType: req.headers["content-type"] ?? null,
  });

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      ok: false,
      error: "Method not allowed. Use POST.",
    });
  }

  const rateLimit = await enforceRateLimit({
    route: "api/tradingview-webhook",
    identifier: clientIp,
    limit: RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });

  if (!rateLimit.allowed) {
    res.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
    logWarn("rate limit exceeded", {
      requestId,
      clientIp,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    });
    return res.status(429).json({
      ok: false,
      error: "Too many requests. Please wait and try again.",
    });
  }

  const contentLength = toFiniteNumber(req.headers["content-length"]);

  if (contentLength !== null && contentLength > MAX_BODY_BYTES) {
    logWarn("validation failure", {
      requestId,
      reason: "body too large",
      contentLength,
    });
    return res.status(400).json({
      ok: false,
      error: "Request body too large.",
    });
  }

  const payload = parseJsonBody(req.body);

  if (!payload) {
    logWarn("validation failure", {
      requestId,
      reason: "invalid json",
      bodyType: typeof req.body,
    });
    return res.status(400).json({
      ok: false,
      error: "Invalid JSON payload.",
    });
  }

  let normalizedEvent;

  try {
    normalizedEvent = validateAndNormalizeTradingViewPayload(payload);
    logInfo("payload validated", {
      requestId,
      event: normalizedEvent.event,
      eventId: normalizedEvent.eventId,
      signalId: normalizedEvent.signalId ?? null,
      tradeId: normalizedEvent.tradeId ?? null,
      symbol: normalizedEvent.symbol,
      side: normalizedEvent.side,
    });
  } catch (error) {
    logWarn("validation failure", {
      requestId,
      reason: getErrorMessage(error),
    });
    return res.status(400).json({
      ok: false,
      error: getErrorMessage(error),
    });
  }

  const relayEventReference = adminDb.collection(RELAY_EVENTS_COLLECTION).doc(normalizedEvent.eventId);
  const existingRelayEventSnapshot = await relayEventReference.get();

  if (existingRelayEventSnapshot.exists) {
    const existingRelayEvent = existingRelayEventSnapshot.data() ?? {};
    logInfo("duplicate event", {
      requestId,
      eventId: normalizedEvent.eventId,
      event: normalizedEvent.event,
      status: existingRelayEvent.status ?? null,
    });
    return res.status(200).json({
      ok: true,
      duplicate: true,
      event: normalizedEvent.event,
      eventId: normalizedEvent.eventId,
      status: existingRelayEvent.status ?? "duplicate",
      tradeId: existingRelayEvent.tradeId ?? null,
      signalId: existingRelayEvent.signalId ?? null,
    });
  }

  try {
    if (normalizedEvent.event === "entry") {
      const result = await routeEntryEvent(normalizedEvent, relayEventReference);

      logInfo("entry routed", {
        requestId,
        eventId: normalizedEvent.eventId,
        signalId: result.signalId,
        tradeId: result.tradeId,
        symbol: normalizedEvent.symbol,
        side: normalizedEvent.side,
        status: result.status,
        duplicate: result.duplicate,
      });

      return res.status(200).json({
        ok: true,
        event: normalizedEvent.event,
        eventId: normalizedEvent.eventId,
        duplicate: Boolean(result.duplicate),
        signalId: result.signalId,
        tradeId: result.tradeId,
        status: result.status,
      });
    }

    const result = await routeExitEvent(normalizedEvent, relayEventReference);

    logInfo("exit routed", {
      requestId,
      eventId: normalizedEvent.eventId,
      symbol: normalizedEvent.symbol,
      side: normalizedEvent.side,
      tradeId: result.tradeId ?? null,
      signalId: result.signalId ?? null,
      duplicate: result.duplicate ?? false,
      status: result.status,
    });

    return res.status(200).json({
      ok: true,
      event: normalizedEvent.event,
      eventId: normalizedEvent.eventId,
      duplicate: Boolean(result.duplicate),
      tradeId: result.tradeId ?? null,
      signalId: result.signalId ?? null,
      backend: sanitizeBackendResponse(result.backend),
      status: result.status,
    });
  } catch (error) {
    logError("backend failure", {
      requestId,
      eventId: normalizedEvent.eventId,
      event: normalizedEvent.event,
      symbol: normalizedEvent.symbol,
      side: normalizedEvent.side,
      error: getErrorMessage(error),
    });

    const statusCode = isRelayHttpError(error) ? error.statusCode : 500;

    return res.status(statusCode).json({
      ok: false,
      event: normalizedEvent.event,
      eventId: normalizedEvent.eventId,
      error: statusCode >= 500 ? "Unable to process webhook event." : getErrorMessage(error),
    });
  }
}

async function routeEntryEvent(normalizedEvent, relayEventReference) {
  const signalId = normalizedEvent.signalId ?? normalizedEvent.eventId;
  const tradeId = normalizedEvent.tradeId ?? signalId;
  const signalReference = adminDb.collection(SIGNALS_COLLECTION).doc(signalId);

  const transactionResult = await adminDb.runTransaction(async (transaction) => {
    const [relayEventSnapshot, signalSnapshot] = await Promise.all([
      transaction.get(relayEventReference),
      transaction.get(signalReference),
    ]);

    if (relayEventSnapshot.exists || signalSnapshot.exists) {
      if (!relayEventSnapshot.exists) {
        transaction.set(relayEventReference, buildRelayEventDocument({
          normalizedEvent,
          status: "already_processed",
          signalId,
          tradeId,
          metadata: {
            collection: SIGNALS_COLLECTION,
            duplicateReason: signalSnapshot.exists ? "signal-exists" : "relay-event-exists",
          },
        }));
      }

      return {
        duplicate: true,
        signalId,
        tradeId,
        status: "already_processed",
      };
    }

    transaction.set(signalReference, buildSignalDocument(normalizedEvent, { signalId, tradeId }));
    transaction.set(relayEventReference, buildRelayEventDocument({
      normalizedEvent,
      status: "entry-routed",
      signalId,
      tradeId,
      metadata: {
        collection: SIGNALS_COLLECTION,
      },
    }));

    return {
      duplicate: false,
      signalId: signalReference.id,
      tradeId: signalReference.id,
      status: "entry-routed",
    };
  });

  if (transactionResult.duplicate) {
    return transactionResult;
  }

  return transactionResult;
}

async function routeExitEvent(normalizedEvent, relayEventReference) {
  const matchingTrade = await findLatestOpenTrade({
    symbol: normalizedEvent.symbol,
    side: normalizedEvent.side,
  });

  logInfo("exit broker pre-check complete", {
    eventId: normalizedEvent.eventId,
    signalId: normalizedEvent.signalId ?? null,
    tradeId: normalizedEvent.tradeId ?? null,
    symbol: normalizedEvent.symbol,
    side: normalizedEvent.side,
    matchedTradeId: matchingTrade?.tradeId ?? null,
    matchedSignalId: matchingTrade?.signalId ?? null,
    matchedBy: matchingTrade?.matchedBy ?? null,
  });

  const backendPayload = {
    event: "exit",
    eventType: normalizedEvent.eventType,
    source: RELAY_SOURCE,
    eventId: normalizedEvent.eventId,
    signalId: normalizedEvent.signalId ?? matchingTrade?.signalId ?? null,
    tradeId: normalizedEvent.tradeId ?? matchingTrade?.tradeId ?? null,
    automationTag: normalizedEvent.automationTag,
    product: normalizedEvent.product,
    productCode: normalizedEvent.productCode,
    engine: normalizedEvent.engine,
    engineCode: normalizedEvent.engineCode,
    strategyName: normalizedEvent.strategyName,
    strategyVersion: normalizedEvent.strategyVersion,
    symbol: normalizedEvent.symbol,
    tickerId: normalizedEvent.tickerId,
    timeframe: normalizedEvent.timeframe,
    barTime: normalizedEvent.barTime,
    timestamp: new Date(normalizedEvent.barTime).toISOString(),
    exitTime: new Date(normalizedEvent.barTime).toISOString(),
    side: normalizedEvent.side,
    marketState: normalizedEvent.marketState,
    confidence: normalizedEvent.confidence,
    stopPrice: normalizedEvent.stopPrice,
    targetPrice: normalizedEvent.targetPrice,
    ...(normalizedEvent.rrPlanned !== undefined ? { rrPlanned: normalizedEvent.rrPlanned } : {}),
    ...(normalizedEvent.exitPrice !== undefined ? { exitPrice: normalizedEvent.exitPrice } : {}),
  };

  const backend = await callFirebaseCloseTradeWebhook(backendPayload);

  await relayEventReference.set(buildRelayEventDocument({
    normalizedEvent,
    status: backend.result?.status ?? "exit-routed",
    signalId: matchingTrade?.signalId ?? backend.signalId ?? null,
    tradeId: matchingTrade?.tradeId ?? backend.tradeId ?? null,
    metadata: {
      matchedBy: matchingTrade?.matchedBy ?? null,
      relayClassification: backend.result?.status ?? "exit-routed",
      backendStatus: backend.result?.status ?? null,
      backendDuplicate: Boolean(backend.result?.duplicate),
    },
  }));

  return {
    status: backend.result?.status ?? "exit-routed",
    tradeId: matchingTrade?.tradeId ?? backend.tradeId ?? null,
    signalId: matchingTrade?.signalId ?? backend.signalId ?? null,
    duplicate: Boolean(backend.result?.duplicate),
    backend: backend.result,
  };
}

async function callFirebaseCloseTradeWebhook(payload) {
  if (!FIREBASE_CLOSE_TRADE_URL.trim()) {
    throw createRelayHttpError(500, "TradingView relay is not configured for exit forwarding.");
  }

  if (!FIREBASE_CLOSE_TRADE_SECRET.trim()) {
    throw createRelayHttpError(500, "TradingView relay is not configured for authenticated exit forwarding.");
  }

  const response = await fetch(FIREBASE_CLOSE_TRADE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-secret": FIREBASE_CLOSE_TRADE_SECRET,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });

  const responseText = await response.text();
  const responseBody = parseJsonBody(responseText);

  if (!response.ok) {
    throw createRelayHttpError(
      response.status,
      responseBody?.error || `Firebase closeTradeFromWebhook failed with status ${response.status}.`
    );
  }

  return {
    tradeId: typeof responseBody?.tradeId === "string" ? responseBody.tradeId : null,
    signalId: typeof responseBody?.signalId === "string" ? responseBody.signalId : null,
    result: isPlainObject(responseBody) ? responseBody : null,
  };
}

async function findLatestOpenTrade({ symbol, side }) {
  const snapshot = await adminDb
    .collection(TRADES_COLLECTION)
    .where("result", "==", "open")
    .get();

  const matchingTrades = snapshot.docs
    .map((documentSnapshot) => ({
      tradeId: documentSnapshot.id,
      ...documentSnapshot.data(),
    }))
    .filter((trade) => {
      const tradeSymbol = normalizeSymbol(trade.symbol);
      const tradeSide = normalizeSide(trade.side);
      return tradeSymbol === symbol && tradeSide === side;
    })
    .sort((left, right) => getComparableTradeTime(right) - getComparableTradeTime(left));

  if (matchingTrades.length === 0) {
    return null;
  }

  return {
    tradeId: matchingTrades[0].tradeId,
    signalId: typeof matchingTrades[0].signalId === "string" ? matchingTrades[0].signalId : null,
    matchedBy: "symbol-side-latest-open-trade",
  };
}

function validateAndNormalizeTradingViewPayload(payload) {
  const allowedKeys = new Set([
    "event",
    "eventType",
    "automationTag",
    "product",
    "productCode",
    "engine",
    "engineCode",
    "strategyName",
    "strategyVersion",
    "symbol",
    "tickerId",
    "timeframe",
    "barTime",
    "timestamp",
    "side",
    "price",
    "entryPrice",
    "stopPrice",
    "targetPrice",
    "rrPlanned",
    "rrTarget",
    "eventId",
    "signalId",
    "tradeId",
    "marketState",
    "confidence",
    "source",
    "exitPrice",
  ]);

  const unknownKeys = Object.keys(payload).filter((key) => !allowedKeys.has(key));

  if (unknownKeys.length > 0) {
    throw new Error(`Unsupported field(s): ${unknownKeys.join(", ")}`);
  }

  const event = normalizeEvent(payload.event);
  const eventType = normalizeEventType(payload.eventType, event);
  const metadata = normalizeProductMetadata(payload);
  const symbol = normalizeSymbol(payload.symbol);
  const tickerId = requireNonEmptyString(payload.tickerId, "tickerId");
  const timeframe = requireNonEmptyString(payload.timeframe, "timeframe");
  const barTime = normalizeBarTime(payload.barTime, payload.timestamp);
  const side = normalizeSide(payload.side);
  const stopPrice = requirePositiveNumber(payload.stopPrice, "stopPrice");
  const targetPrice = requirePositiveNumber(payload.targetPrice, "targetPrice");
  const eventId = requireNonEmptyString(payload.eventId, "eventId");
  const signalId = optionalNonEmptyString(payload.signalId);
  const tradeId = optionalNonEmptyString(payload.tradeId);
  const source = optionalNonEmptyString(payload.source) ?? DEFAULT_EVENT_SOURCE;
  const confidence = normalizeConfidence(payload.confidence);
  const marketState = optionalNonEmptyString(payload.marketState) ?? DEFAULT_MARKET_STATE;

  if (!symbol) {
    throw new Error("symbol is required and must be a non-empty string.");
  }

  if (!side) {
    throw new Error('side must be exactly "long" or "short".');
  }

  if (event === "entry") {
    return {
      event,
      eventType,
      ...metadata,
      symbol,
      tickerId,
      timeframe,
      barTime,
      side,
      source,
      confidence,
      marketState,
      signalId,
      tradeId,
      entryPrice: requirePositiveNumber(payload.entryPrice, "entryPrice"),
      stopPrice,
      targetPrice,
      rrPlanned: normalizeRrPlanned(payload.rrPlanned, payload.rrTarget),
      eventId,
    };
  }

  if (payload.entryPrice !== undefined) {
    throw new Error("entryPrice is not allowed for exit events.");
  }

  if (payload.rrTarget !== undefined) {
    throw new Error("rrTarget is not allowed for exit events.");
  }

  const exitPrice = payload.exitPrice === undefined
    ? undefined
    : requirePositiveNumber(payload.exitPrice, "exitPrice");

  return {
    event,
    eventType,
    ...metadata,
    symbol,
    tickerId,
    timeframe,
    barTime,
    side,
    source,
    confidence,
    marketState,
    signalId,
    tradeId,
    stopPrice,
    targetPrice,
    eventId,
    ...(exitPrice !== undefined ? { exitPrice } : {}),
  };
}

function buildSignalDocument(normalizedEvent, { signalId, tradeId }) {
  const signalTimestamp = new Date(normalizedEvent.barTime).toISOString();
  const direction = normalizedEvent.side.toUpperCase();
  const assetType = inferAssetType(normalizedEvent.tickerId, normalizedEvent.symbol);

  return {
    signalId,
    tradeId,
    product: normalizedEvent.product,
    productCode: normalizedEvent.productCode,
    engine: normalizedEvent.engine,
    engineCode: normalizedEvent.engineCode,
    symbol: normalizedEvent.symbol,
    assetType,
    direction,
    side: normalizedEvent.side,
    entry: toPriceText(normalizedEvent.entryPrice),
    entryPrice: normalizedEvent.entryPrice,
    stopLoss: toPriceText(normalizedEvent.stopPrice),
    stopPrice: normalizedEvent.stopPrice,
    target: toPriceText(normalizedEvent.targetPrice),
    targetPrice: normalizedEvent.targetPrice,
    thesis: `${normalizedEvent.product} ${normalizedEvent.side} setup monitoring ${normalizedEvent.marketState.replace(/_/g, " ")}.`,
    status: "ACTIVE",
    source: normalizedEvent.source,
    timeframe: normalizedEvent.timeframe,
    confidence: normalizedEvent.confidence,
    strategyName: normalizedEvent.strategyName,
    strategyVersion: normalizedEvent.strategyVersion,
    tickerId: normalizedEvent.tickerId,
    automationTag: normalizedEvent.automationTag,
    marketState: normalizedEvent.marketState,
    eventType: normalizedEvent.eventType,
    eventId: normalizedEvent.eventId,
    rrPlanned: normalizedEvent.rrPlanned,
    rrTarget: normalizedEvent.rrPlanned,
    signalTime: signalTimestamp,
    entryTime: signalTimestamp,
    reviewStatus: "APPROVED",
    ingestedBy: RELAY_SOURCE,
    ingestionTimestamp: FieldValue.serverTimestamp(),
    approvedAt: FieldValue.serverTimestamp(),
    approvedBy: RELAY_SOURCE,
    statusUpdatedAt: FieldValue.serverTimestamp(),
    statusUpdatedBy: RELAY_SOURCE,
    isArchived: false,
    isTest: false,
    isValid: true,
    rawPayload: normalizedEvent,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function buildRelayEventDocument({ normalizedEvent, status, signalId, tradeId, metadata }) {
  return {
    eventId: normalizedEvent.eventId,
    event: normalizedEvent.event,
    eventType: normalizedEvent.eventType,
    product: normalizedEvent.product,
    productCode: normalizedEvent.productCode,
    engine: normalizedEvent.engine,
    engineCode: normalizedEvent.engineCode,
    strategyName: normalizedEvent.strategyName,
    strategyVersion: normalizedEvent.strategyVersion,
    automationTag: normalizedEvent.automationTag,
    symbol: normalizedEvent.symbol,
    tickerId: normalizedEvent.tickerId,
    timeframe: normalizedEvent.timeframe,
    barTime: normalizedEvent.barTime,
    side: normalizedEvent.side,
    marketState: normalizedEvent.marketState,
    confidence: normalizedEvent.confidence,
    signalId: signalId ?? null,
    tradeId: tradeId ?? null,
    status,
    source: normalizedEvent.source,
    metadata: metadata ?? null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function normalizeProductMetadata(payload) {
  const explicitProductCode = optionalNonEmptyString(payload.productCode);
  const explicitStrategyName = optionalNonEmptyString(payload.strategyName);
  const automationTag = optionalNonEmptyString(payload.automationTag);
  const explicitEngineCode = optionalNonEmptyString(payload.engineCode);
  const explicitProduct = optionalNonEmptyString(payload.product);
  const explicitEngine = optionalNonEmptyString(payload.engine);
  const explicitStrategyVersion = optionalNonEmptyString(payload.strategyVersion);

  const looksLikePrecision = [
    explicitProductCode,
    explicitStrategyName,
    automationTag,
    explicitProduct,
    explicitEngineCode,
    explicitEngine,
  ].some((value) => typeof value === "string" && value.toLowerCase().includes("precision"));
  const looksLikeMomentum = [
    explicitProductCode,
    explicitStrategyName,
    automationTag,
    explicitProduct,
    explicitEngineCode,
    explicitEngine,
  ].some((value) => typeof value === "string" && value.toLowerCase().includes("momentum"));

  if (looksLikePrecision || (!explicitProductCode && !looksLikeMomentum)) {
    return {
      product: explicitProduct ?? PRECISION_PRODUCT_CONFIG.product,
      productCode: explicitProductCode ?? PRECISION_PRODUCT_CONFIG.productCode,
      engine: explicitEngine ?? PRECISION_PRODUCT_CONFIG.engine,
      engineCode: explicitEngineCode ?? PRECISION_PRODUCT_CONFIG.engineCode,
      strategyName: explicitStrategyName ?? automationTag ?? PRECISION_PRODUCT_CONFIG.strategyName,
      strategyVersion: explicitStrategyVersion ?? PRECISION_PRODUCT_CONFIG.strategyVersion,
      automationTag: automationTag ?? explicitStrategyName ?? PRECISION_PRODUCT_CONFIG.strategyName,
    };
  }

  if (looksLikeMomentum) {
    return {
      product: explicitProduct ?? MOMENTUM_PRODUCT_CONFIG.product,
      productCode: explicitProductCode ?? MOMENTUM_PRODUCT_CONFIG.productCode,
      engine: explicitEngine ?? MOMENTUM_PRODUCT_CONFIG.engine,
      engineCode: explicitEngineCode ?? MOMENTUM_PRODUCT_CONFIG.engineCode,
      strategyName: explicitStrategyName ?? automationTag ?? MOMENTUM_PRODUCT_CONFIG.strategyName,
      strategyVersion: explicitStrategyVersion ?? MOMENTUM_PRODUCT_CONFIG.strategyVersion,
      automationTag: automationTag ?? explicitStrategyName ?? MOMENTUM_PRODUCT_CONFIG.strategyName,
    };
  }

  return {
    product: explicitProduct ?? explicitProductCode,
    productCode: explicitProductCode,
    engine: explicitEngine ?? explicitEngineCode ?? "strategy",
    engineCode: explicitEngineCode ?? "strategy_engine",
    strategyName: explicitStrategyName ?? automationTag ?? explicitProductCode,
    strategyVersion: explicitStrategyVersion ?? "v1",
    automationTag: automationTag ?? explicitStrategyName ?? explicitProductCode,
  };
}

function normalizeEventType(value, event) {
  const normalizedValue = optionalNonEmptyString(value);
  if (normalizedValue) {
    return normalizedValue;
  }
  return event === "entry" ? "signal.entry" : "signal.exit";
}

function normalizeBarTime(barTimeValue, timestampValue) {
  const fromBarTime = toFiniteNumber(barTimeValue);
  if (fromBarTime !== null && Number.isInteger(fromBarTime) && fromBarTime > 0) {
    return fromBarTime;
  }

  const rawTimestamp = optionalNonEmptyString(timestampValue);
  if (rawTimestamp) {
    const parsedTime = new Date(rawTimestamp).getTime();
    if (!Number.isFinite(parsedTime) || parsedTime <= 0) {
      throw new Error("timestamp must be a valid ISO date string or unix timestamp in milliseconds.");
    }

    return parsedTime;
  }

  const numericTimestamp = toFiniteNumber(timestampValue);
  if (numericTimestamp !== null && Number.isInteger(numericTimestamp) && numericTimestamp > 0) {
    return numericTimestamp;
  }

  throw new Error("barTime or timestamp is required.");
}

function normalizeRrPlanned(primaryValue, legacyValue) {
  return requirePositiveNumber(primaryValue ?? legacyValue, "rrPlanned");
}

function normalizeConfidence(value) {
  const numericConfidence = toFiniteNumber(value);
  if (numericConfidence !== null) {
    return String(numericConfidence);
  }

  return optionalNonEmptyString(value) ?? DEFAULT_CONFIDENCE;
}

function optionalNonEmptyString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue || null;
}

function sanitizeBackendResponse(value) {
  if (!isPlainObject(value)) {
    return null;
  }

  return {
    ok: Boolean(value.ok),
    status: typeof value.status === "string" ? value.status : null,
    tradeId: typeof value.tradeId === "string" ? value.tradeId : null,
    signalId: typeof value.signalId === "string" ? value.signalId : null,
    duplicate: Boolean(value.duplicate),
    alreadyClosed: Boolean(value.alreadyClosed),
    result: typeof value.result === "string" ? value.result : null,
    closeReason: typeof value.closeReason === "string" ? value.closeReason : null,
    matchedBy: typeof value.matchedBy === "string" ? value.matchedBy : null,
    error: typeof value.error === "string" ? value.error : null,
  };
}

function inferAssetType(tickerId, symbol) {
  const normalizedTickerId = tickerId.trim().toUpperCase();
  const normalizedSymbol = symbol.trim().toUpperCase();

  if (
    normalizedTickerId.startsWith("BINANCE:")
    || normalizedTickerId.startsWith("COINBASE:")
    || normalizedTickerId.startsWith("BYBIT:")
    || normalizedTickerId.startsWith("BITSTAMP:")
    || normalizedTickerId.startsWith("KRAKEN:")
    || normalizedTickerId.startsWith("CRYPTOCAP:")
  ) {
    return "crypto";
  }

  if (
    normalizedTickerId.startsWith("NASDAQ:")
    || normalizedTickerId.startsWith("NYSE:")
    || normalizedTickerId.startsWith("AMEX:")
    || normalizedTickerId.startsWith("ARCA:")
  ) {
    return "stocks";
  }

  if (/USD$/.test(normalizedSymbol) || /^XBT/.test(normalizedSymbol) || /^BTC/.test(normalizedSymbol)) {
    return "crypto";
  }

  return "stocks";
}

function getComparableTradeTime(trade) {
  return Math.max(
    getComparableTimestamp(trade.entryTime),
    getComparableTimestamp(trade.createdAt),
    getComparableTimestamp(trade.updatedAt)
  );
}

function getComparableTimestamp(value) {
  if (!value) {
    return 0;
  }

  if (typeof value === "object" && typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value === "object" && typeof value.toDate === "function") {
    const dateValue = value.toDate();
    return dateValue instanceof Date ? dateValue.getTime() : 0;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "string" || typeof value === "number") {
    const dateValue = new Date(value);
    return Number.isNaN(dateValue.getTime()) ? 0 : dateValue.getTime();
  }

  return 0;
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

  return isPlainObject(body) ? body : null;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeEvent(value) {
  const normalizedValue = requireNonEmptyString(value, "event").toLowerCase();

  if (normalizedValue !== "entry" && normalizedValue !== "exit") {
    throw new Error('event must be exactly "entry" or "exit".');
  }

  return normalizedValue;
}

function normalizeSymbol(value) {
  const normalizedValue = typeof value === "string" ? value.trim().toUpperCase() : "";
  return normalizedValue || null;
}

function normalizeSide(value) {
  const normalizedValue = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (normalizedValue === "long" || normalizedValue === "short") {
    return normalizedValue;
  }

  return null;
}

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} is required and must be a non-empty string.`);
  }

  return value.trim();
}

function requirePositiveNumber(value, fieldName) {
  const normalizedValue = toFiniteNumber(value);

  if (normalizedValue === null || normalizedValue <= 0) {
    throw new Error(`${fieldName} is required and must be a finite number greater than 0.`);
  }

  return normalizedValue;
}

function requirePositiveInteger(value, fieldName) {
  const normalizedValue = toFiniteNumber(value);

  if (normalizedValue === null || !Number.isInteger(normalizedValue) || normalizedValue <= 0) {
    throw new Error(`${fieldName} is required and must be a positive integer.`);
  }

  return normalizedValue;
}

function toFiniteNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsedValue = Number(value.trim());
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  return null;
}

function toPriceText(value) {
  return Number(value).toString();
}

function createRelayHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isRelayHttpError(value) {
  return Boolean(value) && typeof value === "object" && typeof value.statusCode === "number";
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function logInfo(message, metadata) {
  console.log("[tradingview-webhook]", message, metadata);
}

function logWarn(message, metadata) {
  console.warn("[tradingview-webhook]", message, metadata);
}

function logError(message, metadata) {
  console.error("[tradingview-webhook]", message, metadata);
}
