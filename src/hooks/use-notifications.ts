import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { subscribeNotifications, type NotificationEntry } from "@/lib/notifications";

// Firestore's `notifications` docs have no read/unread field, and the
// security rules only let an admin update or delete one (see
// giggre_app/firestore.rules) — a real client-writable read flag isn't
// available, so "read" is tracked client-side instead, per uid, in
// localStorage.
function readStorageKey(uid: string) {
  return `giggre:read-notifications:${uid}`;
}

function loadReadIds(uid: string): Set<string> {
  try {
    const raw = localStorage.getItem(readStorageKey(uid));
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveReadIds(uid: string, ids: Set<string>) {
  try {
    localStorage.setItem(readStorageKey(uid), JSON.stringify(Array.from(ids)));
  } catch {
    // Private browsing / storage disabled — read state just won't persist.
  }
}

export function useNotifications(uid: string | undefined, displayLimit?: number) {
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  // Tracks ids already seen so a live push (onSnapshot fires again on any
  // change) can tell "brand-new notification" apart from "same list re-sent".
  // Stays null until the first snapshot lands, so the initial page-load
  // batch never triggers a toast — only notifications that arrive afterward.
  const seenIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!uid) return;
    // Resetting local state before (re)subscribing when uid changes, not
    // reacting to it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    seenIdsRef.current = null;
    setReadIds(loadReadIds(uid));

    const unsubscribe = subscribeNotifications(
      uid,
      (fetched) => {
        const previouslySeen = seenIdsRef.current;
        if (previouslySeen) {
          for (const entry of fetched) {
            if (!previouslySeen.has(entry.id)) {
              toast(entry.title, {
                description: entry.body || undefined,
                position: "top-right",
                duration: 5000,
              });
            }
          }
        }
        seenIdsRef.current = new Set(fetched.map((entry) => entry.id));
        setNotifications(fetched);
        setLoading(false);
        // Prune ids that have aged out of the fetched window (the query is
        // capped at 20) so localStorage doesn't grow without bound.
        const fetchedIds = new Set(fetched.map((entry) => entry.id));
        setReadIds((prev) => {
          const pruned = new Set(Array.from(prev).filter((id) => fetchedIds.has(id)));
          if (pruned.size === prev.size) return prev;
          saveReadIds(uid, pruned);
          return pruned;
        });
      },
      (err) => {
        console.error("Failed to load notifications:", err);
        setError("Couldn't load notifications.");
        setLoading(false);
      },
      displayLimit
    );

    return unsubscribe;
  }, [uid, displayLimit]);

  function markAsRead(id: string) {
    if (!uid) return;
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      saveReadIds(uid, next);
      return next;
    });
  }

  function markAllAsRead() {
    if (!uid) return;
    const next = new Set(notifications.map((n) => n.id));
    saveReadIds(uid, next);
    setReadIds(next);
  }

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  return { notifications, readIds, markAsRead, markAllAsRead, unreadCount, loading, error };
}
