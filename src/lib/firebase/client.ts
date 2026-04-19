/**
 * Firebase Client SDK Configuration
 *
 * This module initializes the Firebase client-side SDK for use in browser contexts.
 * It uses NEXT_PUBLIC_ environment variables which are safe to expose to the client.
 *
 * SECURITY NOTE: These are public credentials scoped by Firebase Security Rules.
 * They do NOT grant admin access. Server-side operations use firebase-admin instead.
 */

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase only once (prevents hot-reload duplicates)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
// Request additional scopes for security context
googleProvider.setCustomParameters({
  prompt: "select_account",
});

export default app;
