import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Client-side content gate mirroring giggre_app's ContentFilterService (lib/
// core/services/content_filter_service.dart) — same `app_content/word_filter`
// doc (fields: enabled, blockedTerms), so admin-managed blocked terms apply
// on the website too without a deploy. A server-side backstop already exists
// for this project (functions/src/wordFilter.ts's onOpenGigPosted/
// onChatMessageWordFilter triggers etc.) and covers website writes too since
// they land in the same collections — this just rejects before the round
// trip, instead of letting the bad content briefly land and get auto-scrubbed.

export const CONTENT_REJECTION_MESSAGE =
  "This content doesn't meet our community guidelines. Please revise and try again.";

let enabled = false;
let terms: string[] = [];
let firstSnapshot: Promise<void> | null = null;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Started lazily on first use and left running for the session (mirrors the
// mobile app's app-startup `initialize()` + live listener, so admin edits to
// the blocked-term list apply without a page reload). Resolves once the
// first snapshot arrives so the very first check() in a session isn't racing
// an empty, not-yet-loaded term list.
function ensureLoaded(): Promise<void> {
  if (firstSnapshot) return firstSnapshot;
  firstSnapshot = new Promise((resolve) => {
    let resolved = false;
    onSnapshot(
      doc(db, "app_content", "word_filter"),
      (snap) => {
        const data = snap.data();
        enabled = (data?.enabled as boolean | undefined) ?? false;
        terms = ((data?.blockedTerms as string[] | undefined) ?? [])
          .map((t) => t.toLowerCase().trim())
          .filter((t) => t.length > 0);
        if (!resolved) {
          resolved = true;
          resolve();
        }
      },
      () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }
    );
  });
  return firstSnapshot;
}

// True if any of `texts` contains a blocked term/phrase as a whole word —
// same `(?<![a-z0-9])term(?![a-z0-9])` boundary as the mobile app and the
// server backstop, so e.g. "asshole" never matches inside "assholetown" and
// a multi-word phrase like "sex for cash" matches as one literal unit.
export async function containsBlockedContent(...texts: (string | null | undefined)[]): Promise<boolean> {
  await ensureLoaded();
  if (!enabled || terms.length === 0) return false;
  for (const text of texts) {
    if (!text) continue;
    const normalized = text.toLowerCase();
    for (const term of terms) {
      const pattern = new RegExp(`(?<![a-z0-9])${escapeRegExp(term)}(?![a-z0-9])`);
      if (pattern.test(normalized)) return true;
    }
  }
  return false;
}
