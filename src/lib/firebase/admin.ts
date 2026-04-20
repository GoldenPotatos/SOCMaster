import * as admin from 'firebase-admin';

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!admin.apps.length) {
  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  } else {
    console.warn("Firebase Admin environment variables missing. Initializing with default config for build phase.");
    admin.initializeApp({
      projectId: projectId || "demo-project"
    });
  }
}

export const adminAuth = admin.auth();
