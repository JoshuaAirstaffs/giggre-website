import { useCallback } from "react";
import { updateUserProfile } from "@/lib/registration";
import { useAppDispatch, useAppSelector } from "./hooks";
import { mergeProfile, type UserProfile } from "./userSlice";

/**
 * Writes partial changes to `users/{uid}` in Firestore, then applies the
 * same partial update to the Redux store on success — so callers never have
 * to remember to touch both places, and the store never drifts from Firestore
 * if the write fails.
 */
export function useUpdateProfile() {
  const dispatch = useAppDispatch();
  const uid = useAppSelector((s) => s.user.authUser?.uid);

  return useCallback(
    async (updates: Partial<UserProfile>) => {
      if (!uid) throw new Error("No signed-in user to update.");
      await updateUserProfile(uid, updates);
      dispatch(mergeProfile(updates));
    },
    [uid, dispatch]
  );
}
