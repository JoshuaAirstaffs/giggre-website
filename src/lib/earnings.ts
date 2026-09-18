import { collection, collectionGroup, doc, getDoc, getDocs, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Mirrors the worker app's completed-gig sources — see
// giggre_app/lib/features/gig_worker/presentation/gig_history_screen.dart.
// There's no "this month" bucket anywhere in Firestore (earnings_service.dart
// only tracks lifetime `total` and a lazily-reset `weekly`), so month/week
// breakdowns have to be computed client-side from the raw completed gigs.
const COMPLETED_GIG_COLLECTIONS = ["quick_gigs", "open_gigs", "offered_gigs"];

// Multi-worker completions live on a `workers` subcollection doc, which has
// no `title` field of its own (see WorkerSlotModel) — fall back to a label
// derived from which parent collection it belongs to.
const GIG_TYPE_LABELS: Record<string, string> = {
  quick_gigs: "Quick Gig",
  open_gigs: "Open Gig",
  offered_gigs: "Offered Gig",
};

// Matches the `key` used by the marketing site's gigTypes (src/lib/content.ts)
// so the same quick/open/offered color coding from "How it works" applies here.
export type GigTypeKey = "quick" | "open" | "offered";

const GIG_TYPE_KEYS: Record<string, GigTypeKey> = {
  quick_gigs: "quick",
  open_gigs: "open",
  offered_gigs: "offered",
};

// Same quick/open/offered color coding as the "How it works" section
// (src/components/HowItWorks.tsx, src/lib/content.ts).
export const GIG_TYPE_BADGE_CLASSES: Record<GigTypeKey, string> = {
  quick: "bg-(--quick-tint) text-(--quick-text)",
  open: "bg-(--worker-tint) text-(--worker-text)",
  offered: "bg-(--offered-tint) text-(--offered-text)",
};

export interface CompletedEntry {
  completedAt: Date;
  amount: number;
  currencyCode: string;
  title: string;
  hostName: string;
  address: string;
  gigType: string;
  gigTypeKey: GigTypeKey | null;
  workerSlots: number;
  // Only meaningfully populated by fetchHostCompletedEntries (which spans
  // every worker a host has paid) — fetchCompletedEntries is already
  // filtered to a single worker by its `uid` param, so callers there don't
  // need this.
  workerId?: string;
}

export async function fetchCompletedEntries(uid: string): Promise<CompletedEntry[]> {
  const perCollection = await Promise.all(
    COMPLETED_GIG_COLLECTIONS.map(async (name) => {
      const snap = await getDocs(
        query(collection(db, name), where("workerId", "==", uid), where("status", "==", "completed"))
      );
      return snap.docs.map((d) => {
        const data = d.data();
        const completedAt: Timestamp | undefined = data.completedAt ?? data.createdAt;
        return {
          completedAt: completedAt?.toDate() ?? new Date(),
          amount: (data.budget as number | undefined) ?? 0,
          currencyCode: (data.currencyCode as string | undefined) ?? "USD",
          title: (data.title as string | undefined) || GIG_TYPE_LABELS[name],
          hostName: (data.hostName as string | undefined) ?? "",
          address: (data.address as string | undefined) ?? "",
          gigType: GIG_TYPE_LABELS[name],
          gigTypeKey: GIG_TYPE_KEYS[name],
          workerSlots: (data.workerSlots as number | undefined) ?? 1,
        };
      });
    })
  );

  // Multi-worker gigs: this worker's completion lives on a `workers`
  // subcollection doc (with `rate` instead of `budget`), not on the parent
  // gig's top-level fields — and it has no title/address/workerSlots of its
  // own (see WorkerSlotModel), so those come from one extra read of the
  // parent gig doc, same as giggre_app's _fetchMultiWorkerCompletions.
  const workersSnap = await getDocs(
    query(collectionGroup(db, "workers"), where("workerId", "==", uid), where("status", "==", "completed"))
  );
  const multiWorker = await Promise.all(
    workersSnap.docs.map(async (d) => {
      const data = d.data();
      const completedAt: Timestamp | undefined = data.completedAt ?? data.acceptedAt;
      const gigCollection = data.gigCollection as string | undefined;
      const gigId = data.gigId as string | undefined;
      const gigType = (gigCollection && GIG_TYPE_LABELS[gigCollection]) || "Gig";

      const gigData =
        gigCollection && gigId ? (await getDoc(doc(db, gigCollection, gigId))).data() : undefined;

      return {
        completedAt: completedAt?.toDate() ?? new Date(),
        amount: (data.rate as number | undefined) ?? 0,
        currencyCode: (data.currencyCode as string | undefined) ?? "USD",
        title: (gigData?.title as string | undefined) || gigType,
        hostName: (data.hostName as string | undefined) ?? (gigData?.hostName as string | undefined) ?? "",
        address: (gigData?.address as string | undefined) ?? "",
        gigType,
        gigTypeKey: (gigCollection && GIG_TYPE_KEYS[gigCollection]) || null,
        workerSlots: (gigData?.workerSlots as number | undefined) ?? 1,
      };
    })
  );

  return [...perCollection.flat(), ...multiWorker];
}

// Host-side mirror of fetchCompletedEntries above — same shape, same
// single-vs-multi-slot split, just filtered by `hostId` (what this host has
// paid out) instead of `workerId` (what a worker has earned). Used for the
// host dashboard's spend chart.
export async function fetchHostCompletedEntries(hostId: string): Promise<CompletedEntry[]> {
  const perCollection = await Promise.all(
    COMPLETED_GIG_COLLECTIONS.map(async (name) => {
      const snap = await getDocs(
        query(collection(db, name), where("hostId", "==", hostId), where("status", "==", "completed"))
      );
      return snap.docs
        // A genuine multi-slot gig (workerSlots > 1) flips its own top-level
        // `status` to 'completed' once every filled slot finishes (see
        // host_payment_code_sheet.dart) — but each of its slots is already
        // its own entry below via the `workers` collectionGroup query.
        // Counting the parent doc here too would double the spend for every
        // multi-slot gig this host has ever completed.
        .filter((d) => ((d.data().workerSlots as number | undefined) ?? 1) <= 1)
        .map((d) => {
          const data = d.data();
          const completedAt: Timestamp | undefined = data.completedAt ?? data.createdAt;
          return {
            completedAt: completedAt?.toDate() ?? new Date(),
            amount: (data.budget as number | undefined) ?? 0,
            currencyCode: (data.currencyCode as string | undefined) ?? "USD",
            title: (data.title as string | undefined) || GIG_TYPE_LABELS[name],
            hostName: (data.hostName as string | undefined) ?? "",
            address: (data.address as string | undefined) ?? "",
            gigType: GIG_TYPE_LABELS[name],
            gigTypeKey: GIG_TYPE_KEYS[name],
            workerSlots: (data.workerSlots as number | undefined) ?? 1,
            // Quick gigs use assignedWorkerId; open/offered use workerId
            // directly (see the respective *_gig_model.dart).
            workerId: (data.workerId as string | undefined) ?? (data.assignedWorkerId as string | undefined) ?? "",
          };
        });
    })
  );

  // Multi-worker gigs: each paid worker slot is its own completion record
  // (with `rate` instead of `budget`) — one dashboard "spend" entry per
  // worker paid, not per gig, same as the worker-side reader.
  const workersSnap = await getDocs(
    query(collectionGroup(db, "workers"), where("hostId", "==", hostId), where("status", "==", "completed"))
  );
  const multiWorker = await Promise.all(
    workersSnap.docs.map(async (d) => {
      const data = d.data();
      const completedAt: Timestamp | undefined = data.completedAt ?? data.selectedAt;
      const gigCollection = data.gigCollection as string | undefined;
      const gigId = data.gigId as string | undefined;
      const gigType = (gigCollection && GIG_TYPE_LABELS[gigCollection]) || "Gig";

      const gigData =
        gigCollection && gigId ? (await getDoc(doc(db, gigCollection, gigId))).data() : undefined;

      return {
        completedAt: completedAt?.toDate() ?? new Date(),
        amount: (data.rate as number | undefined) ?? 0,
        currencyCode: (data.currencyCode as string | undefined) ?? "USD",
        title: (gigData?.title as string | undefined) || gigType,
        hostName: "",
        address: (gigData?.address as string | undefined) ?? "",
        gigType,
        gigTypeKey: (gigCollection && GIG_TYPE_KEYS[gigCollection]) || null,
        workerSlots: (gigData?.workerSlots as number | undefined) ?? 1,
        workerId: (data.workerId as string | undefined) ?? "",
      };
    })
  );

  return [...perCollection.flat(), ...multiWorker];
}

export function startOfWeek(now: Date) {
  const day = now.getDay(); // 0 = Sun .. 6 = Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() + diffToMonday);
  return monday;
}

export function startOfPreviousWeek(now: Date) {
  const start = startOfWeek(now);
  start.setDate(start.getDate() - 7);
  return start;
}

export function startOfMonth(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function startOfPreviousMonth(now: Date) {
  return new Date(now.getFullYear(), now.getMonth() - 1, 1);
}

/**
 * Sums `amount` for entries in [from, to) across all currency codes.
 * `currencyCode` on a gig doc silently defaults to "USD" when the field is
 * missing (see `fetchCompletedEntries`), so filtering by a single currency
 * key drops those entries — everyone on this app earns in one real currency,
 * so summing regardless of the (possibly wrong) per-entry code is correct.
 * `to === null` means no upper bound.
 */
export function sumAmountBetween(entries: CompletedEntry[], from: Date, to: Date | null): number {
  let total = 0;
  for (const entry of entries) {
    if (entry.completedAt < from) continue;
    if (to && entry.completedAt >= to) continue;
    total += entry.amount;
  }
  return total;
}
