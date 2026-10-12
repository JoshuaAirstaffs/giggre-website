import type { ExperienceLevel } from "@/lib/post-gig";

// A one-shot, in-memory (never persisted) handoff to the posting form —
// used by two callers: "Post Again" (seeds a fresh form from a specific
// past gig's own data) and "Use Template" (seeds it from a saved
// gig_templates doc, see gig-templates.ts). Despite the name, this module
// itself has nothing to do with *saving* a template — it never touches
// Firestore, and is gone the moment a page reload clears JS memory, or the
// moment the matching form consumes it, whichever comes first.
export interface PostAgainPrefill {
  gigType: "quick" | "open" | "offered";
  title: string;
  description: string;
  payType: "flat" | "hourly";
  // The one on-screen "amount" the host originally typed — budget for flat,
  // hourlyRate for hourly. Never both; whichever doesn't apply is omitted.
  amount: number;
  workDurationHours?: number;
  workerSlots: number;
  requiredSkill?: string; // open gigs
  skillRequired?: string; // offered gigs
  experienceLevel?: ExperienceLevel;
}

let pending: PostAgainPrefill | null = null;

export function setPostAgainPrefill(data: PostAgainPrefill): void {
  pending = data;
}

// Only clears (and returns) the pending prefill when it actually matches
// this gig type — the post page's three tab forms all mount at once, so
// whichever isn't the intended target must leave it untouched for the
// right one to pick up, regardless of mount order.
export function consumePostAgainPrefill(gigType: PostAgainPrefill["gigType"]): PostAgainPrefill | null {
  if (pending?.gigType !== gigType) return null;
  const data = pending;
  pending = null;
  return data;
}
