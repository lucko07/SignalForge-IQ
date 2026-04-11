import { createHash } from "node:crypto";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import type { Request } from "firebase-functions/v2/https";

const RATE_LIMIT_COLLECTION = "serverRateLimits";

const hashKey = (value: string) => createHash("sha256").update(value).digest("hex");

export const getRequestIp = (request: Request) => {
  const forwardedFor = request.header("x-forwarded-for");

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  return request.ip ?? "unknown";
};

export const getRequestId = (request: Request) => {
  const headerValue = request.header("x-request-id");
  if (typeof headerValue === "string" && headerValue.trim()) {
    return headerValue.trim();
  }

  return crypto.randomUUID();
};

export const enforceRateLimit = async ({
  route,
  identifier,
  limit,
  windowMs,
}: {
  route: string;
  identifier: string;
  limit: number;
  windowMs: number;
}) => {
  const db = getFirestore();
  const now = Date.now();
  const key = `${route}:${identifier || "unknown"}`;
  const documentId = hashKey(key);
  const reference = db.collection(RATE_LIMIT_COLLECTION).doc(documentId);

  return db.runTransaction(async (transaction) => {
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
};
