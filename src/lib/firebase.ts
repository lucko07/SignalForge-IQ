import { initializeApp } from "firebase/app";
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

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

export default app;

