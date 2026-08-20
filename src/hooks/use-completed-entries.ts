import { useEffect, useState } from "react";
import { fetchCompletedEntries, type CompletedEntry } from "@/lib/earnings";

export function useCompletedEntries(uid: string | undefined) {
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
        const fetched = await fetchCompletedEntries(uid);
        if (!cancelled) setEntries(fetched);
      } catch (err) {
        console.error("Failed to load completed gigs:", err);
        if (!cancelled) setError("Couldn't load earnings.");
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
