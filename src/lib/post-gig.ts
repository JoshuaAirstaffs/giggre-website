import {
  GeoPoint,
  Timestamp,
  addDoc,
  arrayRemove,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// Mirrors the host app's gig-posting flow — see
// giggre_app/lib/features/gig_host/models/{quick,open,offered}_gig_model.dart
// and the matching post_*_gig_screen.dart files. Quick/Open/Offered are
// separate screens there; on web they're one page with a type picker instead.

export type PostGigType = "quick" | "open" | "offered";

export type ExperienceLevel = "entry" | "intermediate" | "expert";

export const EXPERIENCE_LEVEL_OPTIONS: { value: ExperienceLevel; label: string }[] = [
  { value: "entry", label: "Entry Level" },
  { value: "intermediate", label: "Intermediate" },
  { value: "expert", label: "Expert" },
];

export interface GigLocation {
  lat: number;
  lng: number;
}

export interface CommonGigInput {
  hostId: string;
  hostName: string;
  title: string;
  description: string;
  budget: number;
  currencyCode: string;
  location: GigLocation;
  address: string;
  scheduledDate: Date | null;
  workerSlots: number;
}

function commonGigFields(input: CommonGigInput) {
  return {
    hostId: input.hostId,
    hostName: input.hostName,
    title: input.title,
    description: input.description,
    budget: input.budget,
    currencyCode: input.currencyCode,
    location: new GeoPoint(input.location.lat, input.location.lng),
    address: input.address,
    createdAt: serverTimestamp(),
    ...(input.scheduledDate ? { scheduledDate: Timestamp.fromDate(input.scheduledDate) } : {}),
    workerSlots: input.workerSlots,
    ratePerSlot: input.budget,
    filledSlotCount: 0,
    slotsCompleted: 0,
  };
}

// Quick gigs are dispatched automatically to nearby workers by the mobile
// app's client-side matching service — category/duration are fixed values
// the mobile screen hardcodes too (see quick_gig_matching_service.dart).
export async function postQuickGig(input: CommonGigInput): Promise<string> {
  const ref = await addDoc(collection(db, "quick_gigs"), {
    ...commonGigFields(input),
    gigType: "quick",
    category: "Quick",
    duration: "Flexible",
    status: "scanning",
    exclusionList: [],
  });
  return ref.id;
}

export interface OpenGigInput extends CommonGigInput {
  requiredSkill: string;
  experienceLevel: ExperienceLevel;
}

// Open gigs are visible to every nearby worker until one applies and the
// host accepts — `requiredSkills` stays an array for schema compatibility
// with the mobile app, though the host only ever picks one skill here.
export async function postOpenGig(input: OpenGigInput): Promise<string> {
  const ref = await addDoc(collection(db, "open_gigs"), {
    ...commonGigFields(input),
    gigType: "open",
    requiredSkills: [input.requiredSkill],
    experienceLevel: input.experienceLevel,
    status: "open",
  });
  return ref.id;
}

export interface OfferedGigInput extends Omit<CommonGigInput, "workerSlots"> {
  skillRequired: string;
  experienceLevel: ExperienceLevel;
  // One or more recipients the host picked — workerSlots is derived as
  // workers.length, same as post_offered_gig_screen.dart's isSingle branch
  // (there's no separate host-set target count for offered gigs; whichever
  // workers get picked *is* the slot count).
  workers: WorkerLookupResult[];
}

// Offered gigs go to one or more specific workers the host picks (favorites
// or an exact Giggre-ID lookup). A single recipient's identity lives right on
// the gig doc; two or more each get their own doc in a `workers`
// subcollection instead — mirrors OfferedGigModel/WorkerSlotModel.
export async function postOfferedGig(input: OfferedGigInput): Promise<string> {
  const workerSlots = input.workers.length;
  const isSingle = workerSlots === 1;

  const ref = await addDoc(collection(db, "offered_gigs"), {
    ...commonGigFields({ ...input, workerSlots }),
    gigType: "offered",
    skillRequired: input.skillRequired,
    experienceLevel: input.experienceLevel,
    status: "offered",
    ...(isSingle ? { workerId: input.workers[0].uid, workerName: input.workers[0].name } : {}),
  });

  if (!isSingle) {
    const batch = writeBatch(db);
    for (const worker of input.workers) {
      batch.set(doc(db, "offered_gigs", ref.id, "workers", worker.uid), {
        workerId: worker.uid,
        workerName: worker.name,
        gigId: ref.id,
        gigCollection: "offered_gigs",
        hostId: input.hostId,
        hostName: input.hostName,
        rate: input.budget,
        currencyCode: input.currencyCode,
        status: "offered",
        offeredAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }

  return ref.id;
}

export interface WorkerLookupResult {
  uid: string;
  userId: string;
  name: string;
  email: string;
  photoUrl: string;
  ratingAsWorker: number;
  ratingCount: number;
  skills: string[];
  isOnline: boolean;
  isVerified: boolean;
  completedGigs: number;
}

function toWorkerLookupResult(uid: string, data: Record<string, unknown>): WorkerLookupResult {
  const earnings = data.earnings as Record<string, unknown> | undefined;
  return {
    uid,
    userId: (data.userId as string) ?? "",
    name: (data.name as string) || "Unknown",
    email: (data.email as string) ?? "",
    photoUrl: (data.photoUrl as string) ?? "",
    ratingAsWorker: (data.ratingAsWorker as number | undefined) ?? 0,
    ratingCount: (data.ratingCount as number | undefined) ?? 0,
    skills: (data.skills as string[] | undefined) ?? [],
    isOnline: (data.isOnline as boolean | undefined) ?? false,
    isVerified: (data.isVerified as string | undefined) === "verified",
    completedGigs: (earnings?.completedGigs as number | undefined) ?? 0,
  };
}

const USER_ID_FORMAT = /^[A-Z]{3}\d{6}$/;

// Same fallback the mobile worker-picker (_WorkerPickerSheet in
// post_offered_gig_screen.dart) uses when no favorite matches the search —
// an exact match on the human-readable Giggre ID, e.g. "YSJ135610".
export async function findWorkerByUserId(userId: string): Promise<WorkerLookupResult | null> {
  const normalized = userId.trim().toUpperCase();
  if (!USER_ID_FORMAT.test(normalized)) return null;

  const snap = await getDocs(query(collection(db, "users"), where("userId", "==", normalized)));
  if (snap.empty) return null;

  const found = snap.docs[0];
  return toWorkerLookupResult(found.id, found.data());
}

// Mirrors _WorkerPickerSheet._loadFavorites in post_offered_gig_screen.dart —
// reads the host's own `favoriteWorkerIds` and fetches each of those worker
// profiles. Skips ids that no longer resolve to a user doc.
export async function fetchFavoriteWorkers(hostId: string): Promise<WorkerLookupResult[]> {
  const hostSnap = await getDoc(doc(db, "users", hostId));
  const ids = ((hostSnap.data()?.favoriteWorkerIds as string[] | undefined) ?? []).filter((id) => id !== hostId);
  if (ids.length === 0) return [];

  const docs = await Promise.all(ids.map((id) => getDoc(doc(db, "users", id))));
  return docs.filter((d) => d.exists()).map((d) => toWorkerLookupResult(d.id, d.data()!));
}

// Mirrors _unfavorite in favorite_workers_sheet.dart — hosts can only add a
// worker to favorites from the mobile app today (see gig_detail_sheet.dart's
// "Favorite worker" toggle on a completed gig), so removal is the only
// favorites write the website needs.
export async function removeFavoriteWorker(hostId: string, workerId: string): Promise<void> {
  await updateDoc(doc(db, "users", hostId), { favoriteWorkerIds: arrayRemove(workerId) });
}

// Used to re-fetch a single worker fresh (e.g. after picking one from the
// Favorites page's "Quick Offer" button and landing on the Offered-gig form
// with just their uid in the URL) rather than threading the whole
// WorkerLookupResult through query params.
export async function fetchWorkerByUid(uid: string): Promise<WorkerLookupResult | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return toWorkerLookupResult(snap.id, snap.data()!);
}

export interface ReverseGeocodeResult {
  address: string | null;
  countryCode: string | null;
}

// Reverse-geocodes via Nominatim to prefill an editable address field and
// determine the gig's currency (see currencyCodeForCountry below) after the
// host sets a location — one request for both, same provider/usage-policy
// constraints as countryCodeFromCoordinates in browse-gigs.ts.
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?${new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: "json",
    })}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return { address: null, countryCode: null };
    const data = await res.json();
    const countryCode = data?.address?.country_code as string | undefined;
    return {
      address: (data?.display_name as string | undefined) ?? null,
      countryCode: countryCode ? countryCode.toUpperCase() : null,
    };
  } catch {
    return { address: null, countryCode: null };
  }
}

// This app only supports PH/US currencies (same as the mobile app — see
// currencySymbol in lib/utils.ts) — a gig located in the Philippines is
// priced in PHP, everything else defaults to USD.
export function currencyCodeForCountry(countryCode: string | null): string {
  return countryCode === "PH" ? "PHP" : "USD";
}
