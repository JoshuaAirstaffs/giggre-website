import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
  limit as fbLimit,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PointsRequestType } from "@/lib/firebase-functions";

// Mirrors giggre_app's lib/features/gig_points/ — a worker-only reward-points
// program (distinct from the referral-level gamification in referrals.ts and
// from the unrelated skillsXP skill-endorsement field on the user doc). Every
// balance/ledger/request write happens server-side — in Cloud Functions
// triggered by the gig-payment lifecycle, or by the 3 request callables in
// firebase-functions.ts — this module itself only ever reads Firestore.

export interface GigPointsBalance {
  balance: number;
  pendingPoints: number;
  heldPoints: number;
  lifetimeEarned: number;
  gigsRewarded: number;
  lastAwardedAt: Date | null;
  fromCache: boolean;
}

const ZERO_BALANCE: GigPointsBalance = {
  balance: 0,
  pendingPoints: 0,
  heldPoints: 0,
  lifetimeEarned: 0,
  gigsRewarded: 0,
  lastAwardedAt: null,
  fromCache: false,
};

function toGigPointsBalance(data: Record<string, unknown> | undefined, fromCache: boolean): GigPointsBalance {
  if (!data) return { ...ZERO_BALANCE, fromCache };
  return {
    balance: (data.balance as number | undefined) ?? 0,
    pendingPoints: (data.pendingPoints as number | undefined) ?? 0,
    heldPoints: (data.heldPoints as number | undefined) ?? 0,
    lifetimeEarned: (data.lifetimeEarned as number | undefined) ?? 0,
    gigsRewarded: (data.gigsRewarded as number | undefined) ?? 0,
    lastAwardedAt: (data.lastAwardedAt as Timestamp | undefined)?.toDate() ?? null,
    fromCache,
  };
}

// A worker with no completed gigs has never had a gig_points/{uid} doc
// created for them at all — that's a zero balance, not an error.
export function subscribeGigPointsBalance(
  uid: string,
  onData: (balance: GigPointsBalance) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "gig_points", uid),
    { includeMetadataChanges: true },
    (snap) => onData(toGigPointsBalance(snap.data(), snap.metadata.fromCache)),
    onError
  );
}

// "convert_to_cash"/"convert_to_points" are the current (and only new)
// movement type — the app replaced Deposit/Withdraw/Transfer with a single
// Points ⇄ GigCash conversion. The 4 legacy types can still appear on old
// ledger entries from before that change and are kept here for display only;
// nothing creates them anymore.
export type GigPointsTxType =
  | "earn"
  | "adjustment"
  | "convert_to_cash"
  | "convert_to_points"
  | "deposit"
  | "withdraw"
  | "transfer_out"
  | "transfer_in";
export type GigPointsTxStatus = "pending" | "credited" | "voided";

const MOVEMENT_TX_TYPES = new Set<GigPointsTxType>([
  "convert_to_cash",
  "convert_to_points",
  "deposit",
  "withdraw",
  "transfer_out",
  "transfer_in",
]);

export interface GigPointsTransaction {
  id: string;
  type: GigPointsTxType;
  status: GigPointsTxStatus;
  points: number;
  gigTitle: string;
  gigType: string;
  source: "gig_completed" | "admin" | "user_request";
  counterpartyName: string;
  reference: string;
  note: string;
  requestId: string;
  createdAt: Date | null;
  approvedAt: Date | null;
  completedAt: Date | null;
  creditedAt: Date | null;
  voidedAt: Date | null;
  voidReason: string;
  description: string;
  reason: string;
  /** Conversion entries only: the GigCash side and the locked rate. */
  cash: number | null;
  currencyCode: string;
  rate: number | null;
}

function toGigPointsTransaction(id: string, data: Record<string, unknown>): GigPointsTransaction {
  const toDate = (field: unknown) => (field as Timestamp | undefined)?.toDate() ?? null;
  return {
    id,
    type: (data.type as GigPointsTxType | undefined) ?? "earn",
    status: (data.status as GigPointsTxStatus | undefined) ?? "pending",
    points: (data.points as number | undefined) ?? 0,
    gigTitle: (data.gigTitle as string | undefined) ?? "",
    gigType: (data.gigType as string | undefined) ?? "",
    source: (data.source as "gig_completed" | "admin" | "user_request" | undefined) ?? "gig_completed",
    counterpartyName: (data.counterpartyName as string | undefined) ?? "",
    reference: (data.reference as string | undefined) ?? "",
    note: (data.note as string | undefined) ?? "",
    requestId: (data.requestId as string | undefined) ?? "",
    createdAt: toDate(data.createdAt),
    approvedAt: toDate(data.approvedAt),
    completedAt: toDate(data.completedAt),
    creditedAt: toDate(data.creditedAt),
    voidedAt: toDate(data.voidedAt),
    voidReason: (data.voidReason as string | undefined) ?? "",
    description: (data.description as string | undefined) ?? "",
    reason: (data.reason as string | undefined) ?? "",
    cash: (data.cash as number | undefined) ?? null,
    currencyCode: (data.currencyCode as string | undefined) ?? "PHP",
    rate: (data.rate as number | undefined) ?? null,
  };
}

export function isMovementTx(tx: Pick<GigPointsTransaction, "type">): boolean {
  return MOVEMENT_TX_TYPES.has(tx.type);
}

export function isConversionTx(tx: Pick<GigPointsTransaction, "type">): boolean {
  return tx.type === "convert_to_cash" || tx.type === "convert_to_points";
}

// Mirrors the app's exact per-type titles (gig_points_models.dart's `title`).
export function transactionTitle(tx: GigPointsTransaction): string {
  switch (tx.type) {
    case "convert_to_cash":
      return "Converted to GigCash";
    case "convert_to_points":
      return "Converted from GigCash";
    case "deposit":
      return "Deposit";
    case "withdraw":
      return "Withdrawal";
    case "transfer_out":
      return tx.counterpartyName ? `Sent to ${tx.counterpartyName}` : "Transfer sent";
    case "transfer_in":
      return tx.counterpartyName ? `From ${tx.counterpartyName}` : "Transfer received";
    case "adjustment":
      return tx.points >= 0 ? "Bonus from Giggre" : "Points adjustment";
    default:
      return tx.gigTitle || "Completed gig";
  }
}

// Movements (conversions, and legacy deposit/withdraw/transfer) are worded as
// a request's progress, not a reward stage — mirrors statusLabel in
// gig_points_models.dart. Task rewards still use the reward-stage label.
export function movementStatusLabel(tx: Pick<GigPointsTransaction, "status" | "voidReason">): string {
  switch (tx.status) {
    case "credited":
      return "Completed";
    case "voided":
      return tx.voidReason === "cancelled" ? "Cancelled" : "Rejected";
    default:
      return "Pending review";
  }
}

// A "growing live query" (GigPointsHistoryController's own approach) rather
// than cursor pagination — the caller grows `limit` and re-subscribes on
// "Load more", so every visible row stays live (a pending entry flips to
// Credited in place, with no duplicate/gap risk cursor pagination could
// introduce when new entries arrive at the top).
export function subscribeGigPointsTransactions(
  uid: string,
  options: { limit: number; types?: GigPointsTxType[] },
  onData: (result: { transactions: GigPointsTransaction[]; hasMore: boolean }) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  const constraints = [orderBy("createdAt", "desc"), fbLimit(options.limit)];
  const base =
    options.types && options.types.length > 0
      ? query(collection(db, "gig_points", uid, "transactions"), where("type", "in", options.types), ...constraints)
      : query(collection(db, "gig_points", uid, "transactions"), ...constraints);
  return onSnapshot(
    base,
    { includeMetadataChanges: true },
    (snap) => {
      onData({
        transactions: snap.docs.map((d) => toGigPointsTransaction(d.id, d.data())),
        hasMore: snap.docs.length === options.limit,
      });
    },
    onError
  );
}

// For the current-gig-reward card — the deterministic doc id a ledger entry
// for this specific (gig, worker) pair would have, per gigPoints.ts.
export async function fetchGigPointsLedgerEntry(
  uid: string,
  gigCollection: string,
  gigId: string
): Promise<GigPointsTransaction | null> {
  const snap = await getDoc(doc(db, "gig_points", uid, "transactions", `${gigCollection}__${gigId}__${uid}`));
  return snap.exists() ? toGigPointsTransaction(snap.id, snap.data()) : null;
}

export type RewardStage = "notYetEarned" | "awaitingApproval" | "approvedProcessing" | "credited" | "notEligible";

export const REWARD_STAGE_INFO: Record<RewardStage, { label: string; explanation: string; countsTowardBalance: boolean }> = {
  notYetEarned: {
    label: "Not yet earned",
    explanation: "This gig hasn't been approved by the host yet.",
    countsTowardBalance: false,
  },
  awaitingApproval: {
    label: "Awaiting approval",
    explanation: "The gig is marked complete and waiting for the host to approve payment.",
    countsTowardBalance: false,
  },
  approvedProcessing: {
    label: "Approved · processing",
    explanation: "The host approved the reward — it's processing until payment is confirmed.",
    countsTowardBalance: false,
  },
  credited: {
    label: "Credited",
    explanation: "These points are in your available balance.",
    countsTowardBalance: true,
  },
  notEligible: {
    label: "Not eligible",
    explanation: "This gig didn't qualify for a reward (e.g. cancelled, or no reward configured).",
    countsTowardBalance: false,
  },
};

// A ledger row is only ever created once a host approves (see gigPoints.ts),
// so an existing transaction's "pending" status always means "approved,
// processing" — never the earlier "awaiting approval" state, which only
// applies before any ledger entry exists at all (see rewardStageForGigStatus).
export function rewardStageForTransaction(status: GigPointsTxStatus): RewardStage {
  if (status === "credited") return "credited";
  if (status === "voided") return "notEligible";
  return "approvedProcessing";
}

// For the current-gig-reward card, before a ledger entry exists for this gig.
export function rewardStageForGigStatus(gigStatus: string): RewardStage {
  if (gigStatus === "task_complete") return "awaitingApproval";
  if (gigStatus === "payment") return "approvedProcessing";
  return "notYetEarned";
}

export interface GigPointsConfig {
  enabled: boolean;
  pointsByGigType: { quick?: number; open?: number; offered?: number };
  maxPointsPerGig?: number;
}

// Mirrors the admin-set general_config/gig_points doc (giggre-admin's Gig
// Points → Earning rewards tab) — same try/catch-with-defaults shape as
// fetchConfig in quick-gig-matching.ts. `enabled` defaults true (the kill
// switch is opt-out, not opt-in).
export async function fetchGigPointsConfig(): Promise<GigPointsConfig> {
  try {
    const snap = await getDoc(doc(db, "general_config", "gig_points"));
    const data = snap.data() ?? {};
    const pointsByGigType = (data.pointsByGigType as Record<string, number> | undefined) ?? {};
    return {
      enabled: (data.enabled as boolean | undefined) ?? true,
      pointsByGigType: {
        quick: pointsByGigType.quick,
        open: pointsByGigType.open,
        offered: pointsByGigType.offered,
      },
      maxPointsPerGig: data.maxPointsPerGig as number | undefined,
    };
  } catch {
    return { enabled: true, pointsByGigType: {} };
  }
}

// Mirrors the app's formatGigPoints(): 950, 12.4K, 3.2M.
export function formatGigPoints(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

export type GigPointsRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

// Labels/nouns per conversion direction — mirrors PointsRequestType's
// label/title/noun getters in gig_points_request_models.dart.
export const POINTS_REQUEST_LABEL: Record<PointsRequestType, string> = { toCash: "To GigCash", toPoints: "To Points" };
export const POINTS_REQUEST_TITLE: Record<PointsRequestType, string> = {
  toCash: "Points → GigCash",
  toPoints: "GigCash → Points",
};
export const POINTS_REQUEST_NOUN: Record<PointsRequestType, string> = {
  toCash: "conversion to GigCash",
  toPoints: "conversion to Gig Points",
};

// Cashing out rounds DOWN, buying rounds UP, both to the centavo — mirrors
// cashFor() in functions/src/gigPointsRequests.ts exactly (the server decides
// the real amount; this is only for an instant client-side preview).
export function cashForPoints(type: PointsRequestType, points: number, rate: number): number {
  const exact = points / rate;
  return type === "toCash" ? Math.floor(exact * 100 + 1e-9) / 100 : Math.ceil(exact * 100 - 1e-9) / 100;
}

export interface GigPointsRequest {
  id: string;
  /** Null for an old deposit/withdraw/transfer request from before conversion replaced them. */
  type: PointsRequestType | null;
  status: GigPointsRequestStatus;
  points: number;
  cash: number;
  currencyCode: string;
  rate: number | null;
  note: string;
  /** Only ever set when status is "rejected" — the server's own gating on what's shown to the user. */
  decisionNote: string;
  byAdmin: boolean;
  createdAt: Date | null;
  decidedAt: Date | null;
}

function parsePointsRequestType(v: unknown): PointsRequestType | null {
  if (v === "to_cash") return "toCash";
  if (v === "to_points") return "toPoints";
  return null;
}

function toGigPointsRequest(id: string, data: Record<string, unknown>): GigPointsRequest {
  const toDate = (field: unknown) => (field as Timestamp | undefined)?.toDate() ?? null;
  const status = (data.status as GigPointsRequestStatus | undefined) ?? "pending";
  return {
    id,
    type: parsePointsRequestType(data.type),
    status,
    points: (data.points as number | undefined) ?? 0,
    cash: (data.cash as number | undefined) ?? 0,
    currencyCode: (data.currencyCode as string | undefined) ?? "PHP",
    rate: (data.rate as number | undefined) ?? null,
    note: (data.note as string | undefined) ?? "",
    decisionNote: status === "rejected" ? ((data.decisionNote as string | undefined) ?? "") : "",
    byAdmin: data.source === "admin",
    createdAt: toDate(data.createdAt),
    decidedAt: toDate(data.decidedAt),
  };
}

export function subscribeGigPointsRequests(
  uid: string,
  onData: (requests: GigPointsRequest[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "gig_points_requests"), where("userId", "==", uid), orderBy("createdAt", "desc"), fbLimit(20)),
    (snap) => onData(snap.docs.map((d) => toGigPointsRequest(d.id, d.data()))),
    onError
  );
}

export interface PointsTypeLimits {
  enabled: boolean;
  /** Points per 1 unit of wallet currency. A direction with no rate is closed. */
  rate: number | null;
  min: number | null;
  max: number | null;
  dailyMax: number | null;
}

export interface PointsRequestLimits {
  enabled: boolean;
  byType: Record<PointsRequestType, PointsTypeLimits>;
}

const CLOSED_TYPE_LIMITS: PointsTypeLimits = { enabled: false, rate: null, min: null, max: null, dailyMax: null };
const CLOSED_LIMITS: PointsRequestLimits = {
  enabled: false,
  byType: { toCash: CLOSED_TYPE_LIMITS, toPoints: CLOSED_TYPE_LIMITS },
};

const LIMIT_DOC_KEY: Record<PointsRequestType, string> = { toCash: "toCash", toPoints: "toPoints" };

// Mirrors parseConversionConfig() in functions/src/gigPointsRequests.ts — a
// missing doc, a disabled direction, or a missing rate means that direction
// is closed.
export async function fetchGigPointsRequestLimits(): Promise<PointsRequestLimits> {
  try {
    const snap = await getDoc(doc(db, "general_config", "gig_points_requests"));
    if (!snap.exists()) return CLOSED_LIMITS;
    const data = snap.data();
    const rates = (data.rates as Record<string, unknown> | undefined) ?? {};
    const byType = {} as Record<PointsRequestType, PointsTypeLimits>;
    for (const type of ["toCash", "toPoints"] as const) {
      const key = LIMIT_DOC_KEY[type];
      const raw = (data[key] as Record<string, unknown> | undefined) ?? {};
      const rate = (rates[key] as number | undefined) ?? null;
      byType[type] = {
        enabled: raw.enabled === true && rate != null,
        rate,
        min: (raw.min as number | undefined) ?? null,
        max: (raw.max as number | undefined) ?? null,
        dailyMax: (raw.dailyMax as number | undefined) ?? null,
      };
    }
    // Matches the server's own default: a doc that exists is open unless its
    // `enabled` field is explicitly false.
    return { enabled: data.enabled !== false, byType };
  } catch {
    return CLOSED_LIMITS;
  }
}

export function isRequestTypeOpen(limits: PointsRequestLimits, type: PointsRequestType): boolean {
  return limits.enabled && limits.byType[type].enabled;
}
