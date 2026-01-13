import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const isConfigured = Boolean(import.meta.env.VITE_FIREBASE_API_KEY);

let app;
let auth;
let db;

if (isConfigured) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
} else {
  // Warn but don't throw so dev server can run without env values
  // Developers should add values to `.env.local` (Vite uses `import.meta.env`)
  // Example keys: VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, etc.
  // See README for instructions.
  // eslint-disable-next-line no-console
  console.warn(
    "Firebase not configured. Add VITE_FIREBASE_* values to .env.local to enable Firebase."
  );
}

export { app, auth, db, isConfigured };

export async function signInWithGoogle() {
  if (!isConfigured || !auth) throw new Error("Firebase not configured");
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}
