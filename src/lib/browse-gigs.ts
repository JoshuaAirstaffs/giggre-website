import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  GeoPoint,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { fetchHostCompletedEntries } from "@/lib/earnings";

// Mirrors the worker app's gigs-near-you feed — see
// giggre_app/lib/features/gig_worker/presentation/widgets/gig_map_section.dart
// (_startOpenSub / _startOfferedSub / _applyToOpenGig / _toMarker) and
// giggre_app/lib/features/gig_worker/presentation/gig_worker_screen.dart
// (_acceptOfferedGig / _declineOfferedGig).

export type GigType = "open" | "offered";

export interface ApplicantEntry {
  workerId: string;
  workerName: string;
}

export interface Gig {
  id: string;
  gigType: GigType;
  title: string;
  description: string;
  budget: number;
  currencyCode: string;
  status: string;
  hostName: string;
  hostId: string;
  address: string;
  location: { lat: number; lng: number } | null;
  experienceLevel: string;
  requiredSkills: string[];
  applicants: ApplicantEntry[];
  applicantCount: number;
  scheduledDate: Date | null;
  createdAt: Date | null;
  workerSlots: number;
  filledSlotCount: number;
}

export interface HostLookupResult {
  uid: string;
  userId: string;
  name: string;
  email: string;
  bio: string;
  company: string;
  photoUrl: string;
  ratingAsHost: number;
  ratingCount: number;
  isOnline: boolean;
  isVerified: boolean;
  completedGigCount: number;
  memberSince: Date | null;
}

// Backs the "view host profile" drawer on the worker's browse page — mirrors
// fetchWorkerByUid in post-gig.ts, but for the gig's hostId/hostName instead.
// completedGigCount reuses fetchHostCompletedEntries (status == "completed"
// only), so cancelled/declined/no_worker gigs never count toward it.
export async function fetchHostByUid(uid: string): Promise<HostLookupResult | null> {
  const [snap, completedEntries] = await Promise.all([getDoc(doc(db, "users", uid)), fetchHostCompletedEntries(uid)]);
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    uid: snap.id,
    userId: (data.userId as string) ?? "",
    name: (data.name as string) || "Unknown",
    email: (data.email as string) ?? "",
    bio: (data.bio as string) ?? "",
    company: (data.company as string) ?? "",
    photoUrl: (data.photoUrl as string) ?? "",
    ratingAsHost: (data.ratingAsHost as number | undefined) ?? 0,
    ratingCount: (data.ratingCount as number | undefined) ?? 0,
    isOnline: (data.isOnline as boolean | undefined) ?? false,
    isVerified: (data.isVerified as string | undefined) === "verified",
    completedGigCount: completedEntries.length,
    memberSince: (data.createdAt as Timestamp | undefined)?.toDate() ?? null,
  };
}

// Live-mirrors any user's own `blockedUsers` array — mirrors
// _blockedUsersSub in gig_map_section.dart, which the worker feed filters
// against so a blocked host's gigs disappear immediately, no reload needed.
// Also reused for chat (both directions: mine, and the peer's) since it's
// just "watch whose blockedUsers this uid's doc has," not host-specific.
export function subscribeBlockedUserIds(uid: string, onData: (ids: string[]) => void): Unsubscribe {
  return onSnapshot(doc(db, "users", uid), (snap) => {
    onData((snap.data()?.blockedUsers as string[] | undefined) ?? []);
  });
}

// Mirrors _blockUser in user_profile_sheet.dart — writes only to the acting
// user's own doc via arrayUnion; the blocked user's doc is never touched.
export async function blockUser(currentUid: string, targetUid: string): Promise<void> {
  await updateDoc(doc(db, "users", currentUid), { blockedUsers: arrayUnion(targetUid) });
}

function toGig(id: string, data: Record<string, unknown>, gigType: GigType): Gig {
  const geo = data.location as GeoPoint | undefined;
  const applicants = ((data.applicants as ApplicantEntry[] | undefined) ?? []).map((a) => ({
    workerId: a.workerId,
    workerName: a.workerName,
  }));
  return {
    id,
    gigType,
    title: (data.title as string) || (gigType === "open" ? "Open Gig" : "Offered Gig"),
    description: (data.description as string) ?? "",
    budget: (data.budget as number) ?? 0,
    currencyCode: (data.currencyCode as string) ?? "USD",
    status: (data.status as string) ?? "",
    hostName: (data.hostName as string) ?? "",
    hostId: (data.hostId as string) ?? "",
    address: (data.address as string) ?? "",
    location: geo ? { lat: geo.latitude, lng: geo.longitude } : null,
    experienceLevel: (data.experienceLevel as string) ?? "",
    requiredSkills: (data.requiredSkills as string[] | undefined) ?? [],
    applicants,
    applicantCount: gigType === "open" ? applicants.length : 0,
    scheduledDate: (data.scheduledDate as Timestamp | undefined)?.toDate() ?? null,
    createdAt: (data.createdAt as Timestamp | undefined)?.toDate() ?? null,
    workerSlots: (data.workerSlots as number) ?? 1,
    filledSlotCount: (data.filledSlotCount as number) ?? 0,
  };
}

// No orderBy/limit — the app streams every currently-open gig, not a page of
// the newest N, and excludes gigs this worker posted themselves (a worker who
// is also a host shouldn't see — or apply to — their own listing).
export function subscribeOpenGigs(
  uid: string,
  onData: (gigs: Gig[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "open_gigs"), where("status", "==", "open")),
    (snap) => {
      const gigs = snap.docs
        .filter((d) => (d.data().hostId as string | undefined) !== uid && d.data().location != null)
        .map((d) => toGig(d.id, d.data(), "open"));
      onData(gigs);
    },
    onError
  );
}

// Direct personal offers from a host to this specific worker.
export function subscribeOfferedGigs(
  uid: string,
  onData: (gigs: Gig[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "offered_gigs"), where("workerId", "==", uid), where("status", "==", "offered")),
    (snap) => {
      const gigs = snap.docs.filter((d) => d.data().location != null).map((d) => toGig(d.id, d.data(), "offered"));
      onData(gigs);
    },
    onError
  );
}

export interface SavedGigEntry {
  id: string;
  gigType: GigType;
  savedAt: Date | null;
}

export interface SavedGig extends SavedGigEntry {
  // null when the bookmarked gig doc no longer exists (deleted/expired) —
  // the UI shows a "no longer available" placeholder for these instead of
  // dropping them, so the worker can still see and clear the bookmark.
  gig: Gig | null;
}

// Mirrors the worker app's Saved tab — see saved_screen.dart's `_savedRef`.
// Bookmarks live in a `users/{uid}/savedGigs` subcollection (the doc ID *is*
// the gig ID) rather than an array field, so toggling one is a set/delete on
// its own doc, not arrayUnion/arrayRemove on the user doc.
export function subscribeSavedGigEntries(
  uid: string,
  onData: (entries: SavedGigEntry[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "users", uid, "savedGigs"), orderBy("savedAt", "desc")),
    (snap) => {
      onData(
        snap.docs.map((d) => ({
          id: d.id,
          gigType: ((d.data().gigType as GigType | undefined) ?? "open") as GigType,
          savedAt: (d.data().savedAt as Timestamp | undefined)?.toDate() ?? null,
        }))
      );
    },
    onError
  );
}

// Mirrors _toggleSavedGig in gig_worker_screen.dart — a plain set/delete on
// the bookmark doc, keyed by gig id, so mobile and web share the same
// savedGigs subcollection.
export async function toggleSavedGig(uid: string, gigId: string, gigType: GigType, isSaved: boolean): Promise<void> {
  const ref = doc(db, "users", uid, "savedGigs", gigId);
  if (isSaved) {
    await deleteDoc(ref);
  } else {
    await setDoc(ref, { gigType, savedAt: serverTimestamp() });
  }
}

// Firestore's documentId() "in" queries cap at 30 values.
const WHERE_IN_CHUNK_SIZE = 30;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function fetchGigsByIds(ids: string[], collectionName: string, gigType: GigType): Promise<Map<string, Gig>> {
  if (ids.length === 0) return new Map();
  const snaps = await Promise.all(
    chunk(ids, WHERE_IN_CHUNK_SIZE).map((c) => getDocs(query(collection(db, collectionName), where(documentId(), "in", c))))
  );
  const map = new Map<string, Gig>();
  snaps.forEach((snap) => snap.docs.forEach((d) => map.set(d.id, toGig(d.id, d.data(), gigType))));
  return map;
}

// One-shot hydrate of the live bookmark entries into full gig docs — mirrors
// _fetchGigs in saved_screen.dart (live bookmark ids, one-shot gig fetch on
// each id-set change, not a live listener on the gigs themselves).
export async function fetchSavedGigs(entries: SavedGigEntry[]): Promise<SavedGig[]> {
  const openIds = entries.filter((e) => e.gigType === "open").map((e) => e.id);
  const offeredIds = entries.filter((e) => e.gigType === "offered").map((e) => e.id);
  const [openMap, offeredMap] = await Promise.all([
    fetchGigsByIds(openIds, "open_gigs", "open"),
    fetchGigsByIds(offeredIds, "offered_gigs", "offered"),
  ]);
  return entries.map((e) => ({
    ...e,
    gig: (e.gigType === "open" ? openMap : offeredMap).get(e.id) ?? null,
  }));
}

// Statuses between "host accepted this application" and "fully resolved" —
// the gig's in-progress lifecycle from here on is driven entirely by the
// mobile app's WorkingUI (navigate → arrive → work → complete → paid). This
// list is read-only on the web; there's no button here to change any of it.
export const ACTIVE_GIG_STATUSES = ["navigating", "arrived", "working", "task_complete", "payment", "cancellation_requested"];
const GIG_COLLECTIONS = ["quick_gigs", "open_gigs", "offered_gigs"];

async function workerHasGigWithStatus(uid: string, statuses: string[]): Promise<boolean> {
  const results = await Promise.all(
    GIG_COLLECTIONS.map((name) =>
      getDocs(query(collection(db, name), where("workerId", "==", uid), where("status", "in", statuses)))
    )
  );
  return results.some((snap) => !snap.empty);
}

export function workerHasActiveGig(uid: string) {
  return workerHasGigWithStatus(uid, ACTIVE_GIG_STATUSES);
}

export function workerHasPendingCancellation(uid: string) {
  return workerHasGigWithStatus(uid, ["cancellation_requested"]);
}

export type ActionResult = { ok: true } | { ok: false; reason: string };

export async function applyToOpenGig(gigId: string, workerId: string, workerName: string): Promise<ActionResult> {
  const gigRef = doc(db, "open_gigs", gigId);
  const snap = await getDoc(gigRef);
  if (!snap.exists()) return { ok: false, reason: "This gig no longer exists." };

  const data = snap.data();
  const status = (data.status as string) ?? "";
  const workerSlots = (data.workerSlots as number) ?? 1;
  const filledSlotCount = (data.filledSlotCount as number) ?? 0;
  const stillAcceptingApplicants =
    workerSlots > 1
      ? (status === "open" || status === "partially_filled") && filledSlotCount < workerSlots
      : status === "open";
  if (!stillAcceptingApplicants) return { ok: false, reason: "This gig is no longer available." };

  const applicants = (data.applicants as ApplicantEntry[] | undefined) ?? [];
  if (applicants.some((a) => a.workerId === workerId)) {
    return { ok: false, reason: "You've already put in for this gig." };
  }

  await updateDoc(gigRef, { applicants: arrayUnion({ workerId, workerName }) });

  const hostId = data.hostId as string | undefined;
  const gigTitle = (data.title as string) || "Gig";
  if (hostId) {
    addDoc(collection(db, "notifications"), {
      userId: hostId,
      category: "new_applicant",
      message: `${workerName} applied to your gig "${gigTitle}"`,
      workerName,
      workerId,
      gigId,
      gigTitle,
      createdAt: serverTimestamp(),
    }).catch((err) => console.error("Failed to notify host of new applicant:", err));
  }

  return { ok: true };
}

// Only valid while the worker is still in the `applicants` array — once a
// host selects them they move elsewhere and this naturally stops applying.
export async function withdrawApplication(gigId: string, workerId: string): Promise<ActionResult> {
  const gigRef = doc(db, "open_gigs", gigId);
  const snap = await getDoc(gigRef);
  const applicants = (snap.data()?.applicants as ApplicantEntry[] | undefined) ?? [];
  const mine = applicants.find((a) => a.workerId === workerId);
  if (!mine) {
    return { ok: false, reason: "This application is no longer pending — it may have already been accepted." };
  }
  await updateDoc(gigRef, { applicants: arrayRemove(mine) });
  return { ok: true };
}

export interface AcceptedApplication {
  gigId: string;
  title: string;
  hostName: string;
  budget: number;
  currencyCode: string;
  address: string;
  status: string;
  scheduledDate: Date | null;
  // Whether this worker's slot lives on open_gigs/{gigId}/workers/{uid}
  // (true) or directly on the open_gigs/{gigId} doc itself (false) — needed
  // to know which document a cancellation request should target.
  isMultiWorker: boolean;
  // Set when status flips to 'working' (see _startWork in working_ui.dart) —
  // the live duration timer is just `now - workStartedAt`, ticked locally.
  workStartedAt: Date | null;
}

// A gig this worker applied to that a host has since accepted — the
// application has left the pending `applicants` array and moved either onto
// the gig doc's own `workerId` (single-slot) or a `workers/{uid}` sub-doc
// (multi-slot). Read-only: status only advances via the mobile app.
export function subscribeAcceptedApplications(
  uid: string,
  onData: (apps: AcceptedApplication[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  let singleSlot: AcceptedApplication[] = [];
  let multiSlot: AcceptedApplication[] = [];
  let singleReady = false;
  let multiReady = false;

  function emit() {
    if (singleReady && multiReady) onData([...singleSlot, ...multiSlot]);
  }

  const unsubSingle = onSnapshot(
    query(collection(db, "open_gigs"), where("workerId", "==", uid), where("status", "in", ACTIVE_GIG_STATUSES)),
    (snap) => {
      singleSlot = snap.docs.map((d) => {
        const data = d.data();
        return {
          gigId: d.id,
          title: (data.title as string) || "Open Gig",
          hostName: (data.hostName as string) ?? "",
          budget: (data.budget as number) ?? 0,
          currencyCode: (data.currencyCode as string) ?? "USD",
          address: (data.address as string) ?? "",
          status: (data.status as string) ?? "",
          scheduledDate: (data.scheduledDate as Timestamp | undefined)?.toDate() ?? null,
          isMultiWorker: false,
          workStartedAt: (data.workStartedAt as Timestamp | undefined)?.toDate() ?? null,
        };
      });
      singleReady = true;
      emit();
    },
    onError
  );

  const unsubMulti = onSnapshot(
    query(
      collectionGroup(db, "workers"),
      where("workerId", "==", uid),
      where("gigCollection", "==", "open_gigs"),
      where("status", "in", ACTIVE_GIG_STATUSES)
    ),
    (snap) => {
      Promise.all(
        snap.docs.map(async (d) => {
          const slot = d.data();
          const gigId = slot.gigId as string;
          const gigSnap = await getDoc(doc(db, "open_gigs", gigId));
          const gigData = gigSnap.data();
          if (!gigData) return null;
          const app: AcceptedApplication = {
            gigId,
            title: (gigData.title as string) || "Open Gig",
            hostName: (slot.hostName as string) ?? (gigData.hostName as string) ?? "",
            budget: (slot.rate as number) ?? 0,
            currencyCode: (slot.currencyCode as string) ?? (gigData.currencyCode as string) ?? "USD",
            address: (gigData.address as string) ?? "",
            status: (slot.status as string) ?? "",
            scheduledDate: (gigData.scheduledDate as Timestamp | undefined)?.toDate() ?? null,
            isMultiWorker: true,
            workStartedAt: (slot.workStartedAt as Timestamp | undefined)?.toDate() ?? null,
          };
          return app;
        })
      )
        .then((resolved) => {
          multiSlot = resolved.filter((a): a is AcceptedApplication => a !== null);
          multiReady = true;
          emit();
        })
        .catch(onError);
    },
    onError
  );

  return () => {
    unsubSingle();
    unsubMulti();
  };
}

// Mirrors _showCancelReasonDialog in working_ui.dart: only offered while
// still on the way / working, and it's a *request* — the gig doesn't
// actually cancel until an admin reviews and approves it (see
// _onAdminCancelled in the app). Same write shape as the app so the admin
// tooling that reviews these doesn't need to special-case a web origin.
export const CANCELLABLE_GIG_STATUSES = ["navigating", "arrived", "working"];

export async function requestApplicationCancellation(
  app: AcceptedApplication,
  workerId: string,
  reason: string
): Promise<ActionResult> {
  if (!CANCELLABLE_GIG_STATUSES.includes(app.status)) {
    return { ok: false, reason: "This gig can no longer be cancelled from here." };
  }
  const targetRef = app.isMultiWorker
    ? doc(db, "open_gigs", app.gigId, "workers", workerId)
    : doc(db, "open_gigs", app.gigId);

  await updateDoc(targetRef, {
    cancellation_reason: arrayUnion({ reason, approved: null, requestedBy: "worker" }),
    cancellationRequestedAt: serverTimestamp(),
    status: "cancellation_requested",
  });
  return { ok: true };
}

const MULTI_WORKER_UNSUPPORTED: ActionResult = {
  ok: false,
  reason: "Multi-worker offers aren't supported on the web yet — please use the mobile app.",
};

export async function acceptOfferedGig(gig: Gig): Promise<ActionResult> {
  if (gig.workerSlots > 1) return MULTI_WORKER_UNSUPPORTED;
  await updateDoc(doc(db, "offered_gigs", gig.id), {
    status: "navigating",
    acceptedAt: serverTimestamp(),
  });
  return { ok: true };
}

export async function declineOfferedGig(gig: Gig): Promise<ActionResult> {
  if (gig.workerSlots > 1) return MULTI_WORKER_UNSUPPORTED;
  await updateDoc(doc(db, "offered_gigs", gig.id), { status: "declined" });
  return { ok: true };
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// Reverse-geocodes via Nominatim to find a 2-letter country code. Only called
// lazily right before an apply/accept — resolving it for every visible gig
// up front would blow past Nominatim's ~1 req/sec usage policy from a browser.
export async function countryCodeFromCoordinates(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?${new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: "json",
      zoom: "3",
    })}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    const code = data?.address?.country_code as string | undefined;
    return code ? code.toUpperCase() : null;
  } catch {
    return null;
  }
}

export async function fetchSkillNames(): Promise<string[]> {
  const snap = await getDocs(collection(db, "skills"));
  return snap.docs
    .filter((d) => d.id !== "_counter")
    .map((d) => (d.data().name as string | undefined) || d.id)
    .filter(Boolean)
    .sort();
}
