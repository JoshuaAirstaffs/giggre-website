import { useCallback, useEffect, useMemo, useState } from "react";

// Gigs the worker has opened, so Browse can show unseen ones differently
// (bold title, outline, raised) — same idea as giggre_app's
// ViewedGigsStore (lib/core/services/viewed_gigs_store.dart).
//
// Kept on this device only, per account: it's a reading aid nobody else
// needs, so it costs no Firestore reads or writes. Another browser or the
// phone app keeps its own list. Capped so it never grows without bound;
// gigs that old have long expired or been filled.
const MAX_IDS = 1000;

function storageKey(uid: string) {
  return `giggre:viewed-gigs:${uid}`;
}

function loadViewed(uid: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(uid));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function saveViewed(uid: string, ids: string[]) {
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(ids));
  } catch {
    // Private browsing / storage disabled — viewed state just won't persist.
  }
}

export function useViewedGigs(uid: string | undefined) {
  // Most recent last, so trimming keeps the newest.
  const [order, setOrder] = useState<string[]>([]);

  useEffect(() => {
    // Reload when the account changes (localStorage isn't available during SSR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrder(uid ? loadViewed(uid) : []);
  }, [uid]);

  const viewed = useMemo(() => new Set(order), [order]);

  const markViewed = useCallback(
    (gigId: string) => {
      if (!uid || !gigId) return;
      setOrder((prev) => {
        if (prev.includes(gigId)) return prev;
        const next = [...prev, gigId].slice(-MAX_IDS);
        saveViewed(uid, next);
        return next;
      });
    },
    [uid]
  );

  return { viewed, markViewed };
}
