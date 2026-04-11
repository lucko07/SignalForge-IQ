import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 ?? "";

function getFirebaseAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const serviceAccount = loadServiceAccountFromBase64();

  return initializeApp({
    credential: cert(serviceAccount),
  });
}

function loadServiceAccountFromBase64() {
  if (!serviceAccountBase64.trim()) {
    throw new Error("Missing Firebase Admin credentials.");
  }

  let decodedJson;

  try {
    decodedJson = Buffer.from(serviceAccountBase64, "base64").toString("utf8");
  } catch (error) {
    throw new Error(`Firebase Admin credentials could not be decoded: ${getErrorMessage(error)}`);
  }

  let serviceAccount;

  try {
    serviceAccount = JSON.parse(decodedJson);
  } catch (error) {
    throw new Error(`Firebase Admin credentials are not valid JSON: ${getErrorMessage(error)}`);
  }

  if (!isValidServiceAccount(serviceAccount)) {
    throw new Error("Firebase Admin credentials are missing required fields.");
  }

  return serviceAccount;
}

function isValidServiceAccount(value) {
  return Boolean(value)
    && typeof value === "object"
    && typeof value.project_id === "string"
    && value.project_id.trim()
    && typeof value.client_email === "string"
    && value.client_email.trim()
    && typeof value.private_key === "string"
    && value.private_key.trim();
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

const adminApp = getFirebaseAdminApp();
const adminDb = getFirestore(adminApp);

export { adminDb, FieldValue };
