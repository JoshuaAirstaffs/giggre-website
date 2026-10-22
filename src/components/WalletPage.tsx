"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Copy,
  CreditCard,
  Gift,
  Info,
  MinusCircle,
  PlusCircle,
  QrCode,
  Receipt,
  Send as SendIcon,
  Smartphone,
  Store,
  Wallet as WalletIcon,
  type LucideIcon,
} from "lucide-react";
import TitlePage from "@/components/TitlePage";
import JoshDiv from "@/components/DivAnimation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAppSelector } from "@/store/hooks";
import { cn, currencySymbol } from "@/lib/utils";
import { storage } from "@/lib/firebase";
import {
  cancelWalletRequest,
  createWalletRequest,
  generateClientRequestId,
  lookupWalletRecipient,
  type WalletRecipient,
  type WalletRequestType,
} from "@/lib/firebase-functions";
import {
  fetchWalletRequestConfig,
  isWalletRequestTypeOpen,
  subscribeWalletBalance,
  subscribeWalletRequests,
  subscribeWalletTransactions,
  walletTransactionTitle,
  type AmountLimits,
  type WalletBalance,
  type WalletRequest,
  type WalletRequestConfig,
  type WalletTransaction,
  type WalletTxType,
} from "@/lib/wallet";

// Mirrors giggre_app's lib/features/wallet/wallet_screen.dart — a real-money
// "GigCash" balance, entirely separate from the gamified Gig Points program
// (GigPointsPage.tsx). Deposit ("Top up") and Send only ever create
// admin-reviewed requests via the 2 callables in firebase-functions.ts,
// approved/rejected from giggre-admin's Gig Wallet → Requests tab. Withdraw
// is intentionally not offered — the app itself shows a "coming soon"
// message for it, not a working flow.

function formatMoney(amount: number, currencyCode: string): string {
  const symbol = currencySymbol(currencyCode);
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dayLabel(date: Date | null): string {
  if (!date) return "Earlier";
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString("en-US", sameYear ? { weekday: "short", month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

const TX_ICON: Record<WalletTxType, { icon: LucideIcon; className: string }> = {
  top_up: { icon: PlusCircle, className: "bg-(--success-tint) text-(--success-text)" },
  withdraw: { icon: Banknote, className: "bg-amber-500/10 text-amber-700" },
  send: { icon: ArrowLeftRight, className: "bg-blue-500/10 text-blue-700" },
  receive: { icon: ArrowLeftRight, className: "bg-blue-500/10 text-blue-700" },
  gig_payment: { icon: Receipt, className: "bg-secondary text-secondary-foreground" },
  earning: { icon: Gift, className: "bg-(--success-tint) text-(--success-text)" },
  refund: { icon: MinusCircle, className: "bg-blue-500/10 text-blue-700" },
  fee: { icon: MinusCircle, className: "bg-destructive/10 text-destructive" },
  adjustment: { icon: Gift, className: "bg-secondary text-secondary-foreground" },
  points_conversion: { icon: ArrowLeftRight, className: "bg-blue-500/10 text-blue-700" },
};

function TransactionIcon({ tx }: { tx: WalletTransaction }) {
  const { icon: Icon, className } = TX_ICON[tx.type] ?? TX_ICON.adjustment;
  return (
    <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", className)}>
      <Icon className="size-4" />
    </div>
  );
}

const REQUEST_TYPE_LABEL: Record<WalletRequestType, string> = { deposit: "Top up", transfer: "Send" };
const REQUEST_TYPE_NOUN: Record<WalletRequestType, string> = { deposit: "top up", transfer: "send" };
const REQUEST_TYPE_ICON: Record<WalletRequestType, LucideIcon> = { deposit: ArrowDownToLine, transfer: SendIcon };

// ---------- Info dialog ----------

function InfoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>How Gig Wallet works</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-medium text-ink">GigCash balance</p>
            <p className="text-muted">Real money you&apos;ve topped up, earned, or received — spendable on gig payments.</p>
          </div>
          <div>
            <p className="font-medium text-ink">Top up</p>
            <p className="text-muted">
              Pay into one of Giggre&apos;s accounts outside the app, then submit the reference and a screenshot for review.
            </p>
          </div>
          <div>
            <p className="font-medium text-ink">Send</p>
            <p className="text-muted">Send GigCash to another Giggre user by their ID or phone number.</p>
          </div>
          <div>
            <p className="font-medium text-ink">Requests</p>
            <p className="text-muted">
              A Giggre admin reviews every top up and send before it goes through. You are notified of the result, and a
              rejected send returns the held amount to your balance.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Top up dialog (3-step cash-in flow, mirrors the app's
// CashInMethodsScreen → GcashCashInScreen → TopUpPaymentScreen) ----------

interface CashInMethod {
  name: string;
  section: string;
  description: string;
  icon: LucideIcon;
  enabled: boolean;
}

// Only GCash opens a real flow — the rest mirror the app's own "coming soon"
// placeholders (cash_in_methods_screen.dart). None of these use real
// payment-brand logos/colors in the app either, just generic icons.
const CASH_IN_SECTIONS = ["E-wallets", "QR & Cards", "Pay with cash"] as const;
const CASH_IN_METHODS: CashInMethod[] = [
  { name: "GCash", section: "E-wallets", description: "Cash in instantly from your GCash account", icon: Smartphone, enabled: true },
  { name: "Maya", section: "E-wallets", description: "Cash in from your Maya account", icon: WalletIcon, enabled: false },
  { name: "QR Ph", section: "QR & Cards", description: "Scan with any bank or e-wallet app", icon: QrCode, enabled: false },
  { name: "Credit / Debit Card", section: "QR & Cards", description: "Visa or Mastercard", icon: CreditCard, enabled: false },
  { name: "Over-the-Counter", section: "Pay with cash", description: "7-Eleven, Cebuana, Palawan and more", icon: Store, enabled: false },
];
const CASH_IN_DEFAULT_MIN = 100;
const CASH_IN_DEFAULT_MAX = 10_000;
const QUICK_AMOUNTS = [100, 500, 1000, 5000];

type CashInStep = "method" | "amount" | "pay" | "success";

function TopUpDialog({
  uid,
  config,
  onClose,
}: {
  uid: string;
  config: WalletRequestConfig;
  onClose: () => void;
}) {
  const limits = config.deposit;
  const effectiveMin = limits.min ?? CASH_IN_DEFAULT_MIN;
  const effectiveMax = limits.max ?? CASH_IN_DEFAULT_MAX;

  const [step, setStep] = useState<CashInStep>("method");
  const [method, setMethod] = useState("GCash");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedAmount, setSubmittedAmount] = useState(0);

  // Matches by method case-insensitively, falling back to showing every
  // configured account if none match this method yet (TopUpPaymentScreen's
  // _accounts getter).
  const matchingAccounts = useMemo(() => {
    const all = config.depositAccounts;
    const same = all.filter((a) => a.method.toLowerCase() === method.toLowerCase());
    return same.length > 0 ? same : all;
  }, [config, method]);

  function selectMethod(m: CashInMethod) {
    if (!m.enabled) {
      toast(`${m.name} is coming soon.`);
      return;
    }
    setMethod(m.name);
    setStep("amount");
  }

  function handleContinue() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter an amount.");
      return;
    }
    if (value < effectiveMin) {
      toast.error(`Minimum cash-in is ${formatMoney(effectiveMin, "PHP")}.`);
      return;
    }
    if (value > effectiveMax) {
      toast.error(`Maximum cash-in is ${formatMoney(effectiveMax, "PHP")}.`);
      return;
    }
    setStep("pay");
  }

  async function copyAccountNumber(accountNumber: string) {
    try {
      await navigator.clipboard.writeText(accountNumber);
      toast.success("Account number copied");
    } catch {
      toast.error("Couldn't copy — copy it manually.");
    }
  }

  async function handleSubmit() {
    if (reference.trim().length < 4) {
      toast.error("Enter the payment reference number.");
      return;
    }
    if (matchingAccounts.length === 0) {
      toast.error("No payment accounts are set up yet. Please try again later.");
      return;
    }
    const value = Number(amount);
    setSubmitting(true);
    try {
      const clientRequestId = generateClientRequestId();
      let proofUrl: string | undefined;
      if (proofFile) {
        const storageRef = ref(storage, `wallet_proofs/${uid}/${clientRequestId}.jpg`);
        await uploadBytes(storageRef, proofFile);
        proofUrl = await getDownloadURL(storageRef);
      }
      await createWalletRequest({
        type: "deposit",
        amount: value,
        clientRequestId,
        method,
        reference: reference.trim(),
        proofUrl,
        note: note.trim() || undefined,
      });
      setSubmittedAmount(value);
      setStep("success");
    } catch (err) {
      console.error("Failed to submit top up request:", err);
      const message = (err as { message?: string })?.message || "Couldn't submit your top up request.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleBack() {
    if (step === "amount") setStep("method");
    else if (step === "pay") setStep("amount");
  }

  return (
    <Dialog open onOpenChange={(open) => !open && step !== "success" && onClose()}>
      <DialogContent>
        {(step === "amount" || step === "pay") && (
          <button
            type="button"
            onClick={handleBack}
            className="-mt-1 -ml-1 flex w-fit items-center gap-0.5 rounded-md px-1 py-0.5 text-xs font-medium text-muted hover:text-ink"
          >
            <ChevronLeft className="size-3.5" /> Back
          </button>
        )}

        {step === "method" && (
          <>
            <DialogHeader>
              <DialogTitle>Cash-in Methods</DialogTitle>
              <DialogDescription>Choose how you want to add money to your Gig Wallet.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {CASH_IN_SECTIONS.map((section) => (
                <div key={section}>
                  <p className="mb-1.5 text-xs font-medium tracking-wide text-muted uppercase">{section}</p>
                  <div className="space-y-1.5">
                    {CASH_IN_METHODS.filter((m) => m.section === section).map((m) => (
                      <button
                        key={m.name}
                        type="button"
                        onClick={() => selectMethod(m)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border border-hairline p-3 text-left transition-colors hover:bg-accent",
                          !m.enabled && "opacity-60"
                        )}
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-(--worker-tint) text-(--worker-text)">
                          <m.icon className="size-4.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-ink">{m.name}</span>
                          <span className="block truncate text-xs text-muted">{m.description}</span>
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-muted" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {step === "amount" && (
          <>
            <DialogHeader>
              <DialogTitle>Cash in via {method}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="cash-in-amount">Amount</Label>
                <div className="relative mt-1.5">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">
                    {currencySymbol("PHP")}
                  </span>
                  <Input
                    id="cash-in-amount"
                    type="number"
                    min={effectiveMin}
                    max={effectiveMax}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="pl-7"
                  />
                </div>
                <p className="mt-1 text-xs text-muted">
                  Min {formatMoney(effectiveMin, "PHP")} · Max {formatMoney(effectiveMax, "PHP")}
                </p>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium tracking-wide text-muted uppercase">Quick amounts</p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_AMOUNTS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setAmount(String(n))}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        amount === String(n) ? "border-worker bg-worker text-white" : "border-hairline text-muted hover:bg-accent"
                      )}
                    >
                      {currencySymbol("PHP")}
                      {n.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
              <p className="rounded-lg border border-hairline bg-secondary px-3 py-2 text-xs text-muted">
                Next, you&apos;ll see Giggre&apos;s {method} account. Send the amount from your {method} app, then enter the
                reference number. Your Gig Wallet is updated once Giggre confirms the payment.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={handleContinue}>
                {amount ? `Continue · ${formatMoney(Number(amount) || 0, "PHP")}` : "Continue"}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "pay" && (
          <>
            <DialogHeader>
              <DialogTitle>Pay {formatMoney(Number(amount) || 0, "PHP")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="rounded-xl border border-hairline p-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-worker text-[11px] font-bold text-white">
                    1
                  </span>
                  <p className="text-sm font-medium text-ink">Send exactly {formatMoney(Number(amount) || 0, "PHP")}</p>
                </div>
                <p className="mt-1 ml-7 text-xs text-muted">Use your {method} app to pay one of these Giggre accounts:</p>
                {matchingAccounts.length === 0 ? (
                  <p className="mt-2 ml-7 text-xs text-destructive">No payment accounts are set up yet. Please try again later.</p>
                ) : (
                  <div className="mt-2 ml-7 space-y-2">
                    {matchingAccounts.map((a, i) => (
                      <div
                        key={`${a.accountNumber}-${i}`}
                        className="flex items-center justify-between gap-2 rounded-lg bg-secondary px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs text-muted">
                            {a.method} · {a.accountName}
                          </p>
                          <p className="truncate text-sm font-semibold text-ink">{a.accountNumber}</p>
                        </div>
                        <Button type="button" size="icon-sm" variant="ghost" onClick={() => copyAccountNumber(a.accountNumber)}>
                          <Copy className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {config.depositNote && <p className="mt-2 ml-7 text-xs text-muted">{config.depositNote}</p>}
              </div>

              <div className="rounded-xl border border-hairline p-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-worker text-[11px] font-bold text-white">
                    2
                  </span>
                  <p className="text-sm font-medium text-ink">Enter the reference number</p>
                </div>
                <div className="mt-2 ml-7 space-y-2">
                  <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. 1234 567 890123" />
                  <p className="text-xs text-muted">Find it on the receipt in your {method} app.</p>
                  <div>
                    <Label htmlFor="cash-in-proof">Screenshot of the receipt (optional)</Label>
                    {proofFile ? (
                      <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg border border-hairline px-3 py-2">
                        <span className="truncate text-xs text-ink">{proofFile.name}</span>
                        <Button type="button" size="xs" variant="outline" onClick={() => setProofFile(null)}>
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <Input
                        id="cash-in-proof"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                        className="mt-1.5"
                      />
                    )}
                  </div>
                  <div>
                    <Label htmlFor="cash-in-note">Note (optional)</Label>
                    <Textarea id="cash-in-note" value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5" rows={2} />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSubmit} disabled={submitting || reference.trim().length < 4 || matchingAccounts.length === 0}>
                {submitting ? "Submitting…" : "I've paid — submit for review"}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "success" && (
          <>
            <DialogHeader>
              <DialogTitle>Top up submitted</DialogTitle>
              <DialogDescription>
                Giggre will check your payment of {formatMoney(submittedAmount, "PHP")} and add it to your Gig Wallet.
                We&apos;ll notify you once it&apos;s done.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={onClose}>OK</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------- Send dialog ----------

function SendDialog({ limits, onClose }: { limits: AmountLimits; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipient, setRecipient] = useState<WalletRecipient | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleLookup() {
    if (!recipientQuery.trim()) return;
    setLookingUp(true);
    setRecipient(null);
    try {
      const result = await lookupWalletRecipient(recipientQuery.trim());
      setRecipient(result);
    } catch (err) {
      console.error("Failed to look up recipient:", err);
      toast.error("Couldn't find that Giggre ID or phone number.");
    } finally {
      setLookingUp(false);
    }
  }

  async function handleSubmit() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    if (limits.min != null && value < limits.min) {
      toast.error(`Minimum send is ${formatMoney(limits.min, "PHP")}.`);
      return;
    }
    if (limits.max != null && value > limits.max) {
      toast.error(`Maximum is ${formatMoney(limits.max, "PHP")} per request.`);
      return;
    }
    if (!recipient) {
      toast.error("Look up a recipient first.");
      return;
    }
    setSubmitting(true);
    try {
      await createWalletRequest({
        type: "transfer",
        amount: value,
        clientRequestId: generateClientRequestId(),
        recipientId: recipient.recipientId,
        note: note.trim() || undefined,
      });
      toast.success("Send request submitted — a Giggre admin will review it.");
      onClose();
    } catch (err) {
      console.error("Failed to submit send request:", err);
      const message = (err as { message?: string })?.message || "Couldn't submit your send request.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send GigCash</DialogTitle>
          <DialogDescription>Send GigCash to another Giggre user by their ID or phone number.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="wallet-recipient">Recipient (Giggre ID or phone)</Label>
            <div className="mt-1.5 flex gap-2">
              <Input
                id="wallet-recipient"
                value={recipientQuery}
                onChange={(e) => {
                  setRecipientQuery(e.target.value);
                  setRecipient(null);
                }}
                placeholder="e.g. ABC123456"
              />
              <Button type="button" variant="outline" onClick={handleLookup} disabled={lookingUp || !recipientQuery.trim()}>
                {lookingUp ? "Looking up…" : "Look up"}
              </Button>
            </div>
            {recipient && (
              <p className="mt-1.5 text-xs text-(--success-text)">
                Found: {recipient.name} ({recipient.code})
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="wallet-send-amount">Amount</Label>
            <Input
              id="wallet-send-amount"
              type="number"
              min={limits.min ?? 1}
              max={limits.max ?? undefined}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 500"
              className="mt-1.5"
            />
            <p className="mt-1 text-xs text-muted">
              {limits.min != null || limits.max != null
                ? `Min ${limits.min != null ? formatMoney(limits.min, "PHP") : "—"} · Max ${limits.max != null ? formatMoney(limits.max, "PHP") : "—"}`
                : "No set limit"}
            </p>
          </div>
          <div>
            <Label htmlFor="wallet-send-note">Note (optional)</Label>
            <Textarea id="wallet-send-note" value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Main page ----------

const TX_PAGE_SIZE = 20;

export default function WalletPage() {
  const uid = useAppSelector((root) => root.user.authUser?.uid);

  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [config, setConfig] = useState<WalletRequestConfig | null>(null);
  const [requests, setRequests] = useState<WalletRequest[]>([]);
  const [showInfo, setShowInfo] = useState(false);
  const [dialog, setDialog] = useState<WalletRequestType | null>(null);
  const [blockedDialog, setBlockedDialog] = useState<string | null>(null);

  const [txLimit, setTxLimit] = useState(TX_PAGE_SIZE);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [txHasMore, setTxHasMore] = useState(false);
  const [txLoaded, setTxLoaded] = useState(false);
  const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null);

  const [cancelTarget, setCancelTarget] = useState<WalletRequest | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!uid) return;
    return subscribeWalletBalance(uid, setBalance, (err) => console.error("Failed to load Wallet balance:", err));
  }, [uid]);

  useEffect(() => {
    fetchWalletRequestConfig().then(setConfig).catch(() => {});
  }, []);

  useEffect(() => {
    if (!uid) return;
    return subscribeWalletRequests(uid, setRequests, (err) => console.error("Failed to load Wallet requests:", err));
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return subscribeWalletTransactions(
      uid,
      { limit: txLimit },
      (result) => {
        setTransactions(result.transactions);
        setTxHasMore(result.hasMore);
        setTxLoaded(true);
      },
      (err) => {
        console.error("Failed to load Wallet activity:", err);
        setTxLoaded(true);
      }
    );
  }, [uid, txLimit]);

  const pendingRequest = useMemo(() => requests.find((r) => r.status === "pending") ?? null, [requests]);

  const groupedTransactions = useMemo(() => {
    const groups: { label: string; items: WalletTransaction[] }[] = [];
    for (const tx of transactions) {
      const label = dayLabel(tx.createdAt);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(tx);
      else groups.push({ label, items: [tx] });
    }
    return groups;
  }, [transactions]);

  function handleActionClick(type: WalletRequestType) {
    if (pendingRequest) {
      setBlockedDialog(
        `Your ${REQUEST_TYPE_NOUN[pendingRequest.type]} of ${formatMoney(pendingRequest.amount, pendingRequest.currencyCode)} is waiting for a Giggre admin. You can make a new request once it is approved or rejected, or cancel it below.`
      );
      return;
    }
    if (!config || !isWalletRequestTypeOpen(config, type)) {
      toast.error(`${REQUEST_TYPE_LABEL[type]} requests aren't available right now.`);
      return;
    }
    if (type === "transfer" && (!balance || balance.balance <= 0)) {
      toast.error("You need available GigCash to send.");
      return;
    }
    setDialog(type);
  }

  async function handleCancelRequest() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancelWalletRequest(cancelTarget.id);
      toast.success("Request cancelled.");
      setCancelTarget(null);
    } catch (err) {
      console.error("Failed to cancel request:", err);
      toast.error("Couldn't cancel this request. Please try again.");
    } finally {
      setCancelling(false);
    }
  }

  if (!uid) return null;

  const currency = balance?.currencyCode ?? "PHP";

  return (
    <JoshDiv>
      <TitlePage title="Gig Wallet" description="Top up, send, and track your GigCash" />

      <div className="mx-auto mt-6 max-w-3xl space-y-5">
        <Card className="relative gap-3 overflow-hidden border-none bg-gradient-to-br from-emerald-400 to-emerald-600 p-6 text-white">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-12 -right-12 size-44 rounded-full border-[16px] border-white/10"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute top-8 -right-2 size-24 rounded-full border-[10px] border-white/10"
          />

          <div className="relative flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-emerald-600">
                <WalletIcon className="size-3.5" />
              </span>
              <p className="text-sm font-medium text-white/90">GigCash balance</p>
            </div>
            <button
              type="button"
              aria-label="How Gig Wallet works"
              onClick={() => setShowInfo(true)}
              className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/40 text-white/90 hover:bg-white/10"
            >
              <Info className="size-3.5" />
            </button>
          </div>

          <p className="relative text-4xl font-bold">{balance ? formatMoney(balance.balance, currency) : "—"}</p>

          <p className="relative min-h-4 text-xs text-white/80">
            {[
              pendingRequest && `${REQUEST_TYPE_LABEL[pendingRequest.type]} of ${formatMoney(pendingRequest.amount, pendingRequest.currencyCode)} in review`,
              balance?.fromCache && "Offline — showing last synced balance",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          <div className="relative mt-1 grid grid-cols-2 gap-2">
            {(["deposit", "transfer"] as const).map((type) => {
              const Icon = REQUEST_TYPE_ICON[type];
              const open = !!config && isWalletRequestTypeOpen(config, type) && !pendingRequest;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleActionClick(type)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-2xl bg-white/15 py-3 text-xs font-medium transition-colors hover:bg-white/20",
                    !open && "opacity-50"
                  )}
                >
                  <span className="flex size-9 items-center justify-center rounded-full bg-white/20">
                    <Icon className="size-4" />
                  </span>
                  {REQUEST_TYPE_LABEL[type]}
                </button>
              );
            })}
          </div>
        </Card>

        {config && !config.enabled && (
          <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50">
            Gig Wallet requests are paused right now. GigCash you already have is safe.
          </Card>
        )}

        {pendingRequest && (
          <Card className="flex-row items-center gap-3 p-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-700">
              {(() => {
                const Icon = REQUEST_TYPE_ICON[pendingRequest.type];
                return <Icon className="size-4" />;
              })()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">
                {REQUEST_TYPE_LABEL[pendingRequest.type]} of {formatMoney(pendingRequest.amount, pendingRequest.currencyCode)}
              </p>
              <p className="text-xs text-muted">
                {pendingRequest.type === "deposit"
                  ? "Giggre is confirming your payment."
                  : "On hold until Giggre reviews it."}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setCancelTarget(pendingRequest)}>
              Cancel
            </Button>
          </Card>
        )}

        <div>
          <p className="mb-2 text-sm font-medium text-ink">Activity</p>
          {!txLoaded ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <Card className="flex flex-col items-center gap-2 p-10 text-center">
              <WalletIcon className="size-8 text-muted" />
              <p className="text-sm font-medium text-ink">No activity yet</p>
              <p className="text-xs text-muted">Top up or receive GigCash to see it here.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {groupedTransactions.map((group) => (
                <div key={group.label}>
                  <p className="mb-1.5 text-xs font-medium tracking-wide text-muted uppercase">{group.label}</p>
                  <div className="space-y-2">
                    {group.items.map((tx) => (
                      <button key={tx.id} type="button" onClick={() => setSelectedTx(tx)} className="block w-full text-left">
                        <Card className="flex-row items-center gap-3 p-3">
                          <TransactionIcon tx={tx} />
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="truncate text-sm font-medium text-ink">{walletTransactionTitle(tx)}</p>
                            {tx.status === "pending" && (
                              <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400">Pending</Badge>
                            )}
                            {tx.status === "failed" && <Badge className="bg-destructive/10 text-destructive">Failed</Badge>}
                          </div>
                          <span
                            className={cn(
                              "shrink-0 text-sm font-semibold",
                              tx.amount < 0 ? "text-destructive" : "text-(--success-text)"
                            )}
                          >
                            {tx.amount >= 0 ? "+" : ""}
                            {formatMoney(tx.amount, tx.currencyCode)}
                          </span>
                        </Card>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {txHasMore && (
                <Button variant="outline" className="w-full" onClick={() => setTxLimit((n) => n + TX_PAGE_SIZE)}>
                  Load more
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <InfoDialog open={showInfo} onOpenChange={setShowInfo} />

      {dialog === "deposit" && config && <TopUpDialog uid={uid} config={config} onClose={() => setDialog(null)} />}
      {dialog === "transfer" && config && <SendDialog limits={config.transfer} onClose={() => setDialog(null)} />}

      <AlertDialog open={!!blockedDialog} onOpenChange={(open) => !open && setBlockedDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>You have a request in review</AlertDialogTitle>
            <AlertDialogDescription>{blockedDialog}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Got it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && !cancelling && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this {cancelTarget ? REQUEST_TYPE_NOUN[cancelTarget.type] : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget?.type === "deposit"
                ? "Giggre will no longer review this request."
                : `The ${cancelTarget ? formatMoney(cancelTarget.amount, cancelTarget.currencyCode) : ""} held amount goes back to your balance.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep it</AlertDialogCancel>
            <Button variant="destructive" onClick={handleCancelRequest} disabled={cancelling}>
              {cancelling ? "Cancelling…" : "Cancel request"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={selectedTx !== null} onOpenChange={(open) => !open && setSelectedTx(null)}>
        <DialogContent>
          {selectedTx && (
            <>
              <DialogHeader>
                <DialogTitle>{walletTransactionTitle(selectedTx)}</DialogTitle>
                <DialogDescription>Gig Wallet transaction details</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted">Amount</span>
                  <span className="font-semibold text-ink">
                    {selectedTx.amount >= 0 ? "+" : ""}
                    {formatMoney(selectedTx.amount, selectedTx.currencyCode)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted">Date</span>
                  <span className="text-ink">{formatDateTime(selectedTx.createdAt)}</span>
                </div>
                {selectedTx.balanceAfter != null && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted">Balance after</span>
                    <span className="text-ink">{formatMoney(selectedTx.balanceAfter, selectedTx.currencyCode)}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </JoshDiv>
  );
}
