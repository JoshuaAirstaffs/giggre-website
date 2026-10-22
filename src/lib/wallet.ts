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
import type { WalletRequestType } from "@/lib/firebase-functions";

// Mirrors giggre_app's lib/features/wallet/ — a real-money "GigCash" balance,
// entirely separate from the gamified Gig Points program in gig-points.ts.
// Every balance/ledger/request write happens server-side — in Cloud
// Functions triggered by gig payments, or by the 2 request callables in
// firebase-functions.ts — this module itself only ever reads Firestore.

export interface WalletBalance {
  balance: number;
  currencyCode: string;
  fromCache: boolean;
}

const ZERO_BALANCE: WalletBalance = { balance: 0, currencyCode: "PHP", fromCache: false };

function toWalletBalance(data: Record<string, unknown> | undefined, fromCache: boolean): WalletBalance {
  if (!data) return { ...ZERO_BALANCE, fromCache };
  return {
    balance: (data.balance as number | undefined) ?? 0,
    currencyCode: (data.currencyCode as string | undefined) ?? "PHP",
    fromCache,
  };
}

// A user with no wallet activity has never had a wallets/{uid} doc created —
// that's a zero balance, not an error (same pattern as gig_points/{uid}).
export function subscribeWalletBalance(
  uid: string,
  onData: (balance: WalletBalance) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "wallets", uid),
    { includeMetadataChanges: true },
    (snap) => onData(toWalletBalance(snap.data(), snap.metadata.fromCache)),
    onError
  );
}

export type WalletTxType =
  | "top_up"
  | "withdraw"
  | "send"
  | "receive"
  | "gig_payment"
  | "earning"
  | "refund"
  | "fee"
  | "adjustment"
  | "points_conversion";

export interface WalletTransaction {
  id: string;
  title: string;
  amount: number;
  type: WalletTxType;
  currencyCode: string;
  status: "completed" | "pending" | "failed";
  createdAt: Date | null;
  balanceAfter: number | null;
}

function toWalletTransaction(id: string, data: Record<string, unknown>): WalletTransaction {
  return {
    id,
    title: (data.title as string | undefined) ?? "",
    amount: (data.amount as number | undefined) ?? 0,
    type: (data.type as WalletTxType | undefined) ?? "adjustment",
    currencyCode: (data.currencyCode as string | undefined) ?? "PHP",
    status: (data.status as "completed" | "pending" | "failed" | undefined) ?? "completed",
    createdAt: (data.createdAt as Timestamp | undefined)?.toDate() ?? null,
    balanceAfter: (data.balanceAfter as number | undefined) ?? null,
  };
}

// Same "growing live query" approach as subscribeGigPointsTransactions —
// grow `limit` and re-subscribe on "Load more" so visible rows stay live.
export function subscribeWalletTransactions(
  uid: string,
  options: { limit: number },
  onData: (result: { transactions: WalletTransaction[]; hasMore: boolean }) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "wallets", uid, "transactions"), orderBy("createdAt", "desc"), fbLimit(options.limit)),
    { includeMetadataChanges: true },
    (snap) => {
      onData({
        transactions: snap.docs.map((d) => toWalletTransaction(d.id, d.data())),
        hasMore: snap.docs.length === options.limit,
      });
    },
    onError
  );
}

export type WalletRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface WalletRequest {
  id: string;
  type: WalletRequestType;
  status: WalletRequestStatus;
  amount: number;
  currencyCode: string;
  note: string;
  method: string;
  reference: string;
  proofUrl: string;
  recipientName: string;
  recipientCode: string;
  decisionNote: string;
  createdAt: Date | null;
  decidedAt: Date | null;
}

function toWalletRequest(id: string, data: Record<string, unknown>): WalletRequest {
  const toDate = (field: unknown) => (field as Timestamp | undefined)?.toDate() ?? null;
  return {
    id,
    type: (data.type as WalletRequestType | undefined) ?? "deposit",
    status: (data.status as WalletRequestStatus | undefined) ?? "pending",
    amount: (data.amount as number | undefined) ?? 0,
    currencyCode: (data.currencyCode as string | undefined) ?? "PHP",
    note: (data.note as string | undefined) ?? "",
    method: (data.method as string | undefined) ?? "",
    reference: (data.reference as string | undefined) ?? "",
    proofUrl: (data.proofUrl as string | undefined) ?? "",
    recipientName: (data.recipientName as string | undefined) ?? "",
    recipientCode: (data.recipientCode as string | undefined) ?? "",
    decisionNote: (data.decisionNote as string | undefined) ?? "",
    createdAt: toDate(data.createdAt),
    decidedAt: toDate(data.decidedAt),
  };
}

export function subscribeWalletRequests(
  uid: string,
  onData: (requests: WalletRequest[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "wallet_requests"), where("userId", "==", uid), orderBy("createdAt", "desc"), fbLimit(20)),
    (snap) => onData(snap.docs.map((d) => toWalletRequest(d.id, d.data()))),
    onError
  );
}

export interface AmountLimits {
  enabled: boolean;
  min: number | null;
  max: number | null;
  dailyMax: number | null;
}

export interface DepositAccount {
  method: string;
  accountName: string;
  accountNumber: string;
}

export interface WalletRequestConfig {
  enabled: boolean;
  deposit: AmountLimits;
  transfer: AmountLimits;
  depositAccounts: DepositAccount[];
  depositNote: string;
}

const CLOSED_AMOUNT_LIMITS: AmountLimits = { enabled: false, min: null, max: null, dailyMax: null };
const CLOSED_CONFIG: WalletRequestConfig = {
  enabled: false,
  deposit: CLOSED_AMOUNT_LIMITS,
  transfer: CLOSED_AMOUNT_LIMITS,
  depositAccounts: [],
  depositNote: "",
};

function toAmountLimits(data: Record<string, unknown> | undefined): AmountLimits {
  if (!data) return CLOSED_AMOUNT_LIMITS;
  return {
    enabled: (data.enabled as boolean | undefined) ?? false,
    min: (data.min as number | undefined) ?? null,
    max: (data.max as number | undefined) ?? null,
    dailyMax: (data.dailyMax as number | undefined) ?? null,
  };
}

// A missing doc, or any read error, means requests are closed — same rule as
// fetchGigPointsRequestLimits.
export async function fetchWalletRequestConfig(): Promise<WalletRequestConfig> {
  try {
    const snap = await getDoc(doc(db, "general_config", "wallet_requests"));
    if (!snap.exists()) return CLOSED_CONFIG;
    const data = snap.data();
    const accounts = Array.isArray(data.depositAccounts) ? (data.depositAccounts as Record<string, unknown>[]) : [];
    return {
      enabled: (data.enabled as boolean | undefined) ?? false,
      deposit: toAmountLimits(data.deposit as Record<string, unknown> | undefined),
      transfer: toAmountLimits(data.transfer as Record<string, unknown> | undefined),
      depositAccounts: accounts.map((a) => ({
        method: (a.method as string | undefined) ?? "",
        accountName: (a.accountName as string | undefined) ?? "",
        accountNumber: (a.accountNumber as string | undefined) ?? "",
      })),
      depositNote: (data.depositNote as string | undefined) ?? "",
    };
  } catch {
    return CLOSED_CONFIG;
  }
}

export function isWalletRequestTypeOpen(config: WalletRequestConfig, type: WalletRequestType): boolean {
  return config.enabled && config[type].enabled;
}

// Mirrors the admin's WALLET_TYPE_LABEL (giggre-admin's lib/wallet.ts) and
// the app's per-type titles for ledger entries without their own title.
export function walletTransactionTitle(tx: WalletTransaction): string {
  if (tx.title) return tx.title;
  switch (tx.type) {
    case "top_up":
      return "Top up";
    case "withdraw":
      return "Withdrawal";
    case "send":
      return "Sent";
    case "receive":
      return "Received";
    case "gig_payment":
      return "Gig payment";
    case "earning":
      return "Earning";
    case "refund":
      return "Refund";
    case "fee":
      return "Fee";
    case "points_conversion":
      return "Points conversion";
    default:
      return "Adjustment";
  }
}
