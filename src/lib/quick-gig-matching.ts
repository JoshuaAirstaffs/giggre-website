import {
  DocumentReference,
  Timestamp,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { GigLocation } from "@/lib/post-gig";

// Direct TS port of quick_gig_matching_service.dart — the mobile app's
// client-side quick-gig dispatch engine. It runs entirely as Firestore
// reads/writes (no push notifications anywhere in it; a dispatched worker
// finds out via their own app's live listener on `quick_gigs`/`workers`
// docs), so it works the same run from a browser tab as from the app. On
// mobile, whichever device posts the gig is the one that runs this loop —
// here, that's the browser tab that called postQuickGig.

const DEFAULT_REVIEW_WINDOW_MS = 30_000;
const DEFAULT_SEARCH_TIMEOUT_MS = 5 * 60_000;
const DEFAULT_MAX_DISPATCH_ATTEMPTS = 10;
const DEFAULT_MAX_SEARCH_RADIUS_KM = 10;

const RETRY_INTERVAL_MS = 15_000;
const POLL_INTERVAL_MS = 3_000;

interface MatchingConfig {
  reviewWindowMs: number;
  searchTimeoutMs: number;
  maxAttempts: number;
  maxSearchRadiusKm: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Mirrors _fetchConfig — reads quick_gig_config/matching_engine, same
// defaults as the Dart fallback when the doc (or a field) is missing.
async function fetchConfig(): Promise<MatchingConfig> {
  try {
    const snap = await getDoc(doc(db, "quick_gig_config", "matching_engine"));
    const data = snap.data() ?? {};
    return {
      reviewWindowMs: ((data.review_window_seconds as number | undefined) ?? 30) * 1000,
      searchTimeoutMs: ((data.search_timeout_minutes as number | undefined) ?? 5) * 60_000,
      maxAttempts: (data.max_dispatch_attempts as number | undefined) ?? DEFAULT_MAX_DISPATCH_ATTEMPTS,
      maxSearchRadiusKm: (data.max_search_radius_km as number | undefined) ?? DEFAULT_MAX_SEARCH_RADIUS_KM,
    };
  } catch {
    return {
      reviewWindowMs: DEFAULT_REVIEW_WINDOW_MS,
      searchTimeoutMs: DEFAULT_SEARCH_TIMEOUT_MS,
      maxAttempts: DEFAULT_MAX_DISPATCH_ATTEMPTS,
      maxSearchRadiusKm: DEFAULT_MAX_SEARCH_RADIUS_KM,
    };
  }
}

// Prevents duplicate concurrent searches for the same gig within this tab —
// mirrors _activeSearches, scoped per browser tab the same way it's scoped
// per app instance on mobile.
const activeSearches = new Set<string>();

function distanceKm(a: GigLocation, b: GigLocation): number {
  const R = 6371.0;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

// 50% proximity, 30% acceptance rate, 20% rating — same weights as _score.
function matchScore(distKm: number, acceptanceRate: number, rating: number): number {
  const proximity = 1.0 / (1.0 + distKm);
  return 0.5 * proximity + 0.3 * clamp01(acceptanceRate) + 0.2 * clamp01(rating / 5.0);
}

interface WorkerCandidate {
  id: string;
  name: string;
}

// Mirrors _findBestWorker — same query, then client-side distance filter
// and scoring (Firestore has no geo query here, exactly like the Dart side).
async function findBestWorker(
  gigLocation: GigLocation,
  exclude: string[],
  maxSearchRadiusKm: number
): Promise<WorkerCandidate | null> {
  const snap = await getDocs(
    query(
      collection(db, "users"),
      where("isOnline", "==", true),
      where("availableForGigs", "==", true),
      where("seekingQuickGigs", "==", true),
      where("slot", "==", "AVAILABLE")
    )
  );

  let best: WorkerCandidate | null = null;
  let bestScore = -Infinity;

  for (const workerDoc of snap.docs) {
    if (exclude.includes(workerDoc.id)) continue;

    const data = workerDoc.data();
    const geo = data.location as { latitude: number; longitude: number } | undefined;
    if (!geo) continue;

    const dist = distanceKm(gigLocation, { lat: geo.latitude, lng: geo.longitude });
    if (dist > maxSearchRadiusKm) continue;

    const acceptanceRate = (data.acceptanceRate as number | undefined) ?? 1.0;
    const rating = (data.ratingAsWorker as number | undefined) ?? 5.0;
    const score = matchScore(dist, acceptanceRate, rating);

    if (score > bestScore) {
      bestScore = score;
      best = { id: workerDoc.id, name: (data.name as string | undefined) || "Worker" };
    }
  }

  return best;
}

// Mirrors _dispatchToWorker — legacy single-worker gig.
async function dispatchToWorker(gigId: string, workerId: string, workerName: string): Promise<void> {
  await Promise.all([
    updateDoc(doc(db, "quick_gigs", gigId), {
      status: "in_progress",
      assignedWorkerId: workerId,
      assignedWorkerName: workerName,
      dispatchedAt: serverTimestamp(),
    }),
    updateDoc(doc(db, "users", workerId), { slot: "LOCKED" }),
  ]);
}

// Mirrors _dispatchToWorkerSlot — multi-worker gig, one `workers/{workerId}`
// doc per candidate so their offer/response never touches another slot.
async function dispatchToWorkerSlot(params: {
  gigId: string;
  workerId: string;
  workerName: string;
  hostId: string;
  hostName: string;
  rate: number;
  currencyCode: string;
}): Promise<void> {
  const { gigId, workerId, workerName, hostId, hostName, rate, currencyCode } = params;
  await Promise.all([
    setDoc(doc(db, "quick_gigs", gigId, "workers", workerId), {
      workerId,
      workerName,
      gigId,
      gigCollection: "quick_gigs",
      hostId,
      hostName,
      rate,
      currencyCode,
      status: "in_progress",
      dispatchedAt: serverTimestamp(),
    }),
    updateDoc(doc(db, "users", workerId), { slot: "LOCKED" }),
  ]);
}

// Mirrors startAutoSearch — routes to the single- or multi-slot loop based
// on workerSlots, same as the Dart entry point. Call this right after
// creating a quick gig (from whichever client posted it) so someone actually
// runs the search — nothing else does.
export async function startAutoSearch(gigId: string, gigLocation: GigLocation): Promise<void> {
  if (activeSearches.has(gigId)) return;
  activeSearches.add(gigId);

  try {
    const gigRef = doc(db, "quick_gigs", gigId);
    const initSnap = await getDoc(gigRef);
    if (!initSnap.exists()) return;
    const workerSlots = (initSnap.data().workerSlots as number | undefined) ?? 1;

    if (workerSlots <= 1) {
      await runSingleSlotSearch(gigId, gigLocation, gigRef);
    } else {
      await runMultiSlotSearch(gigId, gigLocation, gigRef);
    }
  } finally {
    activeSearches.delete(gigId);
  }
}

// Mirrors _runSingleSlotSearch.
async function runSingleSlotSearch(
  gigId: string,
  gigLocation: GigLocation,
  gigRef: DocumentReference
): Promise<void> {
  const config = await fetchConfig();
  let dispatchAttempts = 0;

  try {
    const initSnap = await getDoc(gigRef);
    if (!initSnap.exists()) return;
    const initData = initSnap.data();
    const initStatus = (initData.status as string | undefined) ?? "";
    const existingStartedAt = (initData.searchStartedAt as Timestamp | undefined)?.toDate();
    const isResuming = !!existingStartedAt && ["scanning", "in_progress"].includes(initStatus);

    let searchStartedAt: Date;
    if (isResuming) {
      searchStartedAt = existingStartedAt!;
    } else {
      await updateDoc(gigRef, { searchStartedAt: serverTimestamp(), exclusionList: [] });
      const freshSnap = await getDoc(gigRef);
      searchStartedAt = (freshSnap.data()?.searchStartedAt as Timestamp | undefined)?.toDate() ?? new Date();
    }

    const searchDeadline = searchStartedAt.getTime() + config.searchTimeoutMs;

    while (true) {
      if (Date.now() >= searchDeadline) {
        await updateDoc(gigRef, { status: "no_worker", assignedWorkerId: null, assignedWorkerName: null });
        return;
      }
      if (dispatchAttempts >= config.maxAttempts) {
        await updateDoc(gigRef, { status: "no_worker", assignedWorkerId: null, assignedWorkerName: null });
        return;
      }

      const gigSnap = await getDoc(gigRef);
      if (!gigSnap.exists()) return;
      const gigData = gigSnap.data();
      const status = (gigData.status as string | undefined) ?? "";
      if (["cancelled", "navigating", "arrived", "working", "completed", "no_worker"].includes(status)) return;

      const hostId = (gigData.hostId as string | undefined) ?? "";
      const excluded = [...((gigData.exclusionList as string[] | undefined) ?? []), ...(hostId ? [hostId] : [])];

      const worker = await findBestWorker(gigLocation, excluded, config.maxSearchRadiusKm);
      if (!worker) {
        await delay(RETRY_INTERVAL_MS);
        continue;
      }

      dispatchAttempts++;
      await dispatchToWorker(gigId, worker.id, worker.name);

      const reviewDeadline = Date.now() + config.reviewWindowMs;
      let finalStatus = "in_progress";
      while (Date.now() < reviewDeadline) {
        await delay(POLL_INTERVAL_MS);
        const check = await getDoc(gigRef);
        if (!check.exists()) return;
        const cs = (check.data()?.status as string | undefined) ?? "";
        if (cs !== "in_progress") {
          finalStatus = cs;
          break;
        }
      }

      if (["navigating", "arrived", "working", "completed", "cancelled"].includes(finalStatus)) return;
      if (finalStatus === "scanning") continue;

      const timedOutWorkerId = worker.id;
      if (Date.now() >= searchDeadline) {
        await Promise.all([
          updateDoc(gigRef, {
            status: "no_worker",
            assignedWorkerId: null,
            assignedWorkerName: null,
            exclusionList: arrayUnion(timedOutWorkerId),
          }),
          updateDoc(doc(db, "users", timedOutWorkerId), { slot: "AVAILABLE", acceptanceRate: increment(-0.05) }),
        ]);
        return;
      }

      await Promise.all([
        updateDoc(gigRef, {
          status: "scanning",
          assignedWorkerId: null,
          assignedWorkerName: null,
          exclusionList: arrayUnion(timedOutWorkerId),
        }),
        updateDoc(doc(db, "users", timedOutWorkerId), { slot: "AVAILABLE", acceptanceRate: increment(-0.05) }),
      ]);
    }
  } catch (err) {
    console.error(`[QuickGigMatching] auto-search error for ${gigId}:`, err);
    try {
      await updateDoc(gigRef, { status: "no_worker", assignedWorkerId: null, assignedWorkerName: null });
    } catch {
      // ignore — best-effort cleanup
    }
  }
}

// Mirrors _endMultiSlotSearch.
async function endMultiSlotSearch(gigRef: DocumentReference, workerSlots: number): Promise<void> {
  const snap = await getDoc(gigRef);
  const filled = (snap.data()?.filledSlotCount as number | undefined) ?? 0;
  await updateDoc(gigRef, {
    status: filled >= workerSlots ? "filled" : filled > 0 ? "partially_filled" : "no_worker",
  });
}

// Mirrors _runMultiSlotSearch.
async function runMultiSlotSearch(
  gigId: string,
  gigLocation: GigLocation,
  gigRef: DocumentReference
): Promise<void> {
  const config = await fetchConfig();
  let dispatchAttempts = 0;

  try {
    const initSnap = await getDoc(gigRef);
    if (!initSnap.exists()) return;
    const initData = initSnap.data();
    const workerSlots = (initData.workerSlots as number | undefined) ?? 1;
    const ratePerSlot = (initData.ratePerSlot as number | undefined) ?? (initData.budget as number | undefined) ?? 0;
    const currencyCode = (initData.currencyCode as string | undefined) ?? "USD";
    const hostId = (initData.hostId as string | undefined) ?? "";
    const hostName = (initData.hostName as string | undefined) ?? "";
    const initStatus = (initData.status as string | undefined) ?? "";
    const existingStartedAt = (initData.searchStartedAt as Timestamp | undefined)?.toDate();
    const isResuming = !!existingStartedAt && ["scanning", "partially_filled"].includes(initStatus);

    let searchStartedAt: Date;
    if (isResuming) {
      searchStartedAt = existingStartedAt!;
    } else {
      await updateDoc(gigRef, { searchStartedAt: serverTimestamp(), exclusionList: [], status: "scanning" });
      const freshSnap = await getDoc(gigRef);
      searchStartedAt = (freshSnap.data()?.searchStartedAt as Timestamp | undefined)?.toDate() ?? new Date();
    }

    const searchDeadline = searchStartedAt.getTime() + config.searchTimeoutMs;

    while (true) {
      const gigSnap = await getDoc(gigRef);
      if (!gigSnap.exists()) return;
      const gigData = gigSnap.data();
      const status = (gigData.status as string | undefined) ?? "";
      const filledSlotCount = (gigData.filledSlotCount as number | undefined) ?? 0;

      if (["cancelled", "no_worker", "filled", "completed"].includes(status)) return;
      if (filledSlotCount >= workerSlots) {
        await updateDoc(gigRef, { status: "filled" });
        return;
      }

      if (Date.now() >= searchDeadline || dispatchAttempts >= config.maxAttempts) {
        await endMultiSlotSearch(gigRef, workerSlots);
        return;
      }

      const excluded = [...((gigData.exclusionList as string[] | undefined) ?? []), ...(hostId ? [hostId] : [])];
      const worker = await findBestWorker(gigLocation, excluded, config.maxSearchRadiusKm);

      if (!worker) {
        await delay(RETRY_INTERVAL_MS);
        continue;
      }

      const candidateId = worker.id;
      const candidateName = worker.name;

      dispatchAttempts++;
      await dispatchToWorkerSlot({
        gigId,
        workerId: candidateId,
        workerName: candidateName,
        hostId,
        hostName,
        rate: ratePerSlot,
        currencyCode,
      });
      if (filledSlotCount === 0) await updateDoc(gigRef, { status: "scanning" });

      const slotRef = doc(db, "quick_gigs", gigId, "workers", candidateId);
      const reviewDeadline = Date.now() + config.reviewWindowMs;
      let finalStatus = "in_progress";

      while (Date.now() < reviewDeadline) {
        await delay(POLL_INTERVAL_MS);
        const check = await getDoc(slotRef);
        if (!check.exists()) {
          finalStatus = "declined";
          break;
        }
        const cs = (check.data()?.status as string | undefined) ?? "";
        if (cs !== "in_progress") {
          finalStatus = cs;
          break;
        }
      }

      if (finalStatus === "navigating") {
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(gigRef);
          const data = snap.data() ?? {};
          const filled = (data.filledSlotCount as number | undefined) ?? 0;
          const newFilled = filled + 1;
          tx.update(gigRef, {
            filledSlotCount: newFilled,
            status: newFilled >= workerSlots ? "filled" : "partially_filled",
          });
        });
        continue;
      }

      if (finalStatus === "cancelled") return;

      if (finalStatus === "in_progress") {
        await Promise.all([
          updateDoc(gigRef, { exclusionList: arrayUnion(candidateId) }),
          updateDoc(doc(db, "users", candidateId), { slot: "AVAILABLE", acceptanceRate: increment(-0.05) }),
          updateDoc(slotRef, { status: "declined" }).catch(() => {}),
        ]);
      }

      if (Date.now() >= searchDeadline) {
        await endMultiSlotSearch(gigRef, workerSlots);
        return;
      }
    }
  } catch (err) {
    console.error(`[QuickGigMatching] multi-slot auto-search error for ${gigId}:`, err);
    try {
      const snap = await getDoc(gigRef);
      const workerSlots = (snap.data()?.workerSlots as number | undefined) ?? 1;
      await endMultiSlotSearch(gigRef, workerSlots);
    } catch {
      // ignore — best-effort cleanup
    }
  }
}

// Mirrors startBackfillSearch — looks for one replacement worker for a slot
// a worker just cancelled out of on an already-dispatched multi-worker quick
// gig. Time-boxed to the same search_timeout_minutes as the initial search;
// if nobody accepts, the gig just carries on with whoever's left (same as a
// partial initial fill). Nothing in the web app calls this yet — there's no
// "worker cancels an accepted slot" action here today — but it's ported so
// the engine matches the app 1:1 and is ready once that action exists.
export async function startBackfillSearch(
  gigId: string,
  gigLocation: GigLocation,
  cancelledWorkerId: string
): Promise<void> {
  if (activeSearches.has(gigId)) return;
  activeSearches.add(gigId);
  try {
    const gigRef = doc(db, "quick_gigs", gigId);
    await runBackfillSlotSearch(gigId, gigLocation, gigRef, cancelledWorkerId);
  } finally {
    activeSearches.delete(gigId);
  }
}

async function runBackfillSlotSearch(
  gigId: string,
  gigLocation: GigLocation,
  gigRef: DocumentReference,
  cancelledWorkerId: string
): Promise<void> {
  const config = await fetchConfig();
  const searchDeadline = Date.now() + config.searchTimeoutMs;
  let dispatchAttempts = 0;

  try {
    await updateDoc(gigRef, { exclusionList: arrayUnion(cancelledWorkerId) });

    while (Date.now() < searchDeadline) {
      const gigSnap = await getDoc(gigRef);
      if (!gigSnap.exists()) return;
      const gigData = gigSnap.data();
      const status = (gigData.status as string | undefined) ?? "";
      const workerSlots = (gigData.workerSlots as number | undefined) ?? 1;
      const filledSlotCount = (gigData.filledSlotCount as number | undefined) ?? 0;

      if (["cancelled", "completed"].includes(status)) return;
      if (filledSlotCount >= workerSlots) return;
      if (dispatchAttempts >= config.maxAttempts) return;

      const hostId = (gigData.hostId as string | undefined) ?? "";
      const excluded = [...((gigData.exclusionList as string[] | undefined) ?? []), ...(hostId ? [hostId] : [])];

      const worker = await findBestWorker(gigLocation, excluded, config.maxSearchRadiusKm);
      if (!worker) {
        await delay(RETRY_INTERVAL_MS);
        continue;
      }

      const candidateId = worker.id;
      const candidateName = worker.name;

      dispatchAttempts++;
      await dispatchToWorkerSlot({
        gigId,
        workerId: candidateId,
        workerName: candidateName,
        hostId: (gigData.hostId as string | undefined) ?? "",
        hostName: (gigData.hostName as string | undefined) ?? "",
        rate: (gigData.ratePerSlot as number | undefined) ?? (gigData.budget as number | undefined) ?? 0,
        currencyCode: (gigData.currencyCode as string | undefined) ?? "USD",
      });

      const slotRef = doc(db, "quick_gigs", gigId, "workers", candidateId);
      const reviewDeadline = Date.now() + config.reviewWindowMs;
      let finalStatus = "in_progress";

      while (Date.now() < reviewDeadline && Date.now() < searchDeadline) {
        await delay(POLL_INTERVAL_MS);
        const check = await getDoc(slotRef);
        if (!check.exists()) {
          finalStatus = "declined";
          break;
        }
        const cs = (check.data()?.status as string | undefined) ?? "";
        if (cs !== "in_progress") {
          finalStatus = cs;
          break;
        }
      }

      if (finalStatus === "navigating") {
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(gigRef);
          const data = snap.data() ?? {};
          const filled = (data.filledSlotCount as number | undefined) ?? 0;
          const newFilled = filled + 1;
          tx.update(gigRef, {
            filledSlotCount: newFilled,
            status: newFilled >= workerSlots ? "filled" : "partially_filled",
          });
        });
        return;
      }

      if (finalStatus === "cancelled") return;

      if (finalStatus === "in_progress") {
        await Promise.all([
          updateDoc(gigRef, { exclusionList: arrayUnion(candidateId) }),
          updateDoc(doc(db, "users", candidateId), { slot: "AVAILABLE", acceptanceRate: increment(-0.05) }),
          updateDoc(slotRef, { status: "declined" }).catch(() => {}),
        ]);
      }
      // Otherwise (declined) — loop again if time remains.
    }
  } catch (err) {
    console.error(`[QuickGigMatching] backfill search error for ${gigId}:`, err);
  }
}
