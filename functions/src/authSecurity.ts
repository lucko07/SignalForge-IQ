import { createHash } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";

const LOGIN_ATTEMPTS_COLLECTION = "loginAttempts";
const FAILED_LOGIN_LIMIT = 5;
const LOCK_WINDOW_MS = 15 * 60 * 1000;

type LoginAttemptDocument = {
  emailHash?: string;
  failedAttempts?: number;
  lastFailedAt?: number | null;
  lockedUntil?: number | null;
};

const normalizeEmail = (value: unknown) => (
  typeof value === "string" ? value.trim().toLowerCase() : ""
);

const hashEmail = (email: string) => createHash("sha256").update(email).digest("hex");

const buildLoginAttemptReference = (email: unknown) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new HttpsError("invalid-argument", "A valid email address is required.");
  }

  const emailHash = hashEmail(normalizedEmail);

  return {
    emailHash,
    normalizedEmail,
    reference: getFirestore().collection(LOGIN_ATTEMPTS_COLLECTION).doc(emailHash),
  };
};

const toStatusResponse = (data: LoginAttemptDocument | undefined, now: number) => {
  const failedAttempts = typeof data?.failedAttempts === "number" ? data.failedAttempts : 0;
  const lockedUntil = typeof data?.lockedUntil === "number" ? data.lockedUntil : null;
  const isLocked = lockedUntil !== null && lockedUntil > now;

  return {
    failedAttempts,
    isLocked,
    lockedUntil,
    retryAfterSeconds:
      isLocked && lockedUntil !== null ? Math.max(1, Math.ceil((lockedUntil - now) / 1000)) : 0,
  };
};

export const getEmailLoginAttemptStatus = onCall({}, async (request) => {
  const { reference, emailHash } = buildLoginAttemptReference(request.data?.email);
  const now = Date.now();
  const snapshot = await reference.get();
  const data = snapshot.exists ? snapshot.data() as LoginAttemptDocument : undefined;
  const status = toStatusResponse(data, now);

  if (status.isLocked) {
    logger.warn("Email login attempt blocked due to active lock.", {
      emailHash,
      retryAfterSeconds: status.retryAfterSeconds,
    });
  }

  return status;
});

export const recordFailedEmailLogin = onCall({}, async (request) => {
  const { reference, emailHash } = buildLoginAttemptReference(request.data?.email);
  const now = Date.now();

  const status = await getFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const currentData = snapshot.exists ? snapshot.data() as LoginAttemptDocument : undefined;
    const currentLockedUntil =
      typeof currentData?.lockedUntil === "number" ? currentData.lockedUntil : null;
    const isCurrentlyLocked = currentLockedUntil !== null && currentLockedUntil > now;
    const currentFailedAttempts =
      typeof currentData?.failedAttempts === "number"
        ? currentData.failedAttempts
        : 0;

    const nextFailedAttempts = isCurrentlyLocked ? currentFailedAttempts : currentFailedAttempts + 1;
    const nextLockedUntil =
      nextFailedAttempts >= FAILED_LOGIN_LIMIT
        ? Math.max(currentLockedUntil ?? 0, now + LOCK_WINDOW_MS)
        : null;

    transaction.set(reference, {
      emailHash,
      failedAttempts: nextFailedAttempts,
      lastFailedAt: now,
      lockedUntil: nextLockedUntil,
      updatedAt: FieldValue.serverTimestamp(),
      ...(!snapshot.exists ? { createdAt: FieldValue.serverTimestamp() } : {}),
    }, { merge: true });

    return toStatusResponse(
      {
        failedAttempts: nextFailedAttempts,
        lastFailedAt: now,
        lockedUntil: nextLockedUntil,
      },
      now
    );
  });

  logger.warn("Failed email login recorded.", {
    emailHash,
    failedAttempts: status.failedAttempts,
    locked: status.isLocked,
    lockedUntil: status.lockedUntil,
  });

  return status;
});

export const clearFailedEmailLogin = onCall({}, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "You must be signed in to clear failed login attempts.");
  }

  const userRecord = await getAuth().getUser(request.auth.uid);
  const normalizedEmail = normalizeEmail(userRecord.email);

  if (!normalizedEmail) {
    throw new HttpsError("failed-precondition", "This account does not have an email address.");
  }

  const { reference, emailHash } = buildLoginAttemptReference(normalizedEmail);

  await reference.set({
    emailHash,
    failedAttempts: 0,
    lastFailedAt: null,
    lockedUntil: null,
    updatedAt: FieldValue.serverTimestamp(),
    clearedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  logger.info("Failed email login attempts cleared.", {
    uid: request.auth.uid,
    emailHash,
  });

  return { cleared: true };
});
