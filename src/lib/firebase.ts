import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfigValues = {
  VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const missingFirebaseConfigKeys = Object.entries(firebaseConfigValues)
  .filter(([, value]) => typeof value !== "string" || !value.trim())
  .map(([key]) => key);

export const hasRequiredFirebaseClientConfig = missingFirebaseConfigKeys.length === 0;

const firebaseConfig = {
  apiKey: firebaseConfigValues.VITE_FIREBASE_API_KEY ?? "missing-api-key",
  authDomain: firebaseConfigValues.VITE_FIREBASE_AUTH_DOMAIN ?? "missing-auth-domain",
  projectId: firebaseConfigValues.VITE_FIREBASE_PROJECT_ID ?? "missing-project-id",
  storageBucket: firebaseConfigValues.VITE_FIREBASE_STORAGE_BUCKET ?? "missing-storage-bucket",
  messagingSenderId:
    firebaseConfigValues.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "missing-messaging-sender-id",
  appId: firebaseConfigValues.VITE_FIREBASE_APP_ID ?? "missing-app-id",
};

const app = initializeApp(firebaseConfig);
const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY;
const appCheckDebugToken = import.meta.env.VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN;
let appCheckInitialized = false;

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

export function initializeFirebaseAppCheck() {
  if (appCheckInitialized || typeof window === "undefined") {
    return;
  }

  if (typeof appCheckSiteKey !== "string" || !appCheckSiteKey.trim()) {
    return;
  }

  if (typeof appCheckDebugToken === "string" && appCheckDebugToken.trim()) {
    window.FIREBASE_APPCHECK_DEBUG_TOKEN = appCheckDebugToken.trim() === "true"
      ? true
      : appCheckDebugToken.trim();
  }

  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey.trim()),
      isTokenAutoRefreshEnabled: true,
    });

    appCheckInitialized = true;
  } catch {
    appCheckInitialized = false;
  }
}

export default app;

declare global {
  interface Window {
    FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean;
  }
}

