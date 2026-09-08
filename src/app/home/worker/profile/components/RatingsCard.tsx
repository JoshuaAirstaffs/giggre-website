"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAppSelector } from "@/store/hooks";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors giggre_app/lib/features/gig_worker/presentation/worker_ratings_screen.dart —
// individual ratings live on the gig docs (`hostRating`, set once a host rates
// the worker), not in a separate reviews collection. The average/count shown
// at the top come from the canonical `users/{uid}` fields instead of being
// recomputed here, matching the app's own comment on why it reads it that way.
const RATED_GIG_COLLECTIONS = ["quick_gigs", "open_gigs", "offered_gigs"];
const STAR_LEVELS = [5, 4, 3, 2, 1];

async function fetchWorkerRatings(uid: string): Promise<number[]> {
  const perCollection = await Promise.all(
    RATED_GIG_COLLECTIONS.map(async (name) => {
      const snap = await getDocs(query(collection(db, name), where("workerId", "==", uid)));
      return snap.docs
        .map((doc) => Math.trunc((doc.data().hostRating as number | undefined) ?? 0))
        .filter((r) => r > 0);
    })
  );
  return perCollection.flat();
}

function StarRow({ average, size = 18 }: { average: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => {
        const full = i < Math.floor(average);
        const half = !full && i < average && average - i >= 0.5;
        return (
          <div key={i} className="relative" style={{ width: size, height: size }}>
            <Star className="absolute inset-0 text-worker" style={{ width: size, height: size }} />
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: full ? "100%" : half ? "50%" : "0%" }}
            >
              <Star className="fill-worker text-worker" style={{ width: size, height: size }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function RatingsCard() {
  const uid = useAppSelector((root) => root.user.authUser?.uid);
  const profile = useAppSelector((root) => root.user.profile);
  const [ratings, setRatings] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const fetched = await fetchWorkerRatings(uid);
        if (!cancelled) setRatings(fetched);
      } catch (err) {
        console.error("Failed to load ratings:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uid]);

  const average = profile?.ratingAsWorker ?? 0;
  const count = profile?.ratingCount ?? 0;

  return (
    <div>
      <p className="text-sm font-medium text-muted">Rating overview</p>
      <div className="mt-2 flex items-center gap-4">
        <div className="flex shrink-0 flex-col items-start">
          <p className="text-ink">
            <span className="text-4xl font-bold">{average.toFixed(1)}</span>
            <span className="text-lg text-muted">/5</span>
          </p>
          <div className="mt-1">
            <StarRow average={average} />
          </div>
          <p className="mt-1 text-xs text-muted">
            {count.toLocaleString()} rating{count === 1 ? "" : "s"}
          </p>
        </div>

        {loading ? (
          <Skeleton className="h-20 flex-1" />
        ) : (
          <div className="flex-1 space-y-1.5">
            {STAR_LEVELS.map((star) => {
              const starCount = ratings.filter((r) => r === star).length;
              const fraction = ratings.length === 0 ? 0 : starCount / ratings.length;
              return (
                <div key={star} className="flex items-center gap-2 text-xs">
                  <span className="w-4 shrink-0 text-right text-muted">{star}</span>
                  <Star className="size-3 shrink-0 fill-worker text-worker" />
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-mist">
                    <div
                      className="h-full rounded-full bg-worker"
                      style={{ width: `${fraction * 100}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-muted">{starCount}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
