import { useEffect, useState } from "react";
import { subscribeNotifications, isRecent, type NotificationEntry } from "@/lib/notifications";

export function useNotifications(uid: string | undefined) {
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    // Resetting local state before (re)subscribing when uid changes, not
    // reacting to it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeNotifications(
      uid,
      (fetched) => {
        setNotifications(fetched);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load notifications:", err);
        setError("Couldn't load notifications.");
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [uid]);

  const recentCount = notifications.filter((n) => isRecent(n.createdAt)).length;

  return { notifications, recentCount, loading, error };
}
