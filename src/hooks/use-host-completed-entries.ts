import { useEffect, useState } from "react";
import { fetchHostCompletedEntries, type CompletedEntry } from "@/lib/earnings";

export function useHostCompletedEntries(uid: string | undefined) {
  const [entries, setEntries] = useState<CompletedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const fetched = await fetchHostCompletedEntries(uid);
        if (!cancelled) setEntries(fetched);
      } catch (err) {
        console.error("Failed to load completed gigs:", err);
        if (!cancelled) setError("Couldn't load spend data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uid]);

  return { entries, loading, error };
}
