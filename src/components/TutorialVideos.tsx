"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { doc, onSnapshot } from "firebase/firestore";
import {
  durationLabel, fetchTutorialVideos, forRegion, signedInPhilippines, thumbnailOf, visitorInPhilippines,
  type Placement, type TutorialVideo,
} from "@/lib/tutorial-videos";
import { searchTutorialVideos } from "@/lib/tutorial-search";
import { useAppSelector } from "@/store/hooks";

// Website side of the app's tutorial videos (giggre-admin → Content
// Management → Tutorial Videos). Same videos, same English / Tagalog choice,
// same flexible search. Language, like the app (tutorial_region.dart):
//   signed in  → the Gig Wallet's currency (₱ = Tagalog), else the account's
//                detected country / currency
//   visitors   → browser time zone (Asia/Manila) or a PH / Filipino language
//   otherwise  → English

/** wallets/{uid}.currencyCode, live (null = no wallet / not signed in). */
function useWalletCurrency(uid: string | undefined): string | null {
  const [ccy, setCcy] = useState<{ uid: string; code: string | null } | null>(null);
  useEffect(() => {
    if (!uid) return;
    let unsub: (() => void) | undefined;
    let alive = true;
    import("@/lib/firebase").then(({ db }) => {
      if (!alive) return;
      unsub = onSnapshot(
        doc(db, "wallets", uid),
        (snap) => {
          const c = snap.data()?.currencyCode;
          setCcy({ uid, code: typeof c === "string" && c ? c : null });
        },
        () => setCcy({ uid, code: null }),
      );
    }).catch(() => {});
    return () => {
      alive = false;
      unsub?.();
    };
  }, [uid]);
  return uid && ccy?.uid === uid ? ccy.code : null;
}

function useTutorialVideos() {
  const [videos, setVideos] = useState<TutorialVideo[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [browserPh, setBrowserPh] = useState(false);
  const uid = useAppSelector((root) => root.user.authUser?.uid);
  const profile = useAppSelector((root) => root.user.profile) as
    | { countryCode?: string; currencyCode?: string }
    | null
    | undefined;
  const walletCurrency = useWalletCurrency(uid);
  const ph =
    (uid
      ? signedInPhilippines({ walletCurrency, countryCode: profile?.countryCode, currencyCode: profile?.currencyCode })
      : null) ?? browserPh;
  useEffect(() => {
    let alive = true;
    fetchTutorialVideos()
      .then((v) => {
        if (!alive) return;
        // Browser-only check (time zone / language), decided with the data so
        // the right language shows from the first render of the videos.
        setBrowserPh(visitorInPhilippines());
        setVideos(v);
      })
      .catch((e) => {
        console.error("[TutorialVideos]", e);
        if (alive) {
          setFailed(true);
          setVideos([]);
        }
      });
    return () => {
      alive = false;
    };
  }, []);
  return { videos, failed, ph };
}

const inPlacement = (all: TutorialVideo[], p: Placement) => all.filter((v) => v.placements.includes(p));

// ── Card + player ─────────────────────────────────────────────────────────────

function PlayIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
    </svg>
  );
}

function VideoCard({ video, index, onPlay }: { video: TutorialVideo; index: number; onPlay: () => void }) {
  const thumb = thumbnailOf(video);
  const dur = durationLabel(video.durationSec);
  return (
    <motion.button
      type="button"
      onClick={onPlay}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay: Math.min(index, 6) * 0.06, duration: 0.35 }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-hairline bg-paper text-left transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{ outlineColor: "var(--worker-start)" }}
      aria-label={`Play video: ${video.title}`}
    >
      <div
        className="relative aspect-video w-full"
        style={{ background: "linear-gradient(135deg, var(--worker-end), var(--worker-start))" }}
      >
        {thumb && (
          // Remote Firebase Storage / YouTube images — plain <img> keeps next.config untouched.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <span className="absolute inset-0 bg-black/15 transition-colors group-hover:bg-black/25" />
        <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-transform group-hover:scale-110">
          <PlayIcon />
        </span>
        {dur && (
          <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 font-[var(--font-mono)] text-[11px] font-medium text-white">
            {dur}
          </span>
        )}
        {video.isYoutube && (
          <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 font-[var(--font-mono)] text-[10px] uppercase tracking-wide text-white">
            YouTube
          </span>
        )}
      </div>
      <div className="p-4">
        <p className="font-medium text-ink">{video.title}</p>
        {video.description && <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">{video.description}</p>}
      </div>
    </motion.button>
  );
}

function PlayerModal({ video, onClose }: { video: TutorialVideo; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={video.title}
    >
      <motion.div
        className="w-full max-w-4xl"
        initial={{ scale: 0.96, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 8 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-4">
          <p className="truncate font-medium text-white">{video.title}</p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Close video"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
          {video.isYoutube ? (
            <iframe
              className="h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&rel=0`}
              title={video.title}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          ) : (
            <video className="h-full w-full" src={video.videoUrl} controls autoPlay playsInline />
          )}
        </div>
        {video.description && <p className="mt-3 text-sm text-white/70">{video.description}</p>}
      </motion.div>
    </motion.div>
  );
}

// ── Home page section (like the app's Welcome "Watch how it works") ──────────

export function TutorialVideosSection() {
  const { videos, ph } = useTutorialVideos();
  const [playing, setPlaying] = useState<TutorialVideo | null>(null);
  const library = useMemo(() => (videos ? inPlacement(videos, "help") : []), [videos]);
  const shown = useMemo(() => {
    if (!videos) return [];
    const welcome = inPlacement(videos, "welcome");
    return (welcome.length ? welcome : library).slice(0, 3).map((v) => forRegion(v, ph));
  }, [videos, library, ph]);

  // Nothing published → no section at all (same as the app).
  if (shown.length === 0) return null;

  return (
    <section id="tutorials" className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-10 flex flex-wrap items-end justify-between gap-4"
        >
          <div className="max-w-xl">
            <h2 className="font-[var(--font-display)] text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Watch how it works
            </h2>
            <p className="mt-3 text-muted">
              {ph ? "Maikling video para makapagsimula ka sa Giggre." : "Short videos to get you started on Giggre."}
            </p>
          </div>
          {library.length > 0 && (
            <Link
              href="/tutorials"
              className="rounded-full border border-hairline px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper"
            >
              All video tutorials →
            </Link>
          )}
        </motion.div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((v, i) => (
            <VideoCard key={v.id} video={v} index={i} onPlay={() => setPlaying(v)} />
          ))}
        </div>
      </div>
      <AnimatePresence>{playing && <PlayerModal video={playing} onClose={() => setPlaying(null)} />}</AnimatePresence>
    </section>
  );
}

// ── /tutorials page (like the app's Profile → Settings → Video Tutorials) ───

export function TutorialLibrary({ hideIntro = false }: { hideIntro?: boolean } = {}) {
  const { videos, failed, ph } = useTutorialVideos();
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState<TutorialVideo | null>(null);
  const library = useMemo(() => (videos ? inPlacement(videos, "help") : []), [videos]);
  // Search both languages, then show the visitor's version.
  const results = useMemo(
    () => searchTutorialVideos(library, query).map((v) => forRegion(v, ph)),
    [library, query, ph],
  );
  const searching = query.trim().length > 0;

  return (
    <div>
      {!hideIntro && (
        <>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-[var(--font-mono)] text-xs"
            style={{ background: "var(--worker-tint)", color: "var(--worker-text)" }}
          >
            <PlayIcon size={11} />
            Video Tutorials
          </span>
          <h1 className="mt-4 font-[var(--font-display)] text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Learn Giggre in a few minutes.
          </h1>
          <p className="mt-3 max-w-xl text-muted">
            The same how-to videos you&apos;ll find in the app under Profile → Settings → Video Tutorials.
          </p>
        </>
      )}

      <div className={hideIntro ? "relative mt-6 max-w-xl" : "relative mt-8 max-w-xl"}>
        <svg
          viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Search videos, e.g. "sign up" or "top up"'
          aria-label="Search video tutorials"
          className="w-full rounded-2xl border border-hairline bg-paper py-3 pl-11 pr-11 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2"
          style={{ ["--tw-ring-color" as string]: "var(--worker-start)" }}
        />
        {searching && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:text-ink"
            aria-label="Clear search"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
      {searching && results.length > 0 && (
        <p className="mt-3 font-[var(--font-mono)] text-xs text-muted">
          {results.length} video{results.length === 1 ? "" : "s"} found
        </p>
      )}

      <div className="mt-8">
        {videos == null ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl border border-hairline bg-paper" />
            ))}
          </div>
        ) : library.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-hairline p-10 text-center text-muted">
            {failed ? "Couldn't load the videos. Please refresh the page." : "No video tutorials yet — check back soon."}
          </p>
        ) : results.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-hairline p-10 text-center text-muted">
            No videos match &ldquo;{query.trim()}&rdquo;. Try another word, like &ldquo;register&rdquo; or &ldquo;wallet&rdquo;.
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((v, i) => (
              <VideoCard key={v.id} video={v} index={i} onPlay={() => setPlaying(v)} />
            ))}
          </div>
        )}
      </div>
      <AnimatePresence>{playing && <PlayerModal video={playing} onClose={() => setPlaying(null)} />}</AnimatePresence>
    </div>
  );
}

// ── Log In / Sign Up pages (like the app's "Need help logging in?" /
// "How to register" rows) ─────────────────────────────────────────────────

export function TutorialVideosStrip({ placement, title }: { placement: Placement; title: string }) {
  const { videos, ph } = useTutorialVideos();
  const [playing, setPlaying] = useState<TutorialVideo | null>(null);
  const shown = useMemo(
    () => (videos ? inPlacement(videos, placement).map((v) => forRegion(v, ph)) : []),
    [videos, placement, ph],
  );
  if (shown.length === 0) return null;

  return (
    <div className="mt-10">
      <p className="flex items-center gap-1.5 text-sm font-medium text-muted">
        <PlayIcon size={13} />
        {title}
      </p>
      <div className="mt-3 space-y-3">
        {shown.map((v) => {
          const thumb = thumbnailOf(v);
          const dur = durationLabel(v.durationSec);
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setPlaying(v)}
              className="group flex w-full items-center gap-3 overflow-hidden rounded-xl border border-hairline bg-paper text-left transition-colors hover:border-ink/30"
              aria-label={`Play video: ${v.title}`}
            >
              <span
                className="relative aspect-video w-32 flex-shrink-0"
                style={{ background: "linear-gradient(135deg, var(--worker-end), var(--worker-start))" }}
              >
                {thumb && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                )}
                <span className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white">
                  <PlayIcon size={14} />
                </span>
                {dur && (
                  <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 font-[var(--font-mono)] text-[10px] text-white">
                    {dur}
                  </span>
                )}
              </span>
              <span className="min-w-0 py-2 pr-3">
                <span className="block truncate text-sm font-medium text-ink">{v.title}</span>
                {v.description && <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{v.description}</span>}
              </span>
            </button>
          );
        })}
      </div>
      <AnimatePresence>{playing && <PlayerModal video={playing} onClose={() => setPlaying(null)} />}</AnimatePresence>
    </div>
  );
}
