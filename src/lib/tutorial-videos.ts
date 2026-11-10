import { collection, getDocs } from "firebase/firestore";

// Tutorial videos — the same admin-managed library the Giggre app shows
// (giggre-admin → Content Management → Tutorial Videos). Mirrors
// giggre_app lib/features/tutorial_videos/tutorial_videos_service.dart.
//
//   app_content/tutorial_videos/items/{id}
//     { title, description, keywords[], placements[welcome|login|signup|help],
//       source: upload|youtube, videoUrl, youtubeUrl, youtubeId, thumbnailUrl,
//       durationSec, published, order,
//       tl: null | { source, videoUrl, youtubeUrl, youtubeId, thumbnailUrl,
//                    durationSec, title, description } }
//
// Top-level media = English (the default); `tl` = Tagalog, shown to visitors
// in the Philippines. Public read (firestore.rules app_content).
//
// On the website:
//   home page "Watch how it works"  = placement `welcome` (like the app's
//                                     Welcome screen), else the library
//   /tutorials, /app/{worker,host}/tutorials
//                                   = placement `help` ("Video Tutorials",
//                                     the app's Profile → Settings library)
//   Log In / Sign Up pages          = placements `login` / `signup`

export type Placement = "welcome" | "login" | "signup" | "help";

export interface TutorialVideo {
  id: string;
  title: string;
  description: string;
  keywords: string[];
  placements: Placement[];
  isYoutube: boolean;
  videoUrl: string;
  youtubeUrl: string;
  youtubeId: string;
  thumbnailUrl: string;
  durationSec: number | null;
  order: number;
  /** Tagalog version (title/description already fall back to English). */
  tagalog: TutorialVideo | null;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);
const PLACEMENTS: Placement[] = ["welcome", "login", "signup", "help"];

const playable = (v: Pick<TutorialVideo, "isYoutube" | "youtubeId" | "videoUrl">) =>
  v.isYoutube ? !!v.youtubeId : !!v.videoUrl;

function parse(id: string, d: Record<string, unknown>): TutorialVideo | null {
  if (d.published !== true) return null;
  const base: TutorialVideo = {
    id,
    title: str(d.title),
    description: str(d.description),
    keywords: Array.isArray(d.keywords) ? (d.keywords as unknown[]).map(str).filter(Boolean) : [],
    placements: Array.isArray(d.placements)
      ? (d.placements as unknown[]).filter((p): p is Placement => PLACEMENTS.includes(p as Placement))
      : [],
    isYoutube: d.source === "youtube",
    videoUrl: str(d.videoUrl),
    youtubeUrl: str(d.youtubeUrl),
    youtubeId: str(d.youtubeId),
    thumbnailUrl: str(d.thumbnailUrl),
    durationSec: num(d.durationSec),
    order: num(d.order) ?? 0,
    tagalog: null,
  };
  if (!base.title || !playable(base)) return null;
  const t = d.tl as Record<string, unknown> | null | undefined;
  if (t && typeof t === "object") {
    const tl: TutorialVideo = {
      ...base,
      id: `${id}_tl`,
      title: str(t.title) || base.title,
      description: str(t.description) || base.description,
      isYoutube: t.source === "youtube",
      videoUrl: str(t.videoUrl),
      youtubeUrl: str(t.youtubeUrl),
      youtubeId: str(t.youtubeId),
      thumbnailUrl: str(t.thumbnailUrl),
      durationSec: num(t.durationSec),
      tagalog: null,
    };
    if (playable(tl)) base.tagalog = tl;
  }
  return base;
}

/** Every published, playable tutorial video, in the admin's order. */
export async function fetchTutorialVideos(): Promise<TutorialVideo[]> {
  // Loaded lazily so a missing / bad Firebase config (e.g. no .env.local in
  // local dev) only hides the videos instead of crashing the home page.
  const { db } = await import("@/lib/firebase");
  const snap = await getDocs(collection(db, "app_content", "tutorial_videos", "items"));
  return snap.docs
    .map((d) => parse(d.id, d.data()))
    .filter((v): v is TutorialVideo => v != null)
    .sort((a, b) => a.order - b.order);
}

/** The version a visitor sees: Tagalog in the Philippines when there is one. */
export const forRegion = (v: TutorialVideo, philippines: boolean): TutorialVideo =>
  philippines && v.tagalog ? v.tagalog : v;

/**
 * Same rule as the app (tutorial_region.dart) for a signed-in user: the Gig
 * Wallet's currency (PHP = Philippines) — what the wallet's ₱ / $ shows —
 * else their detected country, else their account currency. Returns null
 * when none is known, so the caller falls back to [visitorInPhilippines].
 */
export function signedInPhilippines(input: {
  walletCurrency?: string | null;
  countryCode?: string | null;
  currencyCode?: string | null;
}): boolean | null {
  if (input.walletCurrency) return input.walletCurrency.toUpperCase() === "PHP";
  if (input.countryCode) return input.countryCode.toUpperCase() === "PH";
  if (input.currencyCode === "PHP") return true;
  return null;
}

/**
 * Whether the visitor is in the Philippines — without any permission prompt:
 * the browser's time zone (Asia/Manila) or a Philippine / Filipino language
 * setting. Anything else → English (the default).
 */
export function visitorInPhilippines(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === "Asia/Manila") return true;
  } catch {
    // ignore
  }
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  return langs.some((l) => {
    const [lang, region] = (l ?? "").toLowerCase().split("-");
    return region === "ph" || lang === "fil" || lang === "tl";
  });
}

export const thumbnailOf = (v: TutorialVideo): string | null =>
  v.thumbnailUrl || (v.isYoutube && v.youtubeId ? `https://img.youtube.com/vi/${v.youtubeId}/hqdefault.jpg` : null);

export const durationLabel = (s: number | null) =>
  s == null ? null : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
