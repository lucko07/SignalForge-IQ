import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";

export type UserProfile = {
  uid: string;
  fullName: string;
  email: string;
  plan: "free";
  role: "member";
};

export type Signal = {
  id: string;
  symbol: string;
  assetType: string;
  direction: string;
  entry: string;
  stopLoss: string;
  target: string;
  thesis: string;
  status: string;
  createdAt?: unknown;
};

export const createUserProfile = async ({
  uid,
  fullName,
  email,
  plan = "free",
  role = "member",
}: UserProfile) => {
  await setDoc(doc(db, "users", uid), {
    uid,
    fullName,
    email,
    plan,
    role,
    createdAt: serverTimestamp(),
  });
};

export const getUserProfile = async (uid: string) => {
  const snapshot = await getDoc(doc(db, "users", uid));

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data() as UserProfile & { createdAt?: unknown };
};

export const getSignals = async () => {
  const signalsQuery = query(
    collection(db, "signals"),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(signalsQuery);

  return snapshot.docs.map((signalDocument) => {
    const data = signalDocument.data();

    return {
      id: signalDocument.id,
      symbol: String(data.symbol ?? ""),
      assetType: String(data.assetType ?? ""),
      direction: String(data.direction ?? ""),
      entry: String(data.entry ?? ""),
      stopLoss: String(data.stopLoss ?? ""),
      target: String(data.target ?? ""),
      thesis: String(data.thesis ?? ""),
      status: String(data.status ?? ""),
      createdAt: data.createdAt,
    } satisfies Signal;
  });
};
