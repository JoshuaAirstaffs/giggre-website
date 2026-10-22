import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ReferralTreeMember } from "@/lib/firebase-functions";

// Mirrors giggre_app's referral_tree_screen.dart — linking everyone under
// their referrer (oldest first), the level naming, and the
// open-by-default-to-depth-2 rule. The tree and the earnings math are built
// entirely server-side (functions/src/referralTree.ts); this module only
// reshapes that result for rendering.

export interface TreeNode {
  uid: string;
  name: string;
  isVerified: boolean;
  joinedMs: number | null;
  depth: number;
  gigDone: boolean;
  children: TreeNode[];
}

export function countDescendants(node: TreeNode): number {
  return node.children.reduce((sum, c) => sum + 1 + countDescendants(c), 0);
}

export function buildReferralTree(members: ReferralTreeMember[]): { tree: TreeNode[]; levelCounts: number[] } {
  const nodes = new Map<string, TreeNode>();
  for (const m of members) {
    nodes.set(m.uid, {
      uid: m.uid,
      name: m.name,
      isVerified: m.isVerified,
      joinedMs: m.joinedMs,
      depth: m.depth,
      gigDone: m.gigDone,
      children: [],
    });
  }
  const tree: TreeNode[] = [];
  for (const m of members) {
    const node = nodes.get(m.uid)!;
    const parent = nodes.get(m.referrerId);
    (parent ? parent.children : tree).push(node);
  }
  const byJoined = (a: TreeNode, b: TreeNode) => (a.joinedMs ?? 0) - (b.joinedMs ?? 0);
  function sortAll(list: TreeNode[]) {
    list.sort(byJoined);
    for (const n of list) sortAll(n.children);
  }
  sortAll(tree);

  const counts: number[] = [];
  for (const m of members) {
    while (counts.length < m.depth) counts.push(0);
    counts[m.depth - 1]++;
  }
  return { tree, levelCounts: counts };
}

/** Branches open by default down to this level. */
export const AUTO_OPEN_DEPTH = 2;

export function levelName(i: number): string {
  return i === 0 ? "Invited directly" : `Level ${i + 1}`;
}

export function formatJoinDate(ms: number | null): string | null {
  if (ms == null) return null;
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Where the tree is offered, by country ──────────────────────────────────
// The app detects this via GPS; the website instead makes a best-effort
// guess from the dial code on the stored phone number — good enough to
// respect the admin's rollout-by-country switch without adding a geo-IP
// dependency. Only covers the dial codes in registration.ts's COUNTRIES list.
const DIAL_CODE_ISO: [string, string][] = [
  ["+63", "PH"],
  ["+852", "HK"],
  ["+886", "TW"],
  ["+673", "BN"],
  ["+966", "SA"],
  ["+971", "AE"],
  ["+974", "QA"],
  ["+880", "BD"],
  ["+1", "US"],
  ["+44", "GB"],
  ["+61", "AU"],
  ["+65", "SG"],
  ["+81", "JP"],
  ["+82", "KR"],
  ["+86", "CN"],
  ["+91", "IN"],
  ["+62", "ID"],
  ["+60", "MY"],
  ["+66", "TH"],
  ["+84", "VN"],
  ["+49", "DE"],
  ["+33", "FR"],
  ["+39", "IT"],
  ["+34", "ES"],
  ["+31", "NL"],
  ["+64", "NZ"],
  ["+52", "MX"],
  ["+55", "BR"],
  ["+27", "ZA"],
  ["+92", "PK"],
];

export function countryCodeFromPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const match = DIAL_CODE_ISO.find(([dialCode]) => phone.startsWith(dialCode));
  return match?.[1] ?? null;
}

export async function fetchReferralTreeCountries(): Promise<Set<string>> {
  try {
    const snap = await getDoc(doc(db, "referral_settings", "tree"));
    const countries = snap.data()?.countries;
    if (!Array.isArray(countries)) return new Set();
    return new Set(countries.filter((c): c is string => typeof c === "string").map((c) => c.toUpperCase()));
  } catch {
    return new Set();
  }
}
