"use client";

import { useEffect, type ReactNode } from "react";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { sanitizeFirestoreData } from "@/lib/firestore-sanitize";
import { store, persistor } from "./store";
import { useAppDispatch } from "./hooks";
import { setAuthUser, setProfile, clearUser, type UserProfile } from "./userSlice";

function sanitizeProfile(data: Record<string, unknown> | null): UserProfile | null {
  if (!data) return null;
  return sanitizeFirestoreData(data) as UserProfile;
}

function FirebaseAuthListener() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    let unsubscribeProfile: Unsubscribe | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      unsubscribeProfile?.();
      unsubscribeProfile = null;

      if (!firebaseUser) {
        dispatch(clearUser());
        return;
      }

      dispatch(
        setAuthUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        })
      );

      // A live subscription (rather than a one-time getDoc) so the store
      // never gets stuck on a pre-registration "no doc yet" snapshot — right
      // after signup the profile doc is still being written when auth state
      // first fires, and this listener re-delivers the real data the moment
      // it lands instead of silently keeping the earlier null read.
      unsubscribeProfile = onSnapshot(
        doc(db, "users", firebaseUser.uid),
        (snap) => dispatch(setProfile(sanitizeProfile(snap.exists() ? snap.data() : null))),
        (err) => console.error("Failed to load user profile:", err)
      );
    });

    return () => {
      unsubscribeProfile?.();
      unsubscribeAuth();
    };
  }, [dispatch]);

  return null;
}

export default function ReduxProvider({ children }: { children: ReactNode }) {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <FirebaseAuthListener />
        {children}
      </PersistGate>
    </Provider>
  );
}
