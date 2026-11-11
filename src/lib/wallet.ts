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
// Functions triggered by gig payments, or by the 3 request callables in
// firebase-functions.ts — this module itself only ever reads Firestore.
//
// The wallet's own currency (wallets/{uid}.currencyCode) is what every
// amount here is in — it can differ from the user's location currency (e.g.
// a PHP wallet while abroad). Limits in general_config/wallet_requests are
// set in USD and need fx-rates.ts to convert into it.

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
  | "transfer"
  | "send"
  | "receive"
  | "withdraw"
  | "earning"
  | "gig_payment"
  | "refund"
  | "fee"
  | "adjustment"
  | "points_conversion"
  | "promo";

export interface WalletTransaction {
  id: string;
  title: string;
  amount: number;
  type: WalletTxType;
  status: "completed" | "pending" | "failed" | "reversed";
  currencyCode: string;
  createdAt: Date | null;
  balanceAfter: number | null;
}

function toWalletTransaction(id: string, data: Record<string, unknown>): WalletTransaction {
  return {
    id,
    title: (data.title as string | undefined) ?? "Transaction",
    amount: (data.amount as number | undefined) ?? 0,
    type: (data.type as WalletTxType | undefined) ?? "adjustment",
    status: (data.status as WalletTransaction["status"] | undefined) ?? "completed",
    currencyCode: (data.currencyCode as string | undefined) ?? "PHP",
    createdAt: (data.createdAt as Timestamp | undefined)?.toDate() ?? null,
    balanceAfter: (data.balanceAfter as number | undefined) ?? null,
  };
}

export function isWalletTxIn(tx: Pick<WalletTransaction, "amount">): boolean {
  return tx.amount >= 0;
}

// A refund that only gives back a hold (Send/Withdraw rejected or
// cancelled). Not new money — nets to zero with the reversed hold — so it's
// left out of "money in" totals.
export function isWalletTxRefund(tx: Pick<WalletTransaction, "type">): boolean {
  return tx.type === "refund";
}

export function formatWalletMoney(value: number, currencyCode: string): string {
  return `${currencySymbolFor(currencyCode)} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function currencySymbolFor(code: string): string {
  if (code === "PHP") return "₱";
  if (code === "USD") return "$";
  return `${code} `;
}

export function formatWalletTxAmount(tx: WalletTransaction, fallbackCurrency: string, signed = true): string {
  const money = formatWalletMoney(Math.abs(tx.amount), tx.currencyCode || fallbackCurrency);
  return signed ? `${isWalletTxIn(tx) ? "+" : "−"} ${money}` : money;
}

// History without the separate refund line when its reversed hold is in the
// same list: a rejected/cancelled Send or Withdraw shows as ONE entry
// instead of a pair. Ids follow walletRequests.ts: hold wreq_{id} → refund
// wreq_{id}_refund.
export function collapseWalletRefunds(txs: WalletTransaction[]): WalletTransaction[] {
  const reversed = new Set(txs.filter((t) => t.status === "reversed").map((t) => t.id));
  function covered(t: WalletTransaction): boolean {
    if (!isWalletTxRefund(t) || !t.id.endsWith("_refund")) return false;
    const base = t.id.slice(0, -"_refund".length);
    return reversed.has(base) || reversed.has(`${base}_hold`);
  }
  return txs.filter((t) => !covered(t));
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
  methodKind: DepositKind | null;
  reference: string;
  proofUrl: string;
  recipientName: string;
  recipientCode: string;
  /** What the recipient gets, in their own wallet currency (Send only). */
  recipientAmount: number | null;
  recipientCurrency: string | null;
  /** Withdraw only: where it's paid out, and the admin's payout reference once approved. */
  payoutName: string;
  payoutNumber: string;
  payoutReference: string;
  /** Only ever set when status is "rejected" — the server's own gating on what's shown to the user. */
  decisionNote: string;
  createdAt: Date | null;
  decidedAt: Date | null;
}

const REQUEST_TYPE_LABEL: Record<WalletRequestType, string> = { deposit: "Top up", transfer: "Send", withdraw: "Withdrawal" };
export function walletRequestLabel(type: WalletRequestType): string {
  return REQUEST_TYPE_LABEL[type];
}

function parseDepositKind(v: unknown): DepositKind {
  return v === "office" || v === "remittance" ? v : "ewallet";
}

function toWalletRequest(id: string, data: Record<string, unknown>): WalletRequest {
  const toDate = (field: unknown) => (field as Timestamp | undefined)?.toDate() ?? null;
  const status = (data.status as WalletRequestStatus | undefined) ?? "pending";
  return {
    id,
    type: (data.type as WalletRequestType | undefined) ?? "deposit",
    status,
    amount: (data.amount as number | undefined) ?? 0,
    currencyCode: (data.currencyCode as string | undefined) ?? "USD",
    note: (data.note as string | undefined) ?? "",
    method: (data.method as string | undefined) ?? "",
    methodKind: data.methodKind == null ? null : parseDepositKind(data.methodKind),
    reference: (data.reference as string | undefined) ?? "",
    proofUrl: (data.proofUrl as string | undefined) ?? "",
    recipientName: (data.recipientName as string | undefined) ?? "",
    recipientCode: (data.recipientCode as string | undefined) ?? "",
    recipientAmount: (data.recipientAmount as number | undefined) ?? null,
    recipientCurrency: (data.recipientCurrency as string | undefined) ?? null,
    payoutName: (data.payoutName as string | undefined) ?? "",
    payoutNumber: (data.payoutNumber as string | undefined) ?? "",
    payoutReference: (data.payoutReference as string | undefined) ?? "",
    decisionNote: status === "rejected" ? ((data.decisionNote as string | undefined) ?? "") : "",
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
    query(collection(db, "wallet_requests"), where("userId", "==", uid), orderBy("createdAt", "desc"), fbLimit(30)),
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

// How a manual top up is paid / a withdrawal is paid out, set per method in
// giggre-admin → Gig Wallet → Settings.
//   ewallet    GCash / Maya / bank transfer: accountName + accountNumber
//   office     cash at a Giggre office: accountName = office, accountNumber
//              = address, details = hours. Proof = official receipt number.
//   remittance remittance center: accountName = receiver, accountNumber =
//              receiver mobile, details = address/accepted centers. Proof =
//              control number.
export type DepositKind = "ewallet" | "office" | "remittance";

export const DEPOSIT_KIND_REFERENCE_LABEL: Record<DepositKind, string> = {
  ewallet: "reference number",
  office: "official receipt (OR) number",
  remittance: "control / tracking number",
};

export interface DepositAccount {
  kind: DepositKind;
  method: string;
  accountName: string;
  accountNumber: string;
  details: string;
}

export interface WithdrawMethod {
  kind: DepositKind;
  method: string;
  details: string;
}

export interface WalletRequestConfig {
  enabled: boolean;
  deposit: AmountLimits;
  transfer: AmountLimits;
  withdraw: AmountLimits;
  depositAccounts: DepositAccount[];
  depositNote: string;
  withdrawMethods: WithdrawMethod[];
  withdrawNote: string;
}

const CLOSED_AMOUNT_LIMITS: AmountLimits = { enabled: false, min: null, max: null, dailyMax: null };
const CLOSED_CONFIG: WalletRequestConfig = {
  enabled: false,
  deposit: CLOSED_AMOUNT_LIMITS,
  transfer: CLOSED_AMOUNT_LIMITS,
  withdraw: CLOSED_AMOUNT_LIMITS,
  depositAccounts: [],
  depositNote: "",
  withdrawMethods: [],
  withdrawNote: "",
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
    const methods = Array.isArray(data.withdrawMethods) ? (data.withdrawMethods as Record<string, unknown>[]) : [];
    return {
      enabled: data.enabled !== false,
      deposit: toAmountLimits(data.deposit as Record<string, unknown> | undefined),
      transfer: toAmountLimits(data.transfer as Record<string, unknown> | undefined),
      withdraw: toAmountLimits(data.withdraw as Record<string, unknown> | undefined),
      depositAccounts: accounts.map((a) => ({
        kind: parseDepositKind(a.kind),
        method: (a.method as string | undefined) ?? "",
        accountName: (a.accountName as string | undefined) ?? "",
        accountNumber: (a.accountNumber as string | undefined) ?? "",
        details: (a.details as string | undefined) ?? "",
      })),
      depositNote: (data.depositNote as string | undefined) ?? "",
      withdrawMethods: methods
        .map((m) => ({ kind: parseDepositKind(m.kind), method: ((m.method as string | undefined) ?? "").trim(), details: (m.details as string | undefined) ?? "" }))
        .filter((m) => m.method),
      withdrawNote: (data.withdrawNote as string | undefined) ?? "",
    };
  } catch {
    return CLOSED_CONFIG;
  }
}

export function isWalletRequestTypeOpen(config: WalletRequestConfig, type: WalletRequestType): boolean {
  if (!config.enabled) return false;
  if (type === "deposit") return config.deposit.enabled;
  if (type === "transfer") return config.transfer.enabled;
  return config.withdraw.enabled && config.withdrawMethods.length > 0;
}

export function depositAccountsOf(config: WalletRequestConfig, kind: DepositKind, method?: string): DepositAccount[] {
  return config.depositAccounts.filter((a) => a.kind === kind && (!method || a.method.toLowerCase() === method.toLowerCase()));
}

export function withdrawMethodsOf(config: WalletRequestConfig, kind: DepositKind): WithdrawMethod[] {
  return config.withdrawMethods.filter((m) => m.kind === kind);
}

// Mirrors the admin's WALLET_TYPE_LABEL (giggre-admin's lib/wallet.ts) and
// the app's per-type titles for ledger entries without their own title.
export function walletTransactionTitle(tx: WalletTransaction): string {
  if (tx.title) return tx.title;
  switch (tx.type) {
    case "top_up":
      return "Top Up";
    case "transfer":
      return "Transfer";
    case "send":
      return "Sent";
    case "receive":
      return "Received";
    case "withdraw":
      return "Withdrawal";
    case "earning":
      return "Gig Earning";
    case "gig_payment":
      return "Gig Payment";
    case "refund":
      return "Refund";
    case "fee":
      return "Fee";
    case "points_conversion":
      return "Gig Points";
    case "promo":
      return "Promo";
    default:
      return "Adjustment";
  }
}

export function walletTxTypeLabel(type: WalletTxType): string {
  switch (type) {
    case "top_up":
      return "Top Up";
    case "transfer":
      return "Transfer";
    case "send":
      return "Sent";
    case "receive":
      return "Received";
    case "withdraw":
      return "Withdrawal";
    case "earning":
      return "Gig Earning";
    case "gig_payment":
      return "Gig Payment";
    case "refund":
      return "Refund";
    case "fee":
      return "Fee";
    case "points_conversion":
      return "Gig Points";
    case "promo":
      return "Promo";
    default:
      return "Adjustment";
  }
}

export function walletTxStatusLabel(status: WalletTransaction["status"]): string {
  if (status === "reversed") return "Refunded";
  return status.charAt(0).toUpperCase() + status.slice(1);
}
