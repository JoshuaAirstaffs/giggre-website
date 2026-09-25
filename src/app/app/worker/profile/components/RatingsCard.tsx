"use client";

import { Star } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { ratingAverage } from "@/lib/ratings";

// Mirrors giggre_app/lib/core/models/rating_summary.dart's RatingSummary —
// average/count/histogram all come straight from the `ratingWorker`
// aggregate the shared Cloud Function (functions/src/ratings.ts
// onRatingCreated) maintains on users/{uid}, already redux-hydrated via
// profile. No separate fetch needed: the per-star breakdown used to be
// rebuilt here by scanning all three gig collections for a `hostRating`
// field nothing writes anymore — the aggregate's own `histogram` is that
// exact breakdown, computed server-side.
const STAR_LEVELS = [5, 4, 3, 2, 1];

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
  const profile = useAppSelector((root) => root.user.profile);
  const ratingWorker = profile?.ratingWorker;
  const average = ratingAverage(ratingWorker);
  const count = ratingWorker?.count ?? 0;

  return (
    <div>
      <p className="text-sm font-medium text-muted">Rating overview</p>
      <div className="mt-2 flex items-center gap-4">
        <div className="flex shrink-0 flex-col items-start">
          {average === null ? (
            <p className="text-sm text-muted">No ratings yet</p>
          ) : (
            <>
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
            </>
          )}
        </div>

        {count > 0 && (
          <div className="flex-1 space-y-1.5">
            {STAR_LEVELS.map((star) => {
              const starCount = ratingWorker?.histogram?.[star] ?? 0;
              const fraction = count === 0 ? 0 : starCount / count;
              return (
                <div key={star} className="flex items-center gap-2 text-xs">
                  <span className="w-4 shrink-0 text-right text-muted">{star}</span>
                  <Star className="size-3 shrink-0 fill-worker text-worker" />
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-mist">
                    <div className="h-full rounded-full bg-worker" style={{ width: `${fraction * 100}%` }} />
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
