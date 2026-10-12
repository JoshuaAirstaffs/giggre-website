import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Same shape as ActionResult in browse-gigs.ts — defined locally rather
// than imported from there, since several files that need to read the new
// rating aggregate fields (browse-gigs.ts, post-gig.ts) import from this
// module, and importing ActionResult back from browse-gigs.ts would create
// a circular dependency.
type ActionResult = { ok: true } | { ok: false; reason: string };

// Mirrors the app's post-refactor rating system exactly — same Firebase
// project, same Cloud Function (functions/src/ratings.ts, onRatingCreated)
// aggregating this collection into users/{rateeId}.ratingWorker/.ratingHost.
// The website used to write a pre-refactor design directly (flat
// ratingAsWorker/ratingCount fields on the user doc, hostRating/hostRatedAt
// on the gig doc) — nothing in the current app or its Cloud Functions reads
// or writes those anymore (see RatingSummary's own doc comment in
// lib/core/models/rating_summary.dart: "A user who has not been rated
// through the ratings collection has no rating, whatever those fields
// still say").

// Verbatim from rating_service.dart's workerTags — only the worker
// direction exists on the website today (host rates worker via
// CashPaymentDialog.tsx); hostTags would be added here too if a
// worker-rates-host flow is ever built on web.
export const WORKER_RATING_TAGS = ["On time", "Did the work well", "Good communication", "Would book again"];

export const RATING_COMMENT_MAX_LENGTH = 500;

// Shape of users/{uid}.ratingWorker / .ratingHost, maintained entirely by
// the Cloud Function — the website never writes this map directly.
export interface RatingAggregate {
  sum: number;
  count: number;
  // Average shrunk toward a Bayesian prior — for sorting/scoring only (see
  // quick-gig-matching.ts), never for display. Defined even at zero ratings.
  shrunk: number;
  histogram: Record<string, number>;
}

// Deliberately not defaulted to 5 — matches RatingSummary.average in the
// Flutter app exactly: an unrated user has no average, not a perfect one.
export function ratingAverage(agg: RatingAggregate | undefined): number | null {
  return agg && agg.count > 0 ? agg.sum / agg.count : null;
}

export type RateeRole = "worker" | "host";

export interface SubmitRatingInput {
  raterId: string;
  raterName: string;
  rateeId: string;
  rateeName: string;
  rateeRole: RateeRole;
  gigId: string;
  gigCollection: string;
  gigTitle: string;
  // Only present for a multi-slot gig — matches the app's schema, though
  // (per firestore.rules' isRatingCounterparty) it isn't itself
  // security-relevant, just a denormalized convenience field.
  slotWorkerId?: string;
  stars: number;
  tags: string[];
  comment?: string;
}

// Deterministic doc id blocks a second rating for the same gig/rater/ratee
// pair at the Firestore-rules level (create-only, same id every time) —
// mirrors RatingService.submit in rating_service.dart exactly, including
// which fields are omitted (not written as "") versus present.
export async function submitRating(input: SubmitRatingInput): Promise<ActionResult> {
  const ratingId = `${input.gigCollection}__${input.gigId}__${input.raterId}__${input.rateeId}`;
  const trimmedComment = input.comment?.trim();

  try {
    await setDoc(doc(db, "ratings", ratingId), {
      raterId: input.raterId,
      raterName: input.raterName,
      rateeId: input.rateeId,
      rateeName: input.rateeName,
      rateeRole: input.rateeRole,
      gigId: input.gigId,
      gigCollection: input.gigCollection,
      gigTitle: input.gigTitle,
      ...(input.slotWorkerId ? { slotWorkerId: input.slotWorkerId } : {}),
      stars: input.stars,
      tags: input.tags,
      ...(trimmedComment ? { comment: trimmedComment } : {}),
      createdAt: serverTimestamp(),
      revealedAt: null,
      aggregated: false,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Couldn't submit this rating." };
  }
}
