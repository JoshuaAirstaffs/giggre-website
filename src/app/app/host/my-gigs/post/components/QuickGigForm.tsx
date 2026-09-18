"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Timestamp, doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { useAppSelector } from "@/store/hooks";
import { postQuickGig } from "@/lib/post-gig";
import { startAutoSearch } from "@/lib/quick-gig-matching";
import { useCommonGigFields } from "./useCommonGigFields";
import { CommonGigDetails, CommonGigSchedule } from "./CommonGigFields";

// Statuses quick_gig_matching_service.dart can still be actively working
// through — the gig may bounce back to "scanning" more than once (e.g. a
// dispatched worker declines and it resumes searching), so none of these are
// final on their own.
const QUICK_GIG_SEARCHING_STATUSES = ["scanning", "in_progress", "partially_filled"];

// A worker accepting a single-slot quick gig moves it straight to
// "navigating" (then "arrived"/"working"/"completed" as the job progresses)
// — quick_gig_matching_service.dart only ever writes "filled" for a
// multi-slot gig once filledSlotCount reaches workerSlots. Checking for
// "filled" alone wrongly treated every accepted single-slot gig as
// unmatched.
const QUICK_GIG_SUCCESS_STATUSES = ["navigating", "arrived", "working", "completed", "filled"];

// The engine's own default search_timeout_minutes (quick_gig_matching_service.dart's
// _defaultSearchTimeoutMinutes) — but that engine only ever runs inside the
// mobile app, never on web, so a gig posted here has nothing actually
// dispatching it unless the host (or someone) has the app open. This is a
// client-side fallback so the toast doesn't just spin forever in that case —
// it does not touch the gig's Firestore status.
const SEARCH_TIMEOUT_MS = 5 * 60 * 1000;

// Persists which gig is being watched so the toast survives a page reload —
// sonner's toasts and any in-memory listener are wiped when the page
// reloads, but the search itself (in Firestore) isn't.
const SEARCH_STORAGE_KEY = "quickGigSearchId";

function loadWatchedGigId(): string | null {
  try {
    return localStorage.getItem(SEARCH_STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveWatchedGigId(gigId: string) {
  try {
    localStorage.setItem(SEARCH_STORAGE_KEY, gigId);
  } catch {
    // ignore — worst case the toast just won't survive a reload
  }
}

function clearWatchedGigId() {
  try {
    localStorage.removeItem(SEARCH_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export default function QuickGigForm() {
  const { authUser, profile } = useAppSelector((root) => root.user);
  const { fields, setField, setLocation, locating, captureLocation, reset, validateCommon, checkContent, getScheduledDate, currencyCode } = useCommonGigFields();
  const [submitting, setSubmitting] = useState(false);
  const [lastGigId, setLastGigId] = useState<string | null>(null);
  const unsubscribeSearchRef = useRef<(() => void) | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function stopWatchingSearch() {
    unsubscribeSearchRef.current?.();
    unsubscribeSearchRef.current = null;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = null;
  }

  // Stop watching a gig's search status if the host navigates away from this
  // form entirely — the toast just stops updating rather than lingering
  // wrong. Deliberately does NOT clear the persisted gig id: the search
  // itself lives in Firestore, not in this component, so a reload (or
  // coming back to this page) should still be able to resume watching it.
  useEffect(() => stopWatchingSearch, []);

  // On mount, resume watching whatever gig (if any) was left mid-search —
  // otherwise a reload would silently drop the toast even though the real
  // search (in Firestore) is still going.
  useEffect(() => {
    const gigId = loadWatchedGigId();
    if (!gigId) return;
    getDoc(doc(db, "quick_gigs", gigId))
      .then((snap) => {
        const data = snap.data();
        if (!data) {
          clearWatchedGigId();
          return;
        }
        const title = (data.title as string | undefined) ?? "";
        const workerSlots = (data.workerSlots as number | undefined) ?? 1;
        const status = data.status as string | undefined;
        const startedAt = (data.createdAt as Timestamp | undefined)?.toDate() ?? new Date();
        if (status && QUICK_GIG_SEARCHING_STATUSES.includes(status)) {
          watchQuickGigSearch(gigId, title, workerSlots, startedAt);
        } else {
          // Already resolved while the page was away — surface the outcome
          // once instead of just silently dropping it.
          finishQuickGigSearch(gigId, title, data);
          clearWatchedGigId();
        }
      })
      .catch(() => clearWatchedGigId());
    // Runs once on mount to resume whatever was persisted — not tied to any
    // reactive value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function slotsLabel(slots: number, filled: number) {
    const available = Math.max(slots - filled, 0);
    return `${available} of ${slots} slot${slots === 1 ? "" : "s"} available`;
  }

  function finishQuickGigSearch(gigId: string, title: string, data: Record<string, unknown> | undefined) {
    const toastId = `quick-gig-search-${gigId}`;
    const label = title ? `"${title}"` : "your quick gig";
    const status = data?.status as string | undefined;
    const slots = slotsLabel(
      (data?.workerSlots as number | undefined) ?? 1,
      (data?.filledSlotCount as number | undefined) ?? 0
    );
    if (status && QUICK_GIG_SUCCESS_STATUSES.includes(status)) {
      toast.success(`A worker was found for ${label}! (${slots})`, { id: toastId, position: "bottom-right" });
    } else {
      toast.error(`No worker was available for ${label}. (${slots})`, { id: toastId, position: "bottom-right" });
    }
  }

  // Mirrors the app's own real behavior for this (no toast there at all —
  // a Firestore-listener-driven status badge/sheet instead, since the search
  // can take anywhere from seconds to minutes): keeps one toast open and
  // updates it in place as the gig's real `status` changes, rather than
  // guessing a fixed duration. `title`/`workerSlots` are passed in
  // explicitly — by the time this resolves, `reset()` has already cleared
  // the form's own fields. `startedAt` defaults to now (a fresh post) but is
  // the gig's own `createdAt` when resuming after a reload, so the 5-minute
  // timeout counts from when the search actually began, not from reload time.
  function watchQuickGigSearch(gigId: string, title: string, workerSlots: number, startedAt: Date = new Date()) {
    stopWatchingSearch();
    saveWatchedGigId(gigId);
    const toastId = `quick-gig-search-${gigId}`;
    const label = title ? `"${title}"` : "your quick gig";

    toast.loading(`Searching nearby workers for ${label} (${slotsLabel(workerSlots, 0)})…`, {
      id: toastId,
      duration: Infinity,
      position: "bottom-right",
    });

    const remaining = Math.max(SEARCH_TIMEOUT_MS - (Date.now() - startedAt.getTime()), 0);
    searchTimeoutRef.current = setTimeout(() => {
      toast.error(`Still searching for ${label} after 5 minutes — check back later.`, {
        id: toastId,
        position: "bottom-right",
      });
      stopWatchingSearch();
      clearWatchedGigId();
    }, remaining);

    unsubscribeSearchRef.current = onSnapshot(doc(db, "quick_gigs", gigId), (snap) => {
      const data = snap.data();
      const status = data?.status as string | undefined;
      const slots = slotsLabel(
        (data?.workerSlots as number | undefined) ?? workerSlots,
        (data?.filledSlotCount as number | undefined) ?? 0
      );
      if (!status || QUICK_GIG_SEARCHING_STATUSES.includes(status)) {
        toast.loading(`Searching nearby workers for ${label} (${slots})…`, {
          id: toastId,
          duration: Infinity,
          position: "bottom-right",
        });
        return;
      }
      if (status && QUICK_GIG_SUCCESS_STATUSES.includes(status)) {
        toast.success(`A worker was found for ${label}! (${slots})`, { id: toastId, position: "bottom-right" });
      } else {
        toast.error(`No worker was available for ${label}. (${slots})`, { id: toastId, position: "bottom-right" });
      }
      clearWatchedGigId();
      stopWatchingSearch();
    });
  }

  async function handleSubmit() {
    if (!authUser?.uid) return;
    const error = validateCommon();
    if (error) return toast.error(error);
    const contentError = await checkContent();
    if (contentError) return toast.error(contentError);

    setSubmitting(true);
    try {
      const gigId = await postQuickGig({
        hostId: authUser.uid,
        hostName: profile?.name ?? "",
        title: fields.title.trim(),
        description: fields.description.trim(),
        budget: Number(fields.budget),
        currencyCode,
        location: fields.location!,
        address: fields.address.trim(),
        scheduledDate: getScheduledDate(),
        workerSlots: Number(fields.workerSlots),
      });
      toast.success("Gig Successfully Posted");
      setLastGigId(gigId);
      // No server-side dispatch exists yet (quick_gig_matching_service.dart
      // only runs client-side) — run the same search loop here so this tab
      // is the one that dispatches to nearby workers, same as the app does
      // for whichever device posts the gig. Fire-and-forget: watchQuickGigSearch
      // already reflects its progress via the gig's own Firestore status.
      startAutoSearch(gigId, fields.location!).catch((err) =>
        console.error("Quick gig auto-search failed:", err)
      );
      watchQuickGigSearch(gigId, fields.title.trim(), Number(fields.workerSlots));
      reset();
    } catch (err) {
      console.error("Failed to post quick gig:", err);
      toast.error("Couldn't post the gig. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Quick gigs are dispatched automatically to nearby available workers — no need to review applicants.
      </p>
      <div className="grid gap-x-8 gap-y-4 lg:grid-cols-2">
        <CommonGigDetails fields={fields} setField={setField} currencyCode={currencyCode} />
        <CommonGigSchedule
          fields={fields}
          setField={setField}
          setLocation={setLocation}
          locating={locating}
          captureLocation={captureLocation}
        />
      </div>
      <Button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full p-6 bg-(--quick-start) text-white hover:bg-(--quick-end)"
      >
        {submitting ? "Posting…" : "Post Quick Gig"}
      </Button>
      {lastGigId && (
        <p className="text-xs text-muted">
          Gig ID (quick_gigs): <code className="font-mono">{lastGigId}</code>
        </p>
      )}
    </div>
  );
}
