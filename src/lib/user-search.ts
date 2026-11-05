import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Mirrors giggre_app's lib/features/chat/user_search_service.dart — "Find
// anyone on Giggre by name and message them." Reads only publicProfiles/{uid}
// (mirrored from users/{uid} by functions/src/directMessages.ts's
// syncPublicProfile), never the private users doc, so this can never hand
// back an email, phone or location. People who turned off "Let others find
// me" (users/{uid}.searchable = false) don't appear.

// Longest prefix stored per word (MAX_PREFIX in directMessages.ts) — longer
// queries are cut to it before matching.
const MAX_PREFIX = 15;

/** Lowercase, accents removed, single-spaced — must match the server. */
export function normalizeUserName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export interface UserSearchResult {
  uid: string;
  name: string;
  photoUrl: string;
  isVerified: boolean;
  workerRating: number | null;
  workerRatingCount: number;
  hostRating: number | null;
  hostRatingCount: number;
}

function parseRating(v: unknown): { average: number | null; count: number } {
  if (!v || typeof v !== "object") return { average: null, count: 0 };
  const r = v as Record<string, unknown>;
  const count = typeof r.count === "number" ? r.count : 0;
  return count > 0 ? { average: typeof r.average === "number" ? r.average : 0, count } : { average: null, count: 0 };
}

/** Which reputation says more about them — mirrors UserSearchResult.mostlyHost. */
export function mostlyHost(r: Pick<UserSearchResult, "workerRatingCount" | "hostRatingCount">): boolean {
  return r.hostRatingCount > r.workerRatingCount;
}

// Searchable people whose name starts with `rawQuery` (any word, or the
// whole name). Leaves out the caller and anyone already excluded (e.g.
// blocked, or already shown as a favorite).
export async function searchUsers(myUid: string, rawQuery: string, excludeUids: Set<string> = new Set()): Promise<UserSearchResult[]> {
  let key = normalizeUserName(rawQuery);
  if (key.length < 2) return [];
  if (key.length > MAX_PREFIX) key = key.slice(0, MAX_PREFIX);

  const snap = await getDocs(
    query(collection(db, "publicProfiles"), where("searchable", "==", true), where("nameKeys", "array-contains", key), limit(30))
  );
  return snap.docs
    .filter((d) => d.id !== myUid && !excludeUids.has(d.id))
    .map((d): UserSearchResult => {
      const data = d.data();
      const worker = parseRating(data.ratingWorker);
      const host = parseRating(data.ratingHost);
      return {
        uid: d.id,
        name: (data.name as string | undefined) ?? "",
        photoUrl: (data.photoUrl as string | undefined) ?? "",
        isVerified: data.isVerified === true,
        workerRating: worker.average,
        workerRatingCount: worker.count,
        hostRating: host.average,
        hostRatingCount: host.count,
      };
    })
    .filter((r) => r.name.length > 0);
}
