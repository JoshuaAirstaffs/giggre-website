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

function sanitizeProfile(data: Record<string, unknown> | null): UserProfile | null {
  if (!data) return null;
  const { createdAt, updatedAt, location, earnings, ...rest } = data;
  const earningsData = earnings as Record<string, unknown> | undefined;
  return {
    ...rest,
    createdAt: createdAt instanceof Timestamp ? createdAt.toDate().toISOString() : undefined,
    // Some fields (e.g. a top-level `updatedAt` stamped by admin tooling
    // outside this app) can be raw Firestore Timestamps we don't otherwise
    // account for — Redux flags those as non-serializable, so normalize here.
    updatedAt: updatedAt instanceof Timestamp ? updatedAt.toDate().toISOString() : undefined,
    location:
      location instanceof GeoPoint
        ? { latitude: location.latitude, longitude: location.longitude }
        : undefined,
    earnings: earningsData
      ? {
          ...earningsData,
          updatedAt:
            earningsData.updatedAt instanceof Timestamp
              ? earningsData.updatedAt.toDate().toISOString()
              : undefined,
        }
      : undefined,
  };
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
