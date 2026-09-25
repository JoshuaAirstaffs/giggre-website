import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RatingAggregate } from "@/lib/ratings";

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

// Mirrors the real `users/{uid}` document shape in Firestore — includes both
// what registration.ts writes at signup and the fields the rest of the app
// (profile editing, presence, notifications) adds later. Firestore-specific
// types (Timestamp, GeoPoint) are normalized to plain serializable shapes so
// this stays JSON-safe for redux-persist.
export interface UserProfile {
  userId?: string;
  name?: string;
  email?: string;
  phone?: string;
  photoUrl?: string;
  bio?: string;
  company?: string;
  role?: string;
  balance?: number;
  currencyCode?: string;
  createdAt?: string;
  updatedAt?: string;
  skills?: string[];
  skillsXP?: Record<string, number>;
  signInMethod?: "email" | "google" | "apple";
  // Maintained by the shared Cloud Function (functions/src/ratings.ts
  // onRatingCreated) from the `ratings` collection — see ratings.ts's own
  // comment. Absent entirely until the user's first rating; never defaulted
  // to a flat number here, use ratingAverage() at read time instead.
  ratingWorker?: RatingAggregate;
  ratingHost?: RatingAggregate;
  isVerified?: string;
  isOnline?: boolean;
  // Written by giggre_app's dashboard toggles (dashboard_summary_card.dart) —
  // `availableForGigs` gates whether the worker can be matched to gigs at
  // all; `seekingQuickGigs` opts into the Quick Gig auto-matching pool and
  // forces `availableForGigs` on when enabled; `autoAccept` skips the manual
  // accept/decline review window for incoming Quick Gig dispatches.
  availableForGigs?: boolean;
  seekingQuickGigs?: boolean;
  autoAccept?: boolean;
  openGigsUnlocked?: boolean;
  // Written by giggre_app's decline-suspension flow (gig_worker_screen.dart)
  // when a worker declines too many Quick Gigs in a day — read-only here,
  // same as the app's own Settings screen. `suspended_until` is a Timestamp
  // in Firestore, sanitized to an ISO string by ReduxProvider before it
  // reaches this state. `decline_count` only counts today's declines; it's
  // stale (should read as 0) once `decline_count_date` isn't today.
  suspended_until?: string;
  decline_count?: number;
  decline_count_date?: string;
  fcmTokens?: string[];
  location?: { latitude: number; longitude: number };
  referredBy?: string | null;
  // Written by giggre_app/lib/core/services/earnings_service.dart alongside
  // each gig completion — `total` is lifetime, `weekly` resets when
  // `currentWeek` (an ISO week label, e.g. "2026-W28") rolls over.
  earnings?: {
    total?: Record<string, number>;
    weekly?: Record<string, number>;
    currentWeek?: string;
    completedGigs?: number;
    updatedAt?: string;
  };
  referrals?: {
    referral_code?: string;
    referral_level?: number;
    referrals_count?: number;
    verified_referrals?: number;
    not_verified_referrals?: number;
    pending_referrals?: number;
    cancelled_referrals?: number;
    rejected_referrals?: number;
    referredByUID?: string | null;
    referredByName?: string | null;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface UserState {
  authUser: AuthUser | null;
  profile: UserProfile | null;
  status: AuthStatus;
}

const initialState: UserState = {
  authUser: null,
  profile: null,
  status: "loading",
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setAuthUser(state, action: PayloadAction<AuthUser>) {
      state.authUser = action.payload;
      state.status = "authenticated";
    },
    setProfile(state, action: PayloadAction<UserProfile | null>) {
      state.profile = action.payload;
    },
    mergeProfile(state, action: PayloadAction<Partial<UserProfile>>) {
      state.profile = { ...state.profile, ...action.payload };
    },
    clearUser(state) {
      state.authUser = null;
      state.profile = null;
      state.status = "unauthenticated";
    },
  },
});

export const { setAuthUser, setProfile, mergeProfile, clearUser } = userSlice.actions;
export default userSlice.reducer;
