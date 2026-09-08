import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, OAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const prodFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

// simpleproject-8ff7a — toggled via `npm run dev:dev` / `npm run dev:prod`
// (see package.json). Auth + Firestore both switch together; the matching
// service account in firebaseAdmin.ts must switch with it or session
// verification (verifyIdToken/verifySessionCookie) will reject the tokens.
const devFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_DEV_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_DEV_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_DEV_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_DEV_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_DEV_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_DEV_APP_ID!,
};

const useDevProject = process.env.NEXT_PUBLIC_FIREBASE_DB_ENV === "dev";
const firebaseConfig = useDevProject ? devFirebaseConfig : prodFirebaseConfig;

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("email");
googleProvider.addScope("profile");
googleProvider.setCustomParameters({ prompt: "select_account" });

// Requires "Sign in with Apple" to be enabled under Firebase Console >
// Authentication > Sign-in method, with a registered Services ID, Team ID,
// Key ID, and private key from the Apple Developer portal, plus this
// domain added to the Services ID's authorized return URLs — without that
// configuration, signInWithPopup(auth, appleProvider) will fail at runtime
// even though this client code is otherwise complete.
export const appleProvider = new OAuthProvider("apple.com");
appleProvider.addScope("email");
appleProvider.addScope("name");
