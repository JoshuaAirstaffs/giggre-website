import { useEffect, useState } from "react";
import { subscribeFavoriteWorkerIds } from "@/lib/host-gigs";

// Backs the "favorite this worker" heart shown on a completed gig — live so
// toggling it reflects immediately without a page reload.
export function useFavoriteWorkerIds(hostId: string | undefined) {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!hostId) return;
    const unsubscribe = subscribeFavoriteWorkerIds(
      hostId,
      (ids) => setFavoriteIds(ids),
      (err) => console.error("Failed to load favorite workers:", err)
    );
    return unsubscribe;
  }, [hostId]);

  return favoriteIds;
}
