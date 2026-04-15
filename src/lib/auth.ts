import { auth } from "./firebase";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import type { AuthError } from "firebase/auth";
import {
  getOrCreateUserProfile,
  CURRENT_TERMS_VERSION,
  normalizeEmail,
} from "./userProfiles";

type ProfileBootstrapError = Error & {
  code: string;
};

const createProfileBootstrapError = (): ProfileBootstrapError => {
  const error = new Error(
    "We couldn't finish setting up your account. Please try again."
  ) as ProfileBootstrapError;
  error.code = "profile/bootstrap-failed";
  return error;
};

const isDevelopment = import.meta.env.DEV;

const logBootstrapFailure = (stage: string, error: unknown, metadata?: Record<string, unknown>) => {
  if (!isDevelopment) {
    return;
  }

  const maybeError = error as { code?: unknown; message?: unknown; name?: unknown };

  console.error("[auth-bootstrap]", stage, {
    ...metadata,
    code: typeof maybeError?.code === "string" ? maybeError.code : undefined,
    message: typeof maybeError?.message === "string" ? maybeError.message : String(error),
    name: typeof maybeError?.name === "string" ? maybeError.name : undefined,
    error,
  });
};

export const signUp = async (
  email: string,
  password: string,
  fullName?: string,
  options?: {
    acceptLegal?: boolean;
    termsVersion?: string;
  }
) => {
  const normalizedEmail = normalizeEmail(email);
  const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);

  try {
    if (fullName) {
      await updateProfile(credential.user, { displayName: fullName });
    }

    await credential.user.getIdToken(true);

    await getOrCreateUserProfile(credential.user, {
      acceptLegal: options?.acceptLegal,
      fullName,
      termsVersion: options?.termsVersion ?? CURRENT_TERMS_VERSION,
    });

    return credential;
  } catch (error) {
    logBootstrapFailure("signup bootstrap failed", error, {
      uid: credential.user.uid,
      email: credential.user.email,
      hasDisplayName: Boolean(fullName),
      acceptedLegal: options?.acceptLegal === true,
      termsVersion: options?.termsVersion ?? CURRENT_TERMS_VERSION,
    });
    await firebaseSignOut(auth).catch(() => undefined);
    throw createProfileBootstrapError();
  }
};

export const signIn = async (email: string, password: string) => {
  const normalizedEmail = normalizeEmail(email);
  const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);

  if (isDevelopment) {
    console.info("[auth-login] auth success", {
      uid: credential.user.uid,
      email: credential.user.email,
    });
  }

  try {
    await credential.user.getIdToken();
  } catch (error) {
    logBootstrapFailure("signin token refresh failed", error, {
      uid: credential.user.uid,
      email: credential.user.email,
    });
  }

  return credential;
};

export const signOut = () => {
  return firebaseSignOut(auth);
};

export const resetPassword = (email: string) => {
  return sendPasswordResetEmail(auth, normalizeEmail(email));
};

export const getAuthErrorMessage = (error: unknown) => {
  const code = (error as AuthError | undefined)?.code;

  switch (code) {
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try logging in instead.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/missing-password":
      return "Enter your password.";
    case "auth/weak-password":
      return "Password must be at least 6 characters long.";
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/missing-email":
      return "Enter your email address.";
    case "permission-denied":
    case "firestore/permission-denied":
    case "profile/bootstrap-failed":
      return "We couldn't finish setting up your account. Please try again.";
    default:
      return "Something went wrong. Please try again.";
  }
};

export { getOrCreateUserProfile };
