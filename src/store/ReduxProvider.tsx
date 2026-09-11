"use client";

import { useEffect, type ReactNode } from "react";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { onAuthStateChanged } from "firebase/auth";
import { GeoPoint, Timestamp } from "firebase/firestore";
import { auth } from "@/lib/firebase";
import { getUserProfile } from "@/lib/registration";
import { store, persistor } from "./store";
import { useAppDispatch } from "./hooks";
import { setAuthUser, setProfile, clearUser, type UserProfile } from "./userSlice";

// Firestore Timestamps and GeoPoints aren't plain-serializable, so Redux
// flags any that slip into a dispatched action. Rather than whitelisting the
// specific fields we know about (createdAt, location, earnings.updatedAt...),
// walk the whole doc and convert every instance wherever it appears — this
// also covers fields stamped by admin/App-Check tooling outside this app
// (e.g. a top-level `debugTokenCheckedAt`) that we'd otherwise miss one at a
// time as they show up.
function sanitizeValue(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof GeoPoint) return { latitude: value.latitude, longitude: value.longitude };
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, sanitizeValue(v)]));
  }
  return value;
}

function sanitizeProfile(data: Record<string, unknown> | null): UserProfile | null {
  if (!data) return null;
  return sanitizeValue(data) as UserProfile;
}

function FirebaseAuthListener() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
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

      try {
        const profile = await getUserProfile(firebaseUser.uid);
        dispatch(setProfile(sanitizeProfile(profile)));
      } catch (err) {
        console.error("Failed to load user profile:", err);
      }
    });

    return unsubscribe;
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
