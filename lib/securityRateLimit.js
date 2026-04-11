import { createHash } from "node:crypto";
import { adminDb, FieldValue } from "./firebaseAdmin.js";

const RATE_LIMIT_COLLECTION = "serverRateLimits";

function hashKey(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function getRequestIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  return req.socket?.remoteAddress ?? req.ip ?? "unknown";
}

export function getRequestId(req) {
  const headerValue = req.headers["x-request-id"];
  if (typeof headerValue === "string" && headerValue.trim()) {
    return headerValue.trim();
  }

  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function enforceRateLimit({
  route,
  identifier,
  limit,
  windowMs,
}) {
  const now = Date.now();
  const key = `${route}:${identifier || "unknown"}`;
  const documentId = hashKey(key);
  const reference = adminDb.collection(RATE_LIMIT_COLLECTION).doc(documentId);

  const result = await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const currentData = snapshot.exists ? snapshot.data() ?? {} : {};
    const expiresAt = typeof currentData.expiresAt === "number" ? currentData.expiresAt : 0;
    const activeWindow = expiresAt > now;
    const currentCount = activeWindow && typeof currentData.count === "number" ? currentData.count : 0;

    if (activeWindow && currentCount >= limit) {
      transaction.set(reference, {
        route,
        keyHash: documentId,
        count: currentCount,
        expiresAt,
        lastSeenAt: now,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((expiresAt - now) / 1000)),
      };
    }

    const nextCount = activeWindow ? currentCount + 1 : 1;
    const nextExpiresAt = activeWindow ? expiresAt : now + windowMs;

    transaction.set(reference, {
      route,
      keyHash: documentId,
      count: nextCount,
      limit,
      windowMs,
      windowStartedAt: activeWindow ? currentData.windowStartedAt ?? now : now,
      expiresAt: nextExpiresAt,
      lastSeenAt: now,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: snapshot.exists ? currentData.createdAt ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
    }, { merge: true });

    return {
      allowed: true,
      remaining: Math.max(0, limit - nextCount),
      retryAfterSeconds: 0,
    };
  });

  return result;
}
