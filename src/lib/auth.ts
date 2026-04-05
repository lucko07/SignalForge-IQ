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
  acceptLegalDocuments,
  getOrCreateUserProfile,
  CURRENT_TERMS_VERSION,
  normalizeEmail,
} from "./userProfiles";
import { deleteUser } from "firebase/auth";

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

    await getOrCreateUserProfile(credential.user);

    if (options?.acceptLegal) {
      await acceptLegalDocuments(
        credential.user.uid,
        options.termsVersion ?? CURRENT_TERMS_VERSION
      );
    }

    return credential;
  } catch (error) {
    try {
      await deleteUser(credential.user);
    } catch {
      // If cleanup fails, route guards still prevent protected access without consent.
    }

    throw error;
  }
};

export const signIn = async (email: string, password: string) => {
  const normalizedEmail = normalizeEmail(email);
  const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
  await getOrCreateUserProfile(credential.user);
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
      return "An account with this email already exists.";
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
    default:
      return "Something went wrong. Please try again.";
  }
};

export { getOrCreateUserProfile };
