import { arrayRemove, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface BlockedUser {
  uid: string;
  userId: string;
  name: string;
  photoUrl: string;
  isVerified: boolean;
}

function toBlockedUser(uid: string, data: Record<string, unknown>): BlockedUser {
  return {
    uid,
    userId: (data.userId as string) ?? "",
    name: (data.name as string) || "Unknown",
    photoUrl: (data.photoUrl as string) ?? "",
    isVerified: (data.isVerified as string | undefined) === "verified",
  };
}

// Powers the "Blocked Users" page — reads the current user's own
// `blockedUsers` array and resolves each id to a user doc, same
// fetch-then-resolve shape as fetchFavoriteWorkers in post-gig.ts. Skips ids
// that no longer resolve to a user (e.g. a deleted account).
export async function fetchBlockedUsers(uid: string): Promise<BlockedUser[]> {
  const snap = await getDoc(doc(db, "users", uid));
  const ids = (snap.data()?.blockedUsers as string[] | undefined) ?? [];
  if (ids.length === 0) return [];

  const docs = await Promise.all(ids.map((id) => getDoc(doc(db, "users", id))));
  return docs.filter((d) => d.exists()).map((d) => toBlockedUser(d.id, d.data()!));
}

// Mirrors the unblock action in blocked_users_screen.dart — writes only to
// the current user's own doc via arrayRemove.
export async function unblockUser(uid: string, blockedUid: string): Promise<void> {
  await updateDoc(doc(db, "users", uid), { blockedUsers: arrayRemove(blockedUid) });
}
