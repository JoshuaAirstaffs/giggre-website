import "server-only";
import { cert, getApps, getApp, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

let app: App | undefined;

function getAdminApp(): App {
  if (app) return app;
  if (getApps().length) {
    app = getApp();
    return app;
  }

  const useDevProject = process.env.NEXT_PUBLIC_FIREBASE_DB_ENV === "dev";
  const projectId = useDevProject ? process.env.FIREBASE_DEV_PROJECT_ID : process.env.FIREBASE_PROJECT_ID;
  const clientEmail = useDevProject ? process.env.FIREBASE_DEV_CLIENT_EMAIL : process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (useDevProject ? process.env.FIREBASE_DEV_PRIVATE_KEY : process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    const prefix = useDevProject ? "FIREBASE_DEV_" : "FIREBASE_";
    throw new Error(
      `Missing Firebase Admin credentials. Set ${prefix}PROJECT_ID, ${prefix}CLIENT_EMAIL, and ${prefix}PRIVATE_KEY (from a Firebase service account key).`
    );
  }

  app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return app;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}
