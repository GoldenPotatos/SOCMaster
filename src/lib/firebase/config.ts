import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app;
let db: ReturnType<typeof getFirestore>;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  // Using initializeFirestore with experimentalForceLongPolling to handle
  // potential WebSocket connectivity issues in restricted environments.
  db = initializeFirestore(app, { experimentalForceLongPolling: true });
} else {
  app = getApp();
  // We use getFirestore. If initializeFirestore was already called, 
  // it returns the same instance with previous settings.
  db = getFirestore(app);
}

const auth = getAuth(app);
export { app, auth, db };
