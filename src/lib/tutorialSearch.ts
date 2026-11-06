import type { TutorialVideo } from "@/lib/tutorialVideos";

// Flexible tutorial search — a port of giggre_app
// lib/features/tutorial_videos/tutorial_search.dart so the website and the
// app find the same videos. Keep the synonym list in sync with the app.
//
// A video matches when every part of the query is found in its title,
// keywords or description (English OR Tagalog), where a part may also match
// a synonym from the same topic ("signup" → "Register"), spacing/punctuation
// variants ("sign-up" = "signup"), the start of a word ("regis") or a small
// typo ("verfy"). Ranked: title > keywords > description.

export const TUTORIAL_SYNONYMS: string[][] = [
  ["register", "registration", "sign up", "signup", "create account", "new account", "open account",
    "join", "enroll", "mag register", "magregister", "magparehistro", "pagpaparehistro", "gumawa ng account"],
  ["log in", "login", "sign in", "signin", "logging in", "mag login", "pumasok", "password", "forgot password"],
  ["log out", "logout", "sign out", "signout"],
  ["verify", "verification", "verified", "valid id", "id", "kyc", "identity", "selfie",
    "beripikasyon", "pag verify", "mag verify"],
  ["wallet", "gig wallet", "gigcash", "gig cash", "balance", "pera"],
  ["top up", "topup", "cash in", "cashin", "deposit", "load", "add money", "mag load", "magdagdag ng pera"],
  ["withdraw", "withdrawal", "cash out", "cashout", "payout", "mag withdraw", "kunin ang pera"],
  ["send", "send money", "transfer", "padala", "magpadala"],
  ["points", "gig points", "reward", "rewards", "convert", "puntos"],
  ["post gig", "post a gig", "posting", "hire", "hiring", "gig host", "host", "find worker", "find a worker",
    "mag post", "maghanap ng worker"],
  ["apply", "application", "find work", "find gig", "find a gig", "accept gig", "accept", "gig worker", "worker",
    "job", "jobs", "work", "trabaho", "raket", "maghanap ng trabaho"],
  ["quick gig", "quick gigs", "instant", "quickgig"],
  ["open gig", "open gigs"],
  ["offered gig", "offer", "direct offer", "offered"],
  ["pay", "payment", "paying", "bayad", "magbayad", "gcash", "maya"],
  ["cancel", "cancellation", "refund", "kanselahin"],
  ["rating", "ratings", "review", "reviews", "rate", "stars", "feedback"],
  ["profile", "account settings", "settings", "edit profile"],
  ["chat", "message", "messages", "messaging", "mensahe"],
  ["notification", "notifications", "alert", "alerts"],
  ["location", "map", "gps", "lokasyon"],
  ["safety", "security", "privacy", "scam", "report", "ligtas"],
];

const FILLER = new Set(["how", "to", "the", "a", "an", "my", "ng", "sa", "paano", "mag", "i"]);

const norm = (s: string) =>
  s.toLowerCase().replace(/ñ/g, "n").replace(/é/g, "e").replace(/á/g, "a").replace(/[^a-z0-9]+/g, " ").trim();
const compact = (s: string) => norm(s).replace(/ /g, "");
const words = (s: string) => norm(s).split(" ").filter(Boolean);
const tolerance = (len: number) => (len >= 8 ? 2 : len >= 5 ? 1 : 0);

function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

const wordMatches = (t: string, w: string) => {
  if (w === t || (t.length >= 2 && w.startsWith(t))) return true;
  const tol = tolerance(t.length);
  return tol > 0 && distance(t, w, tol) <= tol;
};

class Field {
  readonly compact: string;
  readonly words: string[];
  readonly starts: number[];
  constructor(text: string, readonly weight: number) {
    this.compact = compact(text);
    this.words = words(text);
    let o = 0;
    this.starts = this.words.map((w) => {
      const s = o;
      o += w.length;
      return s;
    });
  }

  has(term: string): boolean {
    const tc = compact(term);
    if (!tc) return false;
    // "signup" in "Sign up now" — only from a word start ("load" ≠ "upload").
    if (tc.length >= 3 && this.starts.some((o) => this.compact.startsWith(tc, o))) return true;
    const tw = words(term);
    if (tw.length === 1) {
      const t = tw[0];
      const tol = tolerance(t.length);
      return this.words.some((w) =>
        w === t ||
        (t.length >= 2 && w.startsWith(t)) ||
        (tol > 0 && (distance(t, w, tol) <= tol || (w.length > t.length && distance(t, w.slice(0, t.length), tol) <= tol))));
    }
    return tw.every((t) => this.words.some((w) => wordMatches(t, w)));
  }
}

function expand(part: string): string[] {
  const pc = compact(part);
  const out = new Set([part]);
  if (pc.length < 2) return [...out];
  const tol = tolerance(pc.length);
  for (const group of TUTORIAL_SYNONYMS) {
    const hit = group.some((p) => {
      const c = compact(p);
      return c === pc || (tol > 0 && c.length >= 4 && distance(pc, c, tol) <= tol);
    });
    if (hit) group.forEach((p) => out.add(p));
  }
  return [...out];
}

function parts(query: string): string[] {
  const ws = words(query);
  const known = (phrase: string) => TUTORIAL_SYNONYMS.some((g) => g.some((p) => compact(p) === compact(phrase)));
  const out: string[] = [];
  let i = 0;
  while (i < ws.length) {
    let taken = 1;
    for (let n = 3; n >= 2; n--) {
      if (i + n <= ws.length && known(ws.slice(i, i + n).join(" "))) {
        taken = n;
        break;
      }
    }
    const part = ws.slice(i, i + taken).join(" ");
    if (!(taken === 1 && FILLER.has(part) && ws.length > 1)) out.push(part);
    i += taken;
  }
  return out;
}

/** Videos matching `query`, best first (all, in admin order, when empty). */
export function searchTutorialVideos(videos: TutorialVideo[], query: string): TutorialVideo[] {
  const ps = parts(query);
  if (ps.length === 0) return videos;
  const expanded = ps.map(expand);
  const scored: [TutorialVideo, number][] = [];
  for (const v of videos) {
    const fields = [
      new Field(v.title, 3),
      new Field(v.keywords.join(" , "), 2.5),
      new Field(v.description, 1),
      ...(v.tagalog ? [new Field(v.tagalog.title, 3), new Field(v.tagalog.description, 1)] : []),
    ];
    let score = 0;
    let all = true;
    for (let i = 0; i < ps.length; i++) {
      let best = 0;
      for (const f of fields) {
        if (f.weight <= best) continue;
        if (f.has(ps[i])) best = f.weight + 0.5;
        else if (expanded[i].some((x) => f.has(x))) best = f.weight;
      }
      if (best === 0) {
        all = false;
        break;
      }
      score += best;
    }
    if (all) scored.push([v, score]);
  }
  scored.sort((a, b) => b[1] - a[1] || a[0].order - b[0].order);
  return scored.map(([v]) => v);
}
