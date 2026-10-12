import {
  GeoPoint,
  Timestamp,
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
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
import { hourlyPayAmount } from "@/lib/gig-format";
import { ratingAverage, submitRating, type RatingAggregate } from "@/lib/ratings";

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
  payType: string;
  hourlyRate: number | null;
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
    payType: (data.payType as string | undefined) ?? "flat",
    hourlyRate: (data.hourlyRate as number | undefined) ?? null,
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
  // Written by the worker's mobile device at task_complete (_completeWork in
  // working_ui.dart) — the only source of a real elapsed-work duration; this
  // repo has no active-gig start/complete UI of its own, so it only ever
  // reads this, never writes it. Needed here so payableAmountForWorker can
  // compute an hourly gig's real payout instead of falling back to the flat
  // estimate.
  durationSeconds: number | null;
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
  // Decorative only — never read by any pay calculation. See the field
  // comment on CommonGigInput in post-gig.ts.
  workDurationHours?: number;
  // Set by closeRemainingSpots/markGigComplete below — the host has enough
  // workers and wants to stop taking new applicants without cancelling the
  // gig or touching already-selected workers. Deliberately independent of
  // workerSlots/status: an earlier version of this signaled "closed" by
  // shrinking workerSlots down to filledSlotCount, which broke every
  // `workerSlots > 1` multi-worker check (a closed 2-slot gig with 1 filled
  // got misclassified as single-worker and hid the selected worker's
  // tracking view). See isAcceptingApplicants for the real "still accepting
  // applicants" formula — never infer multi-worker-ness from slotsClosed.
  slotsClosed: boolean;
  // Set by keepLookingForReplacement below (the "Keep Looking" side of the
  // completion-decision banner) — every currently-filled slot finished, but
  // the host chose to look for a replacement instead of marking the gig
  // done. Cleared once selectApplicantForOpenGig actually assigns someone.
  // Purely a host-side UI/decision-state concept, not read by the
  // worker-facing browse/apply eligibility checks (verified against the
  // Flutter app's own worker-facing feed query, which never references it).
  awaitingReplacement: boolean;
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
      durationSeconds: (wd.durationSeconds as number | undefined) ?? null,
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
          durationSeconds: (data.durationSeconds as number | undefined) ?? null,
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
        const ratingWorker = userData?.ratingWorker as RatingAggregate | undefined;
        profileCache.set(workerId, {
          photoUrl: (userData?.photoUrl as string | undefined) ?? "",
          ratingAsWorker: ratingAverage(ratingWorker) ?? 0,
          ratingCount: ratingWorker?.count ?? 0,
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
    workDurationHours: data.workDurationHours as number | undefined,
    slotsClosed: (data.slotsClosed as boolean | undefined) ?? false,
    awaitingReplacement: (data.awaitingReplacement as boolean | undefined) ?? false,
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
        // The only place this gets cleared — a replacement is actually on
        // the gig now, so the "Keep Looking" state is resolved. Harmless
        // no-op via deleteField() if it was never set.
        awaitingReplacement: deleteField(),
      });
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Couldn't select this worker." };
  }
}

// The one correct way to answer "can this gig still take applicants" —
// never derive it from workerSlots/status alone (see the field comment on
// HostGigDetail.slotsClosed for why). Mirrors the Flutter app's own
// `acceptingMoreSlots` computation in gig_detail_sheet.dart exactly: once
// every currently-filled slot is done, applicant-selection pauses (even if
// there's an unfilled slot left) until the host explicitly resolves the
// completion-decision banner (see needsCompletionDecision below) — unless
// they already chose "Keep Looking" (awaitingReplacement).
export function isAcceptingApplicants(gig: HostGigDetail): boolean {
  if (gig.slotsClosed) return false;
  if (gig.status === "cancelled" || gig.status === "cancellation_requested" || gig.status === "completed") {
    return false;
  }
  const allFilledSlotsDone = gig.filledSlotCount > 0 && gig.slotsCompleted >= gig.filledSlotCount;
  if (allFilledSlotsDone && !gig.awaitingReplacement) return false;
  return gig.workerSlots > 1 ? gig.filledSlotCount < gig.workerSlots : gig.status === "open";
}

// Lets a host stop taking new applicants on a partially-filled open gig
// without cancelling it (which routes through admin review and would also
// affect already-selected workers) and without touching those workers —
// their own `workers/{workerId}` subcollection docs progress through their
// lifecycle completely independently of this. Only ever clears the pending
// `applicants` array; workerSlots/status are deliberately left untouched.
export async function closeRemainingSpots(gig: HostGigDetail): Promise<ActionResult> {
  if (gig.gigType !== "open") {
    return { ok: false, reason: "Only open gigs support closing remaining spots." };
  }
  try {
    await updateDoc(doc(db, "open_gigs", gig.id), { slotsClosed: true, applicants: [] });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Couldn't close the remaining spots." };
  }
}

// The ambiguous case isAcceptingApplicants pauses on: a multi-worker open
// gig with an unfilled slot, not yet closed, where every currently-filled
// slot has already finished — the host has to say whether that's "done" or
// "still need one more." Mirrors gig_detail_sheet.dart's own banner-trigger
// condition exactly.
export function needsCompletionDecision(gig: HostGigDetail): boolean {
  if (gig.gigType !== "open" || gig.workerSlots <= 1) return false;
  if (gig.filledSlotCount >= gig.workerSlots) return false;
  if (gig.slotsClosed || gig.status === "completed" || gig.awaitingReplacement) return false;
  return gig.filledSlotCount > 0 && gig.slotsCompleted >= gig.filledSlotCount;
}

// "Mark Complete" — deliberately permanent, same as closeRemainingSpots (no
// "Reopen" exists for either): the only way to bring on a worker for this
// job afterward is reposting.
export async function markGigComplete(gig: HostGigDetail): Promise<ActionResult> {
  if (gig.gigType !== "open") {
    return { ok: false, reason: "Only open gigs support this." };
  }
  try {
    await updateDoc(doc(db, "open_gigs", gig.id), { slotsClosed: true, status: "completed", applicants: [] });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Couldn't mark this gig complete." };
  }
}

// "Keep Looking" — the original schedule may already be in the past by the
// time a worker finishes a job, so a new one is required up front, not
// optional. `awaitingReplacement` is what actually lets
// isAcceptingApplicants resume (just updating the schedule wouldn't, since
// "every filled slot is done" stays true until a replacement is picked) —
// selectApplicantForOpenGig clears it once that happens.
export async function keepLookingForReplacement(gig: HostGigDetail, scheduledDate: Date): Promise<ActionResult> {
  if (gig.gigType !== "open") {
    return { ok: false, reason: "Only open gigs support this." };
  }
  try {
    await updateDoc(doc(db, "open_gigs", gig.id), {
      scheduledDate: Timestamp.fromDate(scheduledDate),
      awaitingReplacement: true,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Couldn't update this gig." };
  }
}

// Gigs eligible for "Post Again" — done and can't go anywhere else on
// their own.
const POST_AGAIN_GIG_STATUSES = new Set(["completed", "no_worker", "cancelled"]);
// Worker-slot statuses that mean that slot is done, one way or another —
// distinct from UNFILLED_WORKER_STATUSES above, which is about whether a
// slot counts as occupied at all, not whether it's finished.
const TERMINAL_WORKER_SLOT_STATUSES = new Set(["completed", "declined", "cancelled"]);

// For a multi-worker gig, the gig doc's own `status` never actually reaches
// 'completed' — each worker slot completes and gets paid independently
// (only that slot's own subcollection doc is updated, see
// worker_payment_confirm_sheet.dart), so gating purely on `status` would
// never surface "Post Again" for a multi-worker gig no matter how finished
// it actually is. The second branch below covers that: a host who closed
// remaining spots (slotsClosed, see closeRemainingSpots above) once every
// filled slot reached a terminal state has nothing left to happen on this
// gig either, even though `status` itself never says so. Checked against
// `gig.workers` — the same live worker-list the page already renders each
// worker's card from, not a separate listener.
export function canPostAgain(gig: HostGigDetail): boolean {
  if (POST_AGAIN_GIG_STATUSES.has(gig.status)) return true;
  if (gig.workerSlots > 1 && gig.slotsClosed && gig.workers.length > 0) {
    return gig.workers.every((w) => TERMINAL_WORKER_SLOT_STATUSES.has(w.status));
  }
  return false;
}

export type CashPaymentResult = { ok: true; paymentCode: string } | { ok: false; reason: string };

// Same 6-digit, digits-only format as _generatePaymentCode in
// gig_progress_tracker.dart — random, client-side, one per payment attempt.
function generatePaymentCode(): string {
  return Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join("");
}

// What this worker is actually owed — hourlyPayAmount using their real
// tracked durationSeconds (written by the mobile app at task_complete, see
// the field comment on HostGigWorkerEntry) for hourly gigs, or the flat
// ratePerSlot otherwise. Mirrors the same payableAmount logic host-side
// widgets in the Flutter app compute (gig_progress_tracker.dart,
// gig_detail_sheet.dart) via hourlyPayAmount in active_gig_step.dart.
export function payableAmountForWorker(gig: HostGigDetail, worker: HostGigWorkerEntry): number {
  if (gig.payType === "hourly" && gig.hourlyRate != null && worker.durationSeconds != null) {
    return hourlyPayAmount(gig.hourlyRate, worker.durationSeconds);
  }
  return gig.ratePerSlot;
}

// Mirrors the host's "Confirm Cash Payment" write (gig_detail_sheet.dart's
// _confirmCompleted / _confirmWorkerSlotCompleted) — the host is declaring
// they paid the worker cash in person; the generated code is then shown to
// the worker (QR + digits) so they can confirm receipt on their end (mobile
// app today — the worker-side "enter code" step isn't built on web yet).
// `overrideAmount`/`adjustmentReason` mirror PaymentSelectionSheet's manual
// amount edit (payment_selection_sheet.dart) — the host can override the
// calculated amount before confirming, with an always-optional reason.
// Validation matches Flutter exactly: reject negative/unparseable, allow
// $0, no upper bound (enforced by the caller, CashPaymentDialog.tsx, before
// this is ever called).
export async function confirmCashPayment(
  gig: HostGigDetail,
  worker: HostGigWorkerEntry,
  overrideAmount?: number,
  adjustmentReason?: string
): Promise<CashPaymentResult> {
  const collectionName = HOST_GIG_COLLECTIONS[gig.gigType];
  const paymentCode = generatePaymentCode();
  const targetRef =
    gig.workerSlots > 1
      ? doc(db, collectionName, gig.id, "workers", worker.workerId)
      : doc(db, collectionName, gig.id);
  // Persisted here rather than left transient — this is the one write point
  // this repo has anywhere in the payment chain (finalizing to "completed"
  // is mobile-only, see confirmCashPayment's doc comment), so it's the only
  // chance to record the real hourly-computed amount instead of the flat
  // estimate. Read back by earnings.ts in preference to budget/rate.
  const calculatedAmount = payableAmountForWorker(gig, worker);
  const finalAmount = overrideAmount ?? calculatedAmount;
  const wasAdjusted = overrideAmount !== undefined && overrideAmount !== calculatedAmount;

  try {
    await Promise.all([
      updateDoc(targetRef, {
        status: "payment",
        paymentMethod: "cash",
        paymentCode,
        paymentInitiatedAt: serverTimestamp(),
        finalAmount,
        // `adjustedAmount` is just a marker that finalAmount was overridden
        // (same value, not a distinct number) — matches gig_detail_sheet.dart:
        // there's no persisted "originally calculated" field either, since
        // that's always re-derivable from ratePerSlot/hourlyRate.
        ...(wasAdjusted ? { adjustedAmount: finalAmount } : {}),
        ...(adjustmentReason?.trim() ? { amountAdjustmentReason: adjustmentReason.trim() } : {}),
      }),
      updateDoc(doc(db, "users", worker.workerId), { slot: "AVAILABLE" }),
    ]);
    return { ok: true, paymentCode };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Couldn't confirm this payment." };
  }
}

// Mirrors host_payment_code_sheet.dart's "Confirm Manually" override
// exactly — for when the worker verbally confirmed but can't complete the
// code-entry step on their own device (which this repo doesn't have a web
// equivalent of either way). This is the ONLY write path this repo has that
// can ever mark a worker's slot completed — the worker's own confirmation
// remains mobile-only. Also increments the raw `slotsCompleted` counter on
// the gig doc and conditionally auto-completes it, matching mobile's own
// worker_payment_confirm_sheet.dart/host_payment_code_sheet.dart logic
// exactly, so a gig manually-confirmed here stays consistent if later
// viewed on mobile (which reads that raw counter directly for its own UI —
// this repo's own display instead live-derives it from `workers`, which is
// unaffected either way).
export async function confirmPaymentManually(
  gig: HostGigDetail,
  worker: HostGigWorkerEntry
): Promise<ActionResult> {
  const collectionName = HOST_GIG_COLLECTIONS[gig.gigType];
  const targetRef =
    gig.workerSlots > 1
      ? doc(db, collectionName, gig.id, "workers", worker.workerId)
      : doc(db, collectionName, gig.id);
  const gigRef = doc(db, collectionName, gig.id);

  try {
    await runTransaction(db, async (tx) => {
      const gigSnap = await tx.get(gigRef);
      const data = gigSnap.data();

      tx.update(targetRef, {
        status: "completed",
        completedAt: serverTimestamp(),
        paymentConfirmedAt: serverTimestamp(),
        paymentConfirmedManually: true,
      });

      if (data) {
        const workerSlots = (data.workerSlots as number | undefined) ?? 1;
        const filledSlotCount = (data.filledSlotCount as number | undefined) ?? 0;
        const slotsClosed = (data.slotsClosed as boolean | undefined) ?? false;
        const completed = ((data.slotsCompleted as number | undefined) ?? 0) + 1;
        const allFilledDone = completed >= filledSlotCount;
        const noOpenSlotLeft = filledSlotCount >= workerSlots || slotsClosed;
        tx.update(gigRef, {
          slotsCompleted: completed,
          ...(allFilledDone && noOpenSlotLeft ? { status: "completed" } : {}),
        });
      }
    });
    return { ok: true };
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

// Shown right after a payment is confirmed. Writes to the shared `ratings`
// collection (see ratings.ts) — the same Cloud Function
// (functions/src/ratings.ts onRatingCreated) that aggregates the Flutter
// app's ratings aggregates this too, into users/{workerId}.ratingWorker.
// This used to write hostRating/hostRatedAt directly onto the gig/slot doc
// plus a client-side running average onto the user doc — neither is read
// or written by anything in the current app anymore (see ratings.ts's own
// comment), so that path is gone entirely rather than kept alongside this.
export async function rateWorker(
  gig: HostGigDetail,
  worker: HostGigWorkerEntry,
  raterId: string,
  raterName: string,
  stars: number,
  tags: string[],
  comment: string
): Promise<ActionResult> {
  return submitRating({
    raterId,
    raterName,
    rateeId: worker.workerId,
    rateeName: worker.workerName,
    rateeRole: "worker",
    gigId: gig.id,
    gigCollection: HOST_GIG_COLLECTIONS[gig.gigType],
    gigTitle: gig.title,
    ...(gig.workerSlots > 1 ? { slotWorkerId: worker.workerId } : {}),
    stars,
    tags,
    comment,
  });
}
