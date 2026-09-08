import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  GeoPoint,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

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
