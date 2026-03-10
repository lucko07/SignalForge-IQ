import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAzE7Z_RnURO7gNBtNQEaFaFWA7X0V-pqI",
  authDomain: "signalforge-iq-3ff7f.firebaseapp.com",
  projectId: "signalforge-iq-3ff7f",
  storageBucket: "signalforge-iq-3ff7f.firebasestorage.app",
  messagingSenderId: "1090367706100",
  appId: "1:1090367706100:web:d0272d47268274188bdfa1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;

