import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { REFERRAL_MILESTONES } from "@/lib/registration";

export { REFERRAL_MILESTONES };
export const TOTAL_REFERRAL_LEVELS = REFERRAL_MILESTONES.length;

export interface MilestoneProgress {
  label: string | null;
  nextLabel: string | null;
  nextThreshold: number | null;
  remaining: number;
  progress: number;
  maxed: boolean;
}

// Mirrors my_referral_screen.dart's hero-card progress calculation (used for
// both its "Referral Code" tab and "Roadmap" tab headers — that file computes
// the roadmap one from `referral_level`'s bracket instead, but since level is
// always derived from count (see registration.ts's updateReferralLevel),
// driving both off `referrals_count` directly is equivalent and simpler.
export function milestoneProgress(referralsCount: number): MilestoneProgress {
  const reached = [...REFERRAL_MILESTONES].reverse().find((m) => referralsCount >= m.referrals);
  const next = REFERRAL_MILESTONES.find((m) => referralsCount < m.referrals);

  if (!next) {
    return { label: reached?.label ?? null, nextLabel: null, nextThreshold: null, remaining: 0, progress: 1, maxed: true };
  }

  const prevThreshold = reached?.referrals ?? 0;
  const progress = (referralsCount - prevThreshold) / (next.referrals - prevThreshold);

  return {
    label: reached?.label ?? null,
    nextLabel: next.label,
    nextThreshold: next.referrals,
    remaining: next.referrals - referralsCount,
    progress: Math.min(1, Math.max(0, progress)),
    maxed: false,
  };
}

export interface ReferredPerson {
  uid: string;
  name: string;
  email: string;
  joinedAt: Date | null;
  isVerified: string;
}

export const REFERRALS_PAGE_SIZE = 15;

// Mirrors _PeopleReferredTab's list query in my_referral_screen.dart:
// users/{uid}/referrals_list ordered by joined_at desc, paginated, with a
// follow-up read of each referred user's own `isVerified` (the source of
// truth — the mirrored field on the referrals_list doc can lag behind it
// until onVerificationChange's Cloud Function catches up).
export async function fetchReferredPeople(
  uid: string,
  cursor: QueryDocumentSnapshot | null = null
): Promise<{ people: ReferredPerson[]; cursor: QueryDocumentSnapshot | null; hasMore: boolean }> {
  const base = query(collection(db, "users", uid, "referrals_list"), orderBy("joined_at", "desc"), limit(REFERRALS_PAGE_SIZE));
  const snap = await getDocs(cursor ? query(base, startAfter(cursor)) : base);

  const people = await Promise.all(
    snap.docs.map(async (d): Promise<ReferredPerson> => {
      const data = d.data();
      const userSnap = await getDoc(doc(db, "users", d.id));
      return {
        uid: d.id,
        name: (data.name as string | undefined) ?? "",
        email: (data.email as string | undefined) ?? "",
        joinedAt: (data.joined_at as Timestamp | undefined)?.toDate() ?? null,
        isVerified: (userSnap.data()?.isVerified as string | undefined) ?? "unverified",
      };
    })
  );

  return {
    people,
    cursor: snap.docs.at(-1) ?? null,
    hasMore: snap.docs.length === REFERRALS_PAGE_SIZE,
  };
}
