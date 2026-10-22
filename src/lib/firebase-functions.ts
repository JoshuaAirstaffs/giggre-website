import { getFunctions, httpsCallable, type HttpsCallableResult } from "firebase/functions";
import { app, useDevProject } from "@/lib/firebase";

// Gig Points' Deposit/Withdraw/Transfer requests are the first feature on
// this site to call a Cloud Functions callable directly (everything else so
// far is either a plain Firestore read/write or routed through our own
// /api/auth/session route). Region mirrors giggre_app's own split — prod
// Functions live in us-central1, the dev/sandbox project's in asia-east2.
const functionsRegion = useDevProject ? "asia-east2" : "us-central1";
const functions = getFunctions(app, functionsRegion);

function callable<Req, Res>(name: string) {
  return (data: Req) => httpsCallable<Req, Res>(functions, name)(data) as Promise<HttpsCallableResult<Res>>;
}

// Gig Points no longer has its own Deposit/Withdraw/Transfer — the app
// replaced all three with a single Points ⇄ GigCash conversion (see
// functions/src/gigPointsRequests.ts in giggre_app). "toCash" cashes points
// out to the Gig Wallet; "toPoints" buys points with GigCash. There is no
// more P2P transfer within Gig Points — sending money to another person now
// only happens through Gig Wallet's own Send (firebase-functions.ts's wallet
// section below).
export type PointsRequestType = "toCash" | "toPoints";

const POINTS_REQUEST_WIRE: Record<PointsRequestType, "to_cash" | "to_points"> = {
  toCash: "to_cash",
  toPoints: "to_points",
};

export interface CreateGigPointsRequestInput {
  type: PointsRequestType;
  points: number;
  clientRequestId: string;
  note?: string;
}

export async function createGigPointsRequest(
  input: CreateGigPointsRequestInput
): Promise<{ requestId: string; status: string; cash: number }> {
  const result = await callable<
    { type: "to_cash" | "to_points"; points: number; clientRequestId: string; note?: string },
    { requestId: string; status: string; cash: number }
  >("createGigPointsRequest")({
    type: POINTS_REQUEST_WIRE[input.type],
    points: input.points,
    clientRequestId: input.clientRequestId,
    note: input.note,
  });
  return result.data;
}

export async function cancelGigPointsRequest(requestId: string): Promise<{ status: string }> {
  const result = await callable<{ requestId: string }, { status: string }>("cancelGigPointsRequest")({ requestId });
  return result.data;
}

// An 8–64 char [A-Za-z0-9_-] idempotency key the caller generates itself —
// safe to retry createGigPointsRequest with the same id if a request appears
// to fail client-side but actually landed (e.g. a dropped response).
export function generateClientRequestId(): string {
  return `web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---------- Gig Wallet (GigCash) ----------
// A separate real-money system from Gig Points above — same callable-wrapper
// pattern, same region split. See src/lib/wallet.ts for the Firestore reads.

export interface WalletRecipient {
  recipientId: string;
  name: string;
  code: string;
  photoUrl: string;
}

export async function lookupWalletRecipient(query: string): Promise<WalletRecipient> {
  const result = await callable<{ query: string }, WalletRecipient>("lookupWalletRecipient")({ query });
  return result.data;
}

export type WalletRequestType = "deposit" | "transfer";

export type CreateWalletRequestInput =
  | {
      type: "deposit";
      amount: number;
      clientRequestId: string;
      method: string;
      reference: string;
      proofUrl?: string;
      note?: string;
    }
  | {
      type: "transfer";
      amount: number;
      clientRequestId: string;
      recipientId: string;
      note?: string;
    };

export async function createWalletRequest(input: CreateWalletRequestInput): Promise<{ requestId: string; status: string }> {
  const result = await callable<CreateWalletRequestInput, { requestId: string; status: string }>("createWalletRequest")(
    input
  );
  return result.data;
}

export async function cancelWalletRequest(requestId: string): Promise<{ status: string }> {
  const result = await callable<{ requestId: string }, { status: string }>("cancelWalletRequest")({ requestId });
  return result.data;
}

// ---------- Referral tree ----------
// Mirrors giggre_app's referral_tree_screen.dart. A user can only read their
// own referrals_list in Firestore, so everything below the first level has
// to be gathered server-side — see functions/src/referralTree.ts.

export interface ReferralTreeMember {
  uid: string;
  referrerId: string;
  name: string;
  isVerified: boolean;
  joinedMs: number | null;
  depth: number;
  gigDone: boolean;
}

export interface ReferralTreeLevelEarning {
  label: string;
  rate: number;
  promoActive: boolean;
  promoUntilMs: number | null;
  people: number;
  qualified: number;
  earned: number;
  capped: boolean;
  maxEarn: number;
}

export interface ReferralTreeEarnings {
  levels: ReferralTreeLevelEarning[];
  total: number;
  totalCapped: boolean;
  totalMax: number;
  deeperPeople: number;
}

export interface ReferralTreeResult {
  root: { uid: string; name: string; referralCode: string | null; isVerified: boolean; gigDone: boolean };
  members: ReferralTreeMember[];
  truncated: boolean;
  earnings: ReferralTreeEarnings | null;
}

export async function getMyReferralTree(): Promise<ReferralTreeResult> {
  const result = await callable<undefined, ReferralTreeResult>("getMyReferralTree")(undefined);
  return result.data;
}
