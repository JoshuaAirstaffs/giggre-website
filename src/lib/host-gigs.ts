import {
  GeoPoint,
  Timestamp,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ActionResult } from "@/lib/browse-gigs";
import { fetchHostCompletedEntries, type GigTypeKey } from "@/lib/earnings";

export const HOST_GIG_COLLECTIONS: Record<GigTypeKey, string> = {
  quick: "quick_gigs",
  open: "open_gigs",
  offered: "offered_gigs",
};

// Gig-level statuses the "Open — awaiting applicants" stat tile (My Gigs
// list, host dashboard) counts as still needing/having open slots — a
// filled open_gig has its slots staffed but hasn't necessarily started or
// finished the actual work yet, so it stays in this bucket too.
export const OPEN_CARD_STATUSES = new Set(["open", "filled"]);

// Terminal gig-level statuses — anything else counts as "active" for
// dashboard purposes (still open, in progress, or awaiting payment).
const TERMINAL_GIG_STATUSES = new Set(["completed", "cancelled", "declined", "no_worker"]);

export function isActiveGigStatus(status: string): boolean {
  return !TERMINAL_GIG_STATUSES.has(status);
}

function toLatLng(geo: GeoPoint | undefined): { lat: number; lng: number } | null {
  return geo ? { lat: geo.latitude, lng: geo.longitude } : null;
}

export interface HostGig {
  id: string;
  gigType: GigTypeKey;
  title: string;
  status: string;
  budget: number;
  currencyCode: string;
  address: string;
  workerSlots: number;
  filledSlotCount: number;
  createdAt: Date | null;
  scheduledDate: Date | null;
  // Pending applicants (open_gigs only — see ApplicantEntry in
  // browse-gigs.ts) not yet accepted. Read straight off the same doc, so
  // this costs nothing extra even for the lightweight list fetch.
  applicantCount: number;
}

// Statuses that mean a slot isn't actually occupied (mirrors
// WorkerSlotModel.terminalStatuses in worker_slot_model.dart, minus
// 'completed' — a completed slot was filled, just finished).
const UNFILLED_WORKER_STATUSES = new Set(["declined", "cancelled", "no_worker"]);

function toHostGig(id: string, data: Record<string, unknown>, gigType: GigTypeKey): HostGig {
  const workerSlots = (data.workerSlots as number | undefined) ?? 1;
  const status = (data.status as string) ?? "";
  // filledSlotCount is only actively maintained for genuine multi-slot gigs
  // (the accept-flow explicitly increments it there); for a single-recipient
  // gig it's frequently just left at 0 even once a worker is assigned, so
  // derive it instead from whether a worker is actually attached.
  const hasAssignedWorker = Boolean(
    (data.workerId as string | undefined) ?? (data.assignedWorkerId as string | undefined)
  );
  const filledSlotCount =
    workerSlots > 1
      ? ((data.filledSlotCount as number | undefined) ?? 0)
      : hasAssignedWorker && !UNFILLED_WORKER_STATUSES.has(status)
        ? 1
        : 0;

  // `budget`/`ratePerSlot` are written identically at post time (see
  // commonGigFields in post-gig.ts) — both are the PER-WORKER rate, never a
  // total, for every gig type including multi-slot ones. The gig's actual
  // total cost is that rate times workerSlots, computed here rather than
  // read off a field that was never actually the total.
  const ratePerSlot = (data.ratePerSlot as number | undefined) ?? (data.budget as number | undefined) ?? 0;

  return {
    id,
    gigType,
    title: (data.title as string) || "Gig",
    status,
    budget: ratePerSlot * workerSlots,
    currencyCode: (data.currencyCode as string) ?? "USD",
    address: (data.address as string) ?? "",
    workerSlots,
    filledSlotCount,
    createdAt: (data.createdAt as Timestamp | undefined)?.toDate() ?? null,
    scheduledDate: (data.scheduledDate as Timestamp | undefined)?.toDate() ?? null,
    applicantCount: (data.applicants as unknown[] | undefined)?.length ?? 0,
  };
}

// Fetches every gig this host has ever posted, across all three types. A
// host's own gig list is a small, bounded dataset, so this reads all of it
// once and sorts/filters/paginates client-side rather than needing separate
// Firestore cursors per type — same simplicity tradeoff as
// workerHasGigWithStatus in browse-gigs.ts.
export async function fetchHostGigs(hostId: string): Promise<HostGig[]> {
  const results = await Promise.all(
    (Object.entries(HOST_GIG_COLLECTIONS) as [GigTypeKey, string][]).map(async ([gigType, collectionName]) => {
      const snap = await getDocs(query(collection(db, collectionName), where("hostId", "==", hostId)));
      return snap.docs.map((d) => toHostGig(d.id, d.data(), gigType));
    })
  );
  return results.flat().sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}

export interface WorkerHistoryEntry {
  id: string;
  gigType: GigTypeKey;
  title: string;
  status: string;
  at: Date;
}

// Powers the Favorites page's worker-profile drawer — a quick "have they
// actually delivered for me" track record. Reuses fetchHostCompletedEntries
// (already a proven hostId+status query with the composite index it needs)
// and filters client-side by workerId instead of adding a new three-field
// (hostId, workerId, status) query, which would need its own Firestore
// index. "Applied" only ever comes from open_gigs — quick/offered gigs are
// host-initiated and have no applicant list (see browse-gigs.ts).
export async function fetchWorkerHistoryWithHost(
  hostId: string,
  workerId: string
): Promise<{ applied: WorkerHistoryEntry[]; completed: WorkerHistoryEntry[] }> {
  const [completedEntries, openSnap] = await Promise.all([
    fetchHostCompletedEntries(hostId),
    getDocs(query(collection(db, "open_gigs"), where("hostId", "==", hostId))),
  ]);

  const completed: WorkerHistoryEntry[] = completedEntries
    .filter((e) => e.workerId === workerId)
    .map((e) => ({
      id: "",
      gigType: (e.gigTypeKey as GigTypeKey) ?? "open",
      title: e.title,
      status: "completed",
      at: e.completedAt,
    }));

  const applied: WorkerHistoryEntry[] = openSnap.docs
    .filter((d) => {
      const applicants = (d.data().applicants as { workerId: string }[] | undefined) ?? [];
      return applicants.some((a) => a.workerId === workerId);
    })
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        gigType: "open" as GigTypeKey,
        title: (data.title as string) || "Gig",
        status: (data.status as string) ?? "",
        at: (data.createdAt as Timestamp | undefined)?.toDate() ?? new Date(0),
      };
    });

  const byNewest = (a: WorkerHistoryEntry, b: WorkerHistoryEntry) => b.at.getTime() - a.at.getTime();
  return {
    applied: applied.sort(byNewest).slice(0, 3),
    completed: completed.sort(byNewest).slice(0, 3),
  };
}

export interface HostGigTimelineEntry {
  label: string;
  at: Date;
}

export interface HostGigWorkerEntry {
  workerId: string;
  workerName: string;
  photoUrl: string;
  // For a single-recipient gig this is just the gig's own status; for a
  // multi-slot gig it's that worker's own slot status (offered_gigs'
  // WorkerSlotModel / open_gigs' workers subcollection), which can differ
  // from the parent gig's overall status.
  status: string;
  // This worker's own journey on this gig — for a multi-slot gig, built
  // from WorkerSlotModel's timestamp fields (dispatchedAt through
  // hostRatedAt); for a single-recipient gig (no per-worker subcollection
  // doc to read from) just the one moment they were assigned, if known.
  timeline: HostGigTimelineEntry[];
  // From the worker's own users/{id} profile — a slot/applicant entry never
  // carries its own copy of this.
  skills: string[];
  // Set once this worker's status flips to 'working' (_startWork in
  // working_ui.dart) — lets the host see the same live elapsed-time timer
  // the worker sees on their own device, computed as now - workStartedAt.
  workStartedAt: Date | null;
  // Written by the worker's device only while status is 'navigating' (see
  // working_ui.dart's Geolocator stream) — stops updating (but isn't
  // cleared) the moment they arrive, so this is only meaningful to render
  // while status is still 'navigating'.
  workerLocation: { lat: number; lng: number } | null;
  // Set by confirmCashPayment once the host confirms cash was handed over
  // (status flips to 'payment') — lets the host re-open the QR/code screen
  // if they close it before the worker confirms, without generating a new
  // code (which would invalidate whatever the worker's already looking at).
  paymentCode: string | null;
  // From users/{id}.isVerified — a string enum in Firestore
  // ('unverified' | 'pending' | 'verified' | 'rejected'), but the only
  // comparison the app itself ever makes is exact equality against
  // 'verified' (see _verificationBadge in gig_detail_sheet.dart), so that's
  // collapsed to a plain boolean here.
  isVerified: boolean;
  // From the worker's own profile — same fields the applicant entry below
  // already carries, just also backfilled here so an "average worker
  // rating" for the gig can be shown without a separate read.
  ratingAsWorker: number;
  ratingCount: number;
}

export interface HostGigApplicantEntry {
  workerId: string;
  workerName: string;
  photoUrl: string;
  ratingAsWorker: number;
  ratingCount: number;
  skills: string[];
  isVerified: boolean;
}

export interface HostGigCancellationReason {
  reason: string;
  requestedBy: string;
  approved: boolean | null;
}

export interface HostGigCancellation {
  reasons: HostGigCancellationReason[];
  cancelledAt: Date | null;
  // Set instead of cancelledAt while a worker's cancellation request is
  // still awaiting admin review (see requestApplicationCancellation in
  // browse-gigs.ts) — the gig doesn't actually cancel until then.
  cancellationRequestedAt: Date | null;
  cancelledByAdmin: boolean;
  cancelledByAdminName: string;
  ticketId: string;
}

export interface HostGigDetail extends HostGig {
  hostName: string;
  description: string;
  location: { lat: number; lng: number } | null;
  ratePerSlot: number;
  slotsCompleted: number;
  // quick_gigs only
  category?: string;
  duration?: string;
  // open_gigs only
  requiredSkills?: string[];
  // offered_gigs only
  skillRequired?: string;
  // open_gigs / offered_gigs
  experienceLevel?: string;
  // Pending applicants on an open gig (see ApplicantEntry in browse-gigs.ts)
  // — not yet accepted, so not in `workers` below.
  applicants: HostGigApplicantEntry[];
  // Whoever's actually assigned/accepted/offered the gig — one entry for a
  // single-recipient gig (workerId/workerName on the doc itself, or
  // assignedWorkerId/assignedWorkerName for a quick gig), or one per slot
  // from the `workers` subcollection for a multi-slot gig.
  workers: HostGigWorkerEntry[];
  // null unless this gig was ever cancelled or has a pending cancellation
  // request.
  cancellation: HostGigCancellation | null;
  // Whichever milestone timestamps are actually present on this gig type,
  // oldest first — built only from fields confirmed against real documents
  // or the *_gig_model.dart / matching-service source, not guessed.
  timeline: HostGigTimelineEntry[];
}

// Every timestamp WorkerSlotModel can carry, oldest-relevant-first (see
// worker_slot_model.dart) — a multi-slot worker's own journey through the
// gig, independent of the parent doc's coarse aggregate status. Labels match
// the same casual vocabulary the app already uses for gig progress
// (PROGRESS_STEPS in applications/page.tsx: Navigating → Arrived → Working
// → Complete → Paid) rather than the raw field names.
const WORKER_SLOT_TIMESTAMP_FIELDS: [string, string][] = [
  ["dispatchedAt", "Dispatched"],
  ["offeredAt", "Offered"],
  ["acceptedAt", "Accepted"],
  ["arrivedAt", "Arrived"],
  ["workStartedAt", "Working"],
  ["workCompletedAt", "Done"],
  ["completedAt", "Completed"],
  ["paymentInitiatedAt", "Payment sent"],
  ["hostRatedAt", "Rated"],
];

function buildWorkerTimeline(workerData: Record<string, unknown>): HostGigTimelineEntry[] {
  return WORKER_SLOT_TIMESTAMP_FIELDS.map(([field, label]) => {
    const ts = workerData[field] as Timestamp | undefined;
    return ts ? { label, at: ts.toDate() } : null;
  })
    .filter((entry): entry is HostGigTimelineEntry => entry !== null)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

interface WorkerProfileSummary {
  photoUrl: string;
  ratingAsWorker: number;
  ratingCount: number;
  skills: string[];
  isVerified: boolean;
}

// Shared by both the one-time fetch and the live subscription below — takes
// whatever `data`/`workers` docs each has already read and assembles the
// same HostGigDetail either way (profile backfill, cancellation, timeline).
// `profileCache` lets a long-lived subscription (workerLocation pings while
// navigating can re-fire this many times a minute) skip re-fetching a
// worker's users/{id} doc it already has — photo/rating/skills essentially
// never change mid-session, and re-fetching them on every location ping was
// adding a full Firestore round-trip of latency before the map could move.
async function buildHostGigDetail(
  gigType: GigTypeKey,
  id: string,
  data: Record<string, unknown>,
  workersRaw: { id: string; data: Record<string, unknown> }[],
  profileCache: Map<string, WorkerProfileSummary> = new Map()
): Promise<HostGigDetail> {
  const workerSlots = (data.workerSlots as number | undefined) ?? 1;
  let workers: HostGigWorkerEntry[] = [];
  if (workerSlots > 1) {
    workers = workersRaw.map(({ id: workerDocId, data: wd }) => ({
      workerId: (wd.workerId as string) ?? workerDocId,
      workerName: (wd.workerName as string) || "Unknown",
      photoUrl: (wd.workerPhotoUrl as string) ?? "",
      status: (wd.status as string) ?? "",
      timeline: buildWorkerTimeline(wd),
      skills: [],
      workStartedAt: (wd.workStartedAt as Timestamp | undefined)?.toDate() ?? null,
      workerLocation: toLatLng(wd.workerLocation as GeoPoint | undefined),
      paymentCode: (wd.paymentCode as string | undefined) ?? null,
      isVerified: false,
      ratingAsWorker: 0,
      ratingCount: 0,
    }));
  } else {
    // Quick gigs use assignedWorkerId/assignedWorkerName; open/offered use
    // workerId/workerName directly (see the respective *_gig_model.dart).
    const workerId = (data.workerId as string | undefined) ?? (data.assignedWorkerId as string | undefined);
    const workerName = (data.workerName as string | undefined) ?? (data.assignedWorkerName as string | undefined);
    if (workerId) {
      // No per-worker subcollection doc to read a full journey from here —
      // the one moment we do know is whichever gig-level field represents
      // this worker being assigned (dispatchedAt for quick, selectedAt for
      // open; offered gigs have no equivalent field for the single-recipient
      // path).
      const assignedAt = (data.dispatchedAt as Timestamp | undefined) ?? (data.selectedAt as Timestamp | undefined);
      workers = [
        {
          workerId,
          workerName: workerName || "Unknown",
          photoUrl: "",
          status: (data.status as string) ?? "",
          timeline: assignedAt ? [{ label: "Assigned", at: assignedAt.toDate() }] : [],
          skills: [],
          workStartedAt: (data.workStartedAt as Timestamp | undefined)?.toDate() ?? null,
          workerLocation: toLatLng(data.workerLocation as GeoPoint | undefined),
          paymentCode: (data.paymentCode as string | undefined) ?? null,
          isVerified: false,
          ratingAsWorker: 0,
          ratingCount: 0,
        },
      ];
    }
  }

  const applicants: HostGigApplicantEntry[] = (
    (data.applicants as { workerId: string; workerName: string }[] | undefined) ?? []
  ).map((a) => ({
    workerId: a.workerId,
    workerName: a.workerName,
    photoUrl: "",
    ratingAsWorker: 0,
    ratingCount: 0,
    skills: [],
    isVerified: false,
  }));

  // Neither the workers subcollection (unless workerPhotoUrl was set) nor
  // applicants carry a photo, rating, or skills of their own, so backfill
  // all of it from each worker's profile doc — one batched read per unique
  // id, not per list entry. Same fields _ApplicantTile reads in
  // gig_detail_sheet.dart, plus skills (only ever available on the profile).
  const idsNeedingProfile = new Set(
    [...workers, ...applicants].map((entry) => entry.workerId).filter((workerId) => !profileCache.has(workerId))
  );
  if (idsNeedingProfile.size > 0) {
    await Promise.all(
      Array.from(idsNeedingProfile).map(async (workerId) => {
        const userSnap = await getDoc(doc(db, "users", workerId));
        const userData = userSnap.data();
        // skillsXP (skill name -> level) is the source of truth once a
        // worker has any awarded skill; the plain `skills` name list is only
        // a fallback for accounts that predate skillsXP (same precedence as
        // SkillsCard.tsx's _SkillChip on the worker side).
        const skillsXP = (userData?.skillsXP as Record<string, number> | undefined) ?? {};
        const skillNames = Object.keys(skillsXP);
        profileCache.set(workerId, {
          photoUrl: (userData?.photoUrl as string | undefined) ?? "",
          ratingAsWorker: (userData?.ratingAsWorker as number | undefined) ?? 0,
          ratingCount: (userData?.ratingCount as number | undefined) ?? 0,
          skills: skillNames.length > 0 ? skillNames : ((userData?.skills as string[] | undefined) ?? []),
          isVerified: (userData?.isVerified as string | undefined) === "verified",
        });
      })
    );
  }
  for (const entry of workers) {
    const profile = profileCache.get(entry.workerId);
    entry.photoUrl ||= profile?.photoUrl ?? "";
    entry.skills = profile?.skills ?? [];
    entry.isVerified = profile?.isVerified ?? false;
    entry.ratingAsWorker = profile?.ratingAsWorker ?? 0;
    entry.ratingCount = profile?.ratingCount ?? 0;
  }
  for (const entry of applicants) {
    const profile = profileCache.get(entry.workerId);
    entry.photoUrl ||= profile?.photoUrl ?? "";
    entry.ratingAsWorker = profile?.ratingAsWorker ?? 0;
    entry.ratingCount = profile?.ratingCount ?? 0;
    entry.skills = profile?.skills ?? [];
    entry.isVerified = profile?.isVerified ?? false;
  }

  const geo = data.location as GeoPoint | undefined;

  // Field names are a mix of camelCase and the legacy cancellation_reason
  // snake_case key — same inconsistency the real documents themselves have
  // (confirmed against actual open/offered/quick gig samples), so this reads
  // whichever combination is present rather than assuming one shape.
  const rawReasons = (data.cancellation_reason as Record<string, unknown>[] | undefined) ?? [];
  const reasons: HostGigCancellationReason[] = rawReasons.map((r) => ({
    reason: (r.reason as string) ?? "",
    requestedBy: (r.requestedBy as string) ?? "",
    approved: (r.approved as boolean | null | undefined) ?? null,
  }));
  const cancelledAt = (data.cancelledAt as Timestamp | undefined)?.toDate() ?? null;
  const cancellationRequestedAt = (data.cancellationRequestedAt as Timestamp | undefined)?.toDate() ?? null;
  const cancellation: HostGigCancellation | null =
    reasons.length > 0 || cancelledAt || cancellationRequestedAt
      ? {
          reasons,
          cancelledAt,
          cancellationRequestedAt,
          cancelledByAdmin: (data.cancelledByAdmin as boolean | undefined) ?? false,
          cancelledByAdminName: (data.cancelledByAdminName as string | undefined) ?? "",
          ticketId: (data.cancellationTicketID as string | undefined) ?? "",
        }
      : null;

  // Field/label per gig type, built only from timestamps confirmed present
  // either in real documents or the source that writes them:
  //  - createdAt: all three (*_gig_model.dart toMap())
  //  - searchStartedAt/dispatchedAt: quick_gigs (quick_gig_matching_service.dart)
  //  - selectedAt: open_gigs (host accepts an applicant)
  //  - workCompletedAt: single-recipient gigs, set when the worker taps "Gig
  //    Complete" (working -> task_complete, see _completeWork in working_ui.dart)
  //  - completedAt: set once the worker confirms cash payment received
  //    (worker_payment_confirm_sheet.dart), or once every slot is paid for a
  //    multi-worker gig
  //  - cancellationRequestedAt/cancelledAt: whichever's set (see cancellation above)
  const timelineSource: [Timestamp | undefined, string][] = [
    [data.createdAt as Timestamp | undefined, "Gig posted"],
    [data.searchStartedAt as Timestamp | undefined, "Search started"],
    [data.dispatchedAt as Timestamp | undefined, "Dispatched to a worker"],
    [data.selectedAt as Timestamp | undefined, "Worker selected"],
    [data.workCompletedAt as Timestamp | undefined, "Work completed"],
    [data.completedAt as Timestamp | undefined, "Completed"],
    [cancellationRequestedAt ? Timestamp.fromDate(cancellationRequestedAt) : undefined, "Cancellation requested"],
    [cancelledAt ? Timestamp.fromDate(cancelledAt) : undefined, "Cancelled"],
  ];
  const timeline: HostGigTimelineEntry[] = timelineSource
    .filter((entry): entry is [Timestamp, string] => entry[0] !== undefined)
    .map(([ts, label]) => ({ label, at: ts.toDate() }))
    .sort((a, b) => b.at.getTime() - a.at.getTime());

  // Now that `workers` is fully resolved, it's a more authoritative count of
  // actually-filled slots than either the raw filledSlotCount field or
  // toHostGig's doc-only guess — recompute from it for both the single- and
  // multi-slot cases.
  const filledSlotCount = workers.filter((w) => !UNFILLED_WORKER_STATUSES.has(w.status)).length;
  // Same problem as filledSlotCount: `slotsCompleted` is only ever written
  // as 0 at gig creation (see commonGigFields in post-gig.ts) and nothing
  // increments it afterward, so it always read as 0 regardless of how many
  // workers actually finished. A worker/slot reaching "completed" status is
  // the same signal the Workers card uses to show the "Paid" badge, so count
  // that directly instead of trusting the stale stored field.
  const slotsCompleted = workers.filter((w) => w.status === "completed").length;

  return {
    ...toHostGig(id, data, gigType),
    filledSlotCount,
    hostName: (data.hostName as string) ?? "",
    description: (data.description as string) ?? "",
    location: geo ? { lat: geo.latitude, lng: geo.longitude } : null,
    ratePerSlot: (data.ratePerSlot as number | undefined) ?? (data.budget as number | undefined) ?? 0,
    slotsCompleted,
    category: data.category as string | undefined,
    duration: data.duration as string | undefined,
    requiredSkills: data.requiredSkills as string[] | undefined,
    skillRequired: data.skillRequired as string | undefined,
    experienceLevel: data.experienceLevel as string | undefined,
    applicants,
    workers,
    cancellation,
    timeline,
  };
}

// One-time fetch — used anywhere a live subscription isn't warranted (kept
// for parity/tests; the detail page itself now uses subscribeHostGigDetail
// below so the Workers/Applicants section updates without a manual reload).
export async function fetchHostGigDetail(gigType: GigTypeKey, id: string): Promise<HostGigDetail | null> {
  const collectionName = HOST_GIG_COLLECTIONS[gigType];
  const snap = await getDoc(doc(db, collectionName, id));
  if (!snap.exists()) return null;
  const data = snap.data();

  const workerSlots = (data.workerSlots as number | undefined) ?? 1;
  let workersRaw: { id: string; data: Record<string, unknown> }[] = [];
  if (workerSlots > 1) {
    const workersSnap = await getDocs(collection(db, collectionName, id, "workers"));
    workersRaw = workersSnap.docs.map((w) => ({ id: w.id, data: w.data() }));
  }

  return buildHostGigDetail(gigType, id, data, workersRaw);
}

// Live equivalent of fetchHostGigDetail — the gig detail page uses this so a
// host selecting an applicant, a worker's slot status changing, or a new
// applicant arriving shows up immediately, without the page re-fetching
// itself. Listens to the gig doc, and — only for genuine multi-slot gigs —
// also to its `workers` subcollection, re-assembling the full HostGigDetail
// (including a fresh profile/skills backfill) whenever either changes.
export function subscribeHostGigDetail(
  gigType: GigTypeKey,
  id: string,
  onData: (detail: HostGigDetail | null) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  const collectionName = HOST_GIG_COLLECTIONS[gigType];
  const gigRef = doc(db, collectionName, id);

  let latestGigData: Record<string, unknown> | null = null;
  let latestWorkersRaw: { id: string; data: Record<string, unknown> }[] = [];
  let workersUnsub: Unsubscribe | null = null;
  let stopped = false;
  // Lives for this subscription's whole lifetime — see buildHostGigDetail's
  // profileCache param for why.
  const profileCache = new Map<string, WorkerProfileSummary>();

  function emit() {
    if (!latestGigData) return;
    buildHostGigDetail(gigType, id, latestGigData, latestWorkersRaw, profileCache).then(
      (detail) => {
        if (!stopped) onData(detail);
      },
      (err) => {
        if (!stopped) onError(err);
      }
    );
  }

  const gigUnsub = onSnapshot(
    gigRef,
    (snap) => {
      if (!snap.exists()) {
        latestGigData = null;
        onData(null);
        return;
      }
      latestGigData = snap.data();
      const workerSlots = (latestGigData.workerSlots as number | undefined) ?? 1;
      if (workerSlots > 1) {
        if (!workersUnsub) {
          workersUnsub = onSnapshot(
            collection(db, collectionName, id, "workers"),
            (workersSnap) => {
              latestWorkersRaw = workersSnap.docs.map((w) => ({ id: w.id, data: w.data() }));
              emit();
            },
            onError
          );
        } else {
          emit();
        }
      } else {
        workersUnsub?.();
        workersUnsub = null;
        latestWorkersRaw = [];
        emit();
      }
    },
    onError
  );

  return () => {
    stopped = true;
    gigUnsub();
    workersUnsub?.();
  };
}

// Mirrors _selectWorker in gig_detail_sheet.dart — a host accepting one
// pending applicant on an open gig. Single-slot: writes straight onto the
// gig doc. Multi-slot: a transaction creates that worker's own subcollection
// doc and bumps the gig's aggregate, guarding against a slot filling or that
// worker being selected twice between the host's last read and this write.
export async function selectApplicantForOpenGig(
  gig: HostGigDetail,
  applicant: HostGigApplicantEntry
): Promise<ActionResult> {
  if (gig.gigType !== "open") {
    return { ok: false, reason: "Only open gigs support selecting an applicant." };
  }

  const gigRef = doc(db, "open_gigs", gig.id);
  // Must match the {workerId, workerName} shape actually stored in the
  // `applicants` array exactly — arrayRemove needs an exact value match, and
  // the stored entries never carry photoUrl/rating (see ApplicantEntry in
  // browse-gigs.ts).
  const applicantEntry = { workerId: applicant.workerId, workerName: applicant.workerName };

  if (gig.workerSlots <= 1) {
    await updateDoc(gigRef, {
      workerId: applicant.workerId,
      workerName: applicant.workerName,
      assignedWorkerId: applicant.workerId,
      assignedWorkerName: applicant.workerName,
      status: "navigating",
      selectedAt: serverTimestamp(),
      applicants: arrayRemove(applicantEntry),
    });
    return { ok: true };
  }

  try {
    await runTransaction(db, async (tx) => {
      const gigSnap = await tx.get(gigRef);
      const data = gigSnap.data();
      if (!data) throw new Error("This gig no longer exists.");

      const workerSlots = (data.workerSlots as number | undefined) ?? 1;
      const filledSlotCount = (data.filledSlotCount as number | undefined) ?? 0;
      if (filledSlotCount >= workerSlots) throw new Error("All slots are already filled.");

      const slotRef = doc(db, "open_gigs", gig.id, "workers", applicant.workerId);
      const slotSnap = await tx.get(slotRef);
      if (slotSnap.exists()) throw new Error("This worker has already been selected.");

      const newFilled = filledSlotCount + 1;
      tx.set(slotRef, {
        workerId: applicant.workerId,
        workerName: applicant.workerName,
        gigId: gig.id,
        gigCollection: "open_gigs",
        hostId: (data.hostId as string | undefined) ?? "",
        hostName: (data.hostName as string | undefined) ?? gig.hostName ?? "",
        rate: (data.ratePerSlot as number | undefined) ?? (data.budget as number | undefined) ?? 0,
        currencyCode: (data.currencyCode as string | undefined) ?? "USD",
        status: "navigating",
        selectedAt: serverTimestamp(),
      });
      tx.update(gigRef, {
        filledSlotCount: newFilled,
        status: newFilled >= workerSlots ? "filled" : "partially_filled",
        applicants: arrayRemove(applicantEntry),
      });
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Couldn't select this worker." };
  }
}

export type CashPaymentResult = { ok: true; paymentCode: string } | { ok: false; reason: string };

// Same 6-digit, digits-only format as _generatePaymentCode in
// gig_progress_tracker.dart — random, client-side, one per payment attempt.
function generatePaymentCode(): string {
  return Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join("");
}

// Mirrors the host's "Confirm Cash Payment" write (gig_detail_sheet.dart's
// _confirmCompleted / _confirmWorkerSlotCompleted) — the host is declaring
// they paid the worker cash in person; the generated code is then shown to
// the worker (QR + digits) so they can confirm receipt on their end (mobile
// app today — the worker-side "enter code" step isn't built on web yet).
export async function confirmCashPayment(
  gig: HostGigDetail,
  worker: HostGigWorkerEntry
): Promise<CashPaymentResult> {
  const collectionName = HOST_GIG_COLLECTIONS[gig.gigType];
  const paymentCode = generatePaymentCode();
  const targetRef =
    gig.workerSlots > 1
      ? doc(db, collectionName, gig.id, "workers", worker.workerId)
      : doc(db, collectionName, gig.id);

  try {
    await Promise.all([
      updateDoc(targetRef, {
        status: "payment",
        paymentMethod: "cash",
        paymentCode,
        paymentInitiatedAt: serverTimestamp(),
      }),
      updateDoc(doc(db, "users", worker.workerId), { slot: "AVAILABLE" }),
    ]);
    return { ok: true, paymentCode };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Couldn't confirm this payment." };
  }
}

// Live-reads the host's own favoriteWorkerIds — mirrors _toggleFavoriteWorker
// / the "favorite this worker" heart shown on a completed gig in
// gig_detail_sheet.dart. Realtime so the heart on this page and the
// Favorites picker used when posting an offered gig (fetchFavoriteWorkers in
// post-gig.ts) never disagree within a session.
export function subscribeFavoriteWorkerIds(
  hostId: string,
  onData: (ids: Set<string>) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "users", hostId),
    (snap) => {
      const ids = (snap.data()?.favoriteWorkerIds as string[] | undefined) ?? [];
      onData(new Set(ids));
    },
    onError
  );
}

// Same arrayUnion/arrayRemove merge-write as all three Flutter toggle sites
// (gig_detail_sheet.dart, gig_host_profile_screen.dart,
// favorite_workers_sheet.dart) — always onto the host's own doc, nothing
// else touched (no reverse-index on the worker's doc, no timestamp).
export async function toggleFavoriteWorker(
  hostId: string,
  workerId: string,
  isFavorite: boolean
): Promise<ActionResult> {
  try {
    await updateDoc(doc(db, "users", hostId), {
      favoriteWorkerIds: isFavorite ? arrayRemove(workerId) : arrayUnion(workerId),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Couldn't update favorites." };
  }
}

// Mirrors _RatingDialog._submit in gig_detail_sheet.dart — shown right after
// a payment is confirmed. Same client-side read-modify-write running average
// (not a transaction, matching the app — a real race exists if two hosts
// rate the same worker at once, same as production) seeded at 5.0/0 for a
// worker with no prior rating.
export async function rateWorker(
  gig: HostGigDetail,
  worker: HostGigWorkerEntry,
  stars: number
): Promise<ActionResult> {
  const collectionName = HOST_GIG_COLLECTIONS[gig.gigType];
  const targetRef =
    gig.workerSlots > 1
      ? doc(db, collectionName, gig.id, "workers", worker.workerId)
      : doc(db, collectionName, gig.id);
  const workerRef = doc(db, "users", worker.workerId);

  try {
    const workerSnap = await getDoc(workerRef);
    const workerData = workerSnap.data();
    const currentRating = (workerData?.ratingAsWorker as number | undefined) ?? 5;
    const currentCount = (workerData?.ratingCount as number | undefined) ?? 0;
    const newCount = currentCount + 1;
    const newRating = Number((((currentRating * currentCount) + stars) / newCount).toFixed(2));

    await Promise.all([
      updateDoc(workerRef, { ratingAsWorker: newRating, ratingCount: newCount }),
      updateDoc(targetRef, { hostRating: stars, hostRatedAt: serverTimestamp() }),
    ]);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Couldn't submit this rating." };
  }
}
