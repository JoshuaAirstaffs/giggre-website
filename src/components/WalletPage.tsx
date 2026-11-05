"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Briefcase,
  Building2,
  ChevronLeft,
  ChevronRight,
  Copy,
  CreditCard,
  Handshake,
  Info,
  Landmark,
  Percent,
  QrCode,
  RotateCcw,
  Shield,
  SlidersHorizontal,
  Smartphone,
  Star,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAppSelector } from "@/store/hooks";
import { cn } from "@/lib/utils";
import { storage } from "@/lib/firebase";
import {
  cancelWalletRequest,
  createWalletRequest,
  generateClientRequestId,
  lookupWalletRecipient,
  type WalletRecipient,
  type WalletRequestType,
} from "@/lib/firebase-functions";
import { convertDown, fetchFxRates, fromUsd, fxKnows, type FxRates } from "@/lib/fx-rates";
import {
  collapseWalletRefunds,
  depositAccountsOf,
  fetchWalletRequestConfig,
  formatWalletMoney,
  formatWalletTxAmount,
  isWalletRequestTypeOpen,
  isWalletTxIn,
  subscribeWalletBalance,
  subscribeWalletRequests,
  subscribeWalletTransactions,
  walletRequestLabel,
  walletTransactionTitle,
  walletTxStatusLabel,
  walletTxTypeLabel,
  withdrawMethodsOf,
  DEPOSIT_KIND_REFERENCE_LABEL,
  type DepositKind,
  type WalletBalance,
  type WalletRequest,
  type WalletRequestConfig,
  type WalletTransaction,
  type WalletTxType,
  type WithdrawMethod,
} from "@/lib/wallet";

// Mirrors giggre_app's lib/features/wallet/ (updated: wallet_screen.dart +
// cash_in_methods_screen/gcash_cash_in_screen/top_up_payment_screen +
// choose_recipient_screen/send_amount_screen + withdraw_methods/amount/
// details_screen) — laid out like Gig Points: balance card (Top Up /
// Withdraw / Send) → stats strip → security banner → pinned tabs:
// Activity | Requests | How it works. Every balance/ledger/request mutation
// happens server-side; this page only reads wallets/{uid} (+transactions)
// and wallet_requests, and calls the 3 request callables in
// firebase-functions.ts. Contacts-based recipient picking isn't wired up in
// the app either (shows "coming soon"), so Send here is phone-number only.

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
  top_up: { icon: CreditCard, className: "bg-(--success-tint) text-(--success-text)" },
  transfer: { icon: ArrowLeftRight, className: "bg-blue-500/10 text-blue-700" },
  send: { icon: ArrowUpRight, className: "bg-destructive/10 text-destructive" },
  receive: { icon: ArrowDownLeft, className: "bg-(--success-tint) text-(--success-text)" },
  withdraw: { icon: Landmark, className: "bg-amber-500/10 text-amber-700" },
  earning: { icon: Briefcase, className: "bg-(--success-tint) text-(--success-text)" },
  gig_payment: { icon: Handshake, className: "bg-secondary text-secondary-foreground" },
  refund: { icon: RotateCcw, className: "bg-blue-500/10 text-blue-700" },
  fee: { icon: Percent, className: "bg-destructive/10 text-destructive" },
  adjustment: { icon: SlidersHorizontal, className: "bg-secondary text-secondary-foreground" },
  points_conversion: { icon: Star, className: "bg-blue-500/10 text-blue-700" },
};

function TransactionIcon({ tx }: { tx: WalletTransaction }) {
  const { icon: Icon, className } = TX_ICON[tx.type] ?? TX_ICON.adjustment;
  return (
    <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", className)}>
      <Icon className="size-4" />
    </div>
  );
}

const REQUEST_TYPE_LABEL: Record<WalletRequestType, string> = { deposit: "Top Up", transfer: "Send", withdraw: "Withdraw" };
const REQUEST_TYPE_ICON: Record<WalletRequestType, LucideIcon> = { deposit: CreditCard, transfer: ArrowUpRight, withdraw: Landmark };

// Quick amounts in the wallet's own currency — mirrors _quickAmounts() in
// gcash_cash_in_screen.dart / withdraw_amount_screen.dart.
function quickAmounts(currencyCode: string, forWithdraw: boolean): number[] {
  if (currencyCode === "PHP") return forWithdraw ? [500, 1000, 2000, 5000] : [100, 500, 1000, 5000];
  return forWithdraw ? [10, 20, 50, 100] : [5, 10, 20, 50];
}

// ---------- Stats strip ----------
// Money in / out over the last 30 days and what's pending, from the loaded
// history (completed entries only for in/out) — matches WalletStatsStrip.

function StatsStrip({ transactions, currencyCode }: { transactions: WalletTransaction[] | null; currencyCode: string }) {
  const { moneyIn, moneyOut, pending } = useMemo(() => {
    const since = new Date().getTime() - 30 * 86_400_000;
    let moneyIn = 0;
    let moneyOut = 0;
    let pending = 0;
    for (const t of transactions ?? []) {
      if (t.status === "pending") {
        pending += Math.abs(t.amount);
        continue;
      }
      if (t.status !== "completed" || t.type === "refund") continue;
      if (t.createdAt && t.createdAt.getTime() < since) continue;
      if (t.amount >= 0) moneyIn += t.amount;
      else moneyOut += -t.amount;
    }
    return { moneyIn, moneyOut, pending };
  }, [transactions]);

  const f = (v: number) => (transactions == null ? "–" : formatWalletMoney(v, currencyCode));
  return (
    <Card className="flex-row items-center justify-around gap-0 border-hairline py-3.5">
      <StatCell value={f(moneyIn)} label="In · 30 days" className="text-(--success-text)" />
      <div className="h-8.5 w-px bg-hairline" />
      <StatCell value={f(moneyOut)} label="Out · 30 days" className="text-destructive" />
      <div className="h-8.5 w-px bg-hairline" />
      <StatCell value={f(pending)} label="Pending" className="text-amber-600 dark:text-amber-400" />
    </Card>
  );
}

function StatCell({ value, label, className }: { value: string; label: string; className: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center px-1 text-center">
      <p className={cn("truncate text-base font-bold", className)}>{value}</p>
      <p className="truncate text-[11px] text-muted">{label}</p>
    </div>
  );
}

function SecurityBanner({ role }: { role: "host" | "worker" }) {
  return (
    <Link
      href={`/app/${role}/wallet/security`}
      className="flex items-center gap-2.5 rounded-xl border border-(--worker-text)/25 bg-(--worker-tint) px-3.5 py-3 transition-colors hover:bg-(--worker-tint)/70"
    >
      <Shield className="size-4 shrink-0 text-(--worker-text)" />
      <p className="flex-1 text-xs font-semibold text-(--worker-text)">Your Gig Wallet is protected. Learn about Security and Privacy.</p>
      <ChevronRight className="size-4 shrink-0 text-(--worker-text)" />
    </Link>
  );
}

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
            <p className="font-medium text-ink">Available GigCash</p>
            <p className="text-muted">Money you can send or use. Amounts on hold for a pending Send are already taken out.</p>
          </div>
          <div>
            <p className="font-medium text-ink">Pending</p>
            <p className="text-muted">Top ups waiting for Giggre to confirm your payment, and sends waiting for review.</p>
          </div>
          <div>
            <p className="font-medium text-ink">Requests</p>
            <p className="text-muted">Every top up and send is reviewed by a Giggre admin before it goes through. You can have one waiting at a time.</p>
          </div>
          <div>
            <p className="font-medium text-ink">Gig Points</p>
            <p className="text-muted">You can also convert Gig Points to GigCash from the Gig Points screen.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Top up dialog (method → amount → pay → done) ----------

interface CashInMethodOption {
  key: string;
  section: "Pay with cash" | "E-wallets" | "QR & Cards";
  name: string;
  description: string;
  icon: LucideIcon;
  kind: DepositKind;
  enabled: boolean;
}

function buildCashInMethods(config: WalletRequestConfig): CashInMethodOption[] {
  const office = depositAccountsOf(config, "office");
  const remittance = depositAccountsOf(config, "remittance");
  const gcash = depositAccountsOf(config, "ewallet", "GCash");
  const maya = depositAccountsOf(config, "ewallet", "Maya");
  const methods: CashInMethodOption[] = [];
  if (office.length > 0) {
    methods.push({
      key: "office",
      section: "Pay with cash",
      name: office[0].method || "Cash at office",
      description: "Pay cash at a Giggre office and get an official receipt",
      icon: Building2,
      kind: "office",
      enabled: true,
    });
  }
  if (remittance.length > 0) {
    methods.push({
      key: "remittance",
      section: "Pay with cash",
      name: remittance[0].method || "Remittance center",
      description: "Palawan, Cebuana, M Lhuillier and other padala centers",
      icon: Landmark,
      kind: "remittance",
      enabled: true,
    });
  }
  methods.push({ key: "otc", section: "Pay with cash", name: "Over-the-Counter", description: "7-Eleven, Bayad Center and more", icon: Store, kind: "ewallet", enabled: false });
  methods.push({
    key: "gcash",
    section: "E-wallets",
    name: "GCash",
    description: gcash.length > 0 ? "Send to Giggre's GCash, then enter the reference number" : "Cash in from your GCash account",
    icon: Smartphone,
    kind: "ewallet",
    enabled: gcash.length > 0,
  });
  methods.push({ key: "maya", section: "E-wallets", name: "Maya", description: "Cash in from your Maya account", icon: WalletIcon, kind: "ewallet", enabled: maya.length > 0 });
  methods.push({ key: "qrph", section: "QR & Cards", name: "QR Ph", description: "Scan with any bank or e-wallet app", icon: QrCode, kind: "ewallet", enabled: false });
  methods.push({ key: "card", section: "QR & Cards", name: "Credit / Debit Card", description: "Visa or Mastercard", icon: CreditCard, kind: "ewallet", enabled: false });
  return methods;
}

const CASH_IN_SECTIONS = ["Pay with cash", "E-wallets", "QR & Cards"] as const;

type TopUpStep = "method" | "amount" | "pay" | "success";

function TopUpDialog({
  uid,
  config,
  fx,
  currencyCode,
  onClose,
}: {
  uid: string;
  config: WalletRequestConfig;
  fx: FxRates | null;
  currencyCode: string;
  onClose: () => void;
}) {
  const [step, setStep] = useState<TopUpStep>("method");
  const [method, setMethod] = useState("GCash");
  const [kind, setKind] = useState<DepositKind>("ewallet");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedAmount, setSubmittedAmount] = useState(0);

  const methods = useMemo(() => buildCashInMethods(config), [config]);
  const ratesReady = !!fx && fxKnows(fx, currencyCode);
  const effectiveMin = fx && config.deposit.min != null ? (fromUsd(fx, config.deposit.min, currencyCode) ?? 100) : 100;
  const effectiveMax = fx && config.deposit.max != null ? (fromUsd(fx, config.deposit.max, currencyCode) ?? 10_000) : 10_000;

  // Matches by method case-insensitively, falling back to showing every
  // account of this kind (TopUpPaymentScreen's _accounts getter).
  const matchingAccounts = useMemo(() => {
    const ofKind = depositAccountsOf(config, kind);
    if (kind !== "ewallet") return ofKind;
    const same = depositAccountsOf(config, kind, method);
    return same.length > 0 ? same : ofKind;
  }, [config, kind, method]);

  function selectMethod(m: CashInMethodOption) {
    if (!m.enabled) {
      toast(`${m.name} is coming soon.`);
      return;
    }
    setMethod(m.name);
    setKind(m.kind);
    setStep("amount");
  }

  function handleContinue() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter an amount.");
      return;
    }
    if (value < effectiveMin) {
      toast.error(`Minimum cash-in is ${formatWalletMoney(effectiveMin, currencyCode)}.`);
      return;
    }
    if (value > effectiveMax) {
      toast.error(`Maximum cash-in is ${formatWalletMoney(effectiveMax, currencyCode)}.`);
      return;
    }
    setStep("pay");
  }

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Couldn't copy — copy it manually.");
    }
  }

  async function handleSubmit() {
    if (reference.trim().length < 4) {
      toast.error(`Enter the ${DEPOSIT_KIND_REFERENCE_LABEL[kind]}.`);
      return;
    }
    if (matchingAccounts.length === 0) {
      toast.error("This top-up method is not set up yet. Please try another one.");
      return;
    }
    const value = Number(amount);
    setSubmitting(true);
    try {
      const clientRequestId = generateClientRequestId();
      let proofPath: string | undefined;
      let proofUrl: string | undefined;
      if (proofFile) {
        proofPath = `wallet_proofs/${uid}/${clientRequestId}.jpg`;
        const storageRef = ref(storage, proofPath);
        await uploadBytes(storageRef, proofFile);
        proofUrl = await getDownloadURL(storageRef);
      }
      await createWalletRequest({
        type: "deposit",
        amount: value,
        clientRequestId,
        method,
        methodKind: kind,
        reference: reference.trim(),
        proofPath,
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

  const amountIntro =
    kind === "ewallet"
      ? `Next, you'll see Giggre's ${method} account. Send the amount from your ${method} app, then enter the reference number.`
      : kind === "office"
        ? "Next, you'll see the office address and hours. Pay the amount in cash there and enter the official receipt number."
        : "Next, you'll see who to send it to. Send the amount at any remittance center, then enter the control number. You pay the center's fee.";

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
              <DialogDescription>Choose how you want to add money to your Gig Wallet. Giggre confirms each top up before it is added.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {CASH_IN_SECTIONS.map((section) => (
                <div key={section}>
                  <p className="mb-1.5 text-xs font-medium tracking-wide text-muted uppercase">{section}</p>
                  <div className="space-y-1.5">
                    {methods
                      .filter((m) => m.section === section)
                      .map((m) => (
                        <button
                          key={m.key}
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
              <DialogTitle>
                {kind === "ewallet" ? `Cash in via ${method}` : kind === "office" ? "Pay cash at the office" : "Send via remittance"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="cash-in-amount">Amount</Label>
                <div className="relative mt-1.5">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">{currencyCode === "PHP" ? "₱" : "$"}</span>
                  <Input id="cash-in-amount" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="pl-7" />
                </div>
                <p className="mt-1 text-xs text-muted">
                  {ratesReady ? `Min ${formatWalletMoney(effectiveMin, currencyCode)} · Max ${formatWalletMoney(effectiveMax, currencyCode)}` : "Loading limits…"}
                </p>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium tracking-wide text-muted uppercase">Quick amounts</p>
                <div className="flex flex-wrap gap-1.5">
                  {quickAmounts(currencyCode, false).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setAmount(String(n))}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        amount === String(n) ? "border-worker bg-worker text-white" : "border-hairline text-muted hover:bg-accent"
                      )}
                    >
                      {currencyCode === "PHP" ? "₱" : "$"}
                      {n.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
              <p className="rounded-lg border border-hairline bg-secondary px-3 py-2 text-xs text-muted">
                {amountIntro} Your Gig Wallet is updated once Giggre confirms it.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={handleContinue} disabled={!ratesReady}>
                {amount ? `Continue · ${formatWalletMoney(Number(amount) || 0, currencyCode)}` : "Continue"}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "pay" && (
          <>
            <DialogHeader>
              <DialogTitle>Pay {formatWalletMoney(Number(amount) || 0, currencyCode)}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="rounded-xl border border-hairline p-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-worker text-[11px] font-bold text-white">1</span>
                  <p className="text-sm font-medium text-ink">
                    {kind === "ewallet" && `Send exactly ${formatWalletMoney(Number(amount) || 0, currencyCode)}`}
                    {kind === "office" && `Pay ${formatWalletMoney(Number(amount) || 0, currencyCode)} in cash`}
                    {kind === "remittance" && `Send ${formatWalletMoney(Number(amount) || 0, currencyCode)} by remittance`}
                  </p>
                </div>
                <p className="mt-1 ml-7 text-xs text-muted">
                  {kind === "ewallet" && `Use your ${method} app to pay one of these Giggre accounts:`}
                  {kind === "office" && "Go to one of these offices and pay the cashier. Ask for an official receipt."}
                  {kind === "remittance" && "At any remittance center, send the amount to this receiver. The center charges you its own fee on top."}
                </p>
                {matchingAccounts.length === 0 ? (
                  <p className="mt-2 ml-7 text-xs text-destructive">This top-up method is not set up yet. Please try another one.</p>
                ) : (
                  <div className="mt-2 ml-7 space-y-2">
                    {matchingAccounts.map((a, i) => (
                      <div key={`${a.accountNumber}-${i}`} className="rounded-lg bg-secondary px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs text-muted">
                              {kind === "ewallet" ? `${a.method} · ${a.accountName}` : kind === "office" ? a.accountName : `Receiver: ${a.accountName}`}
                            </p>
                            <p className="truncate text-sm font-semibold text-ink">{kind === "remittance" ? `Mobile: ${a.accountNumber}` : a.accountNumber}</p>
                            {a.details && <p className="mt-1 text-xs text-muted">{a.details}</p>}
                          </div>
                          {kind !== "office" && (
                            <Button type="button" size="icon-sm" variant="ghost" onClick={() => copyText(a.accountNumber, "Account number")}>
                              <Copy className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {config.depositNote && <p className="mt-2 ml-7 text-xs text-muted">{config.depositNote}</p>}
              </div>

              <div className="rounded-xl border border-hairline p-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-worker text-[11px] font-bold text-white">2</span>
                  <p className="text-sm font-medium text-ink">Enter the {DEPOSIT_KIND_REFERENCE_LABEL[kind]}</p>
                </div>
                <div className="mt-2 ml-7 space-y-2">
                  <Input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder={kind === "ewallet" ? "e.g. 1234 567 890123" : kind === "office" ? "e.g. OR 004512" : "e.g. 1234-5678-9012"}
                  />
                  <p className="text-xs text-muted">
                    {kind === "ewallet" && `Find it on the receipt in your ${method} app.`}
                    {kind === "office" && "It's printed on the official receipt the cashier gives you."}
                    {kind === "remittance" && "It's on the remittance slip (also called KPTN, reference or tracking number)."}
                  </p>
                  <div>
                    <Label htmlFor="cash-in-proof">{kind === "ewallet" ? "Screenshot of the receipt (optional)" : "Photo of the receipt / slip (optional)"}</Label>
                    {proofFile ? (
                      <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg border border-hairline px-3 py-2">
                        <span className="truncate text-xs text-ink">{proofFile.name}</span>
                        <Button type="button" size="xs" variant="outline" onClick={() => setProofFile(null)}>
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <Input id="cash-in-proof" type="file" accept="image/*" onChange={(e) => setProofFile(e.target.files?.[0] ?? null)} className="mt-1.5" />
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
                Giggre will check your payment of {formatWalletMoney(submittedAmount, currencyCode)} and add it to your Gig Wallet. We&apos;ll notify you once
                it&apos;s done.
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

// ---------- Withdraw dialog (method → amount → payout details → done) ----------

const WITHDRAW_KIND_ICON: Record<DepositKind, LucideIcon> = { ewallet: Smartphone, office: Building2, remittance: Landmark };
const WITHDRAW_KIND_SECTION: Record<DepositKind, string> = { ewallet: "E-wallets & banks", office: "Pick up cash", remittance: "Remittance center" };

type WithdrawStep = "method" | "amount" | "details" | "success";

function WithdrawDialog({
  config,
  fx,
  currencyCode,
  balance,
  onClose,
}: {
  config: WalletRequestConfig;
  fx: FxRates | null;
  currencyCode: string;
  balance: number;
  onClose: () => void;
}) {
  const [step, setStep] = useState<WithdrawStep>("method");
  const [method, setMethod] = useState<WithdrawMethod | null>(null);
  const [amount, setAmount] = useState("");
  const [payoutName, setPayoutName] = useState("");
  const [payoutNumber, setPayoutNumber] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedAmount, setSubmittedAmount] = useState(0);

  const ratesReady = !!fx && fxKnows(fx, currencyCode);
  const min = fx && config.withdraw.min != null ? fromUsd(fx, config.withdraw.min, currencyCode) : null;
  const max = fx && config.withdraw.max != null ? fromUsd(fx, config.withdraw.max, currencyCode) : null;

  function selectMethod(m: WithdrawMethod) {
    setMethod(m);
    setStep("amount");
  }

  function handleContinue() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter an amount above 0.");
      return;
    }
    if (value > balance + 0.0001) {
      toast.error(`You only have ${formatWalletMoney(balance, currencyCode)} GigCash.`);
      return;
    }
    if (min != null && value < min) {
      toast.error(`Minimum withdrawal is ${formatWalletMoney(min, currencyCode)}.`);
      return;
    }
    if (max != null && value > max) {
      toast.error(`Maximum withdrawal is ${formatWalletMoney(max, currencyCode)}.`);
      return;
    }
    setStep("details");
  }

  const needsDetails = method?.kind !== "office";
  const ready = needsDetails ? payoutName.trim().length >= 2 && payoutNumber.replace(/\D/g, "").length >= 7 : true;

  async function handleSubmit() {
    if (!method) return;
    setSubmitting(true);
    try {
      const value = Number(amount);
      await createWalletRequest({
        type: "withdraw",
        amount: value,
        clientRequestId: generateClientRequestId(),
        method: method.method,
        methodKind: method.kind,
        payoutName: needsDetails ? payoutName.trim() || undefined : undefined,
        payoutNumber: needsDetails ? payoutNumber.trim() || undefined : undefined,
        note: note.trim() || undefined,
      });
      setSubmittedAmount(value);
      setStep("success");
    } catch (err) {
      console.error("Failed to submit withdrawal request:", err);
      const message = (err as { message?: string })?.message || "Couldn't submit your withdrawal request.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleBack() {
    if (step === "amount") setStep("method");
    else if (step === "details") setStep("amount");
  }

  const all = max != null && max < balance ? max : balance;
  const allLabel = all === balance ? "All" : "Max";

  return (
    <Dialog open onOpenChange={(open) => !open && step !== "success" && onClose()}>
      <DialogContent>
        {(step === "amount" || step === "details") && (
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
              <DialogTitle>Withdraw Methods</DialogTitle>
              <DialogDescription>Choose how you want to receive your GigCash. The amount is put on hold right away, and Giggre pays it out after review.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {(["ewallet", "office", "remittance"] as const).map((kind) => {
                const list = withdrawMethodsOf(config, kind);
                if (list.length === 0) return null;
                const Icon = WITHDRAW_KIND_ICON[kind];
                return (
                  <div key={kind}>
                    <p className="mb-1.5 text-xs font-medium tracking-wide text-muted uppercase">{WITHDRAW_KIND_SECTION[kind]}</p>
                    <div className="space-y-1.5">
                      {list.map((m) => (
                        <button
                          key={m.method}
                          type="button"
                          onClick={() => selectMethod(m)}
                          className="flex w-full items-center gap-3 rounded-xl border border-hairline p-3 text-left transition-colors hover:bg-accent"
                        >
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-(--worker-tint) text-(--worker-text)">
                            <Icon className="size-4.5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-ink">{m.method}</span>
                            <span className="block truncate text-xs text-muted">
                              {kind === "ewallet" && `Giggre sends it to your ${m.method} account`}
                              {kind === "office" && (m.details || "Collect it in cash with a valid ID")}
                              {kind === "remittance" && "Claim it with a control number and a valid ID"}
                            </span>
                          </span>
                          <ChevronRight className="size-4 shrink-0 text-muted" />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {step === "amount" && method && (
          <>
            <DialogHeader>
              <DialogTitle>
                {method.kind === "ewallet" && `Withdraw to ${method.method}`}
                {method.kind === "office" && "Pick up cash"}
                {method.kind === "remittance" && "Withdraw via remittance"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="withdraw-amount">Amount</Label>
                  <span className="text-xs text-muted">Available {formatWalletMoney(balance, currencyCode)}</span>
                </div>
                <div className="relative mt-1.5">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">{currencyCode === "PHP" ? "₱" : "$"}</span>
                  <Input id="withdraw-amount" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="pl-7" />
                </div>
                <p className="mt-1 text-xs text-muted">
                  {!ratesReady
                    ? "Loading limits…"
                    : [min != null && `Min ${formatWalletMoney(min, currencyCode)}`, max != null && `Max ${formatWalletMoney(max, currencyCode)}`].filter(Boolean).join(" · ") ||
                      "No minimum or maximum"}
                </p>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium tracking-wide text-muted uppercase">Quick amounts</p>
                <div className="flex flex-wrap gap-1.5">
                  {quickAmounts(currencyCode, true).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setAmount(String(n))}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        amount === String(n) ? "border-worker bg-worker text-white" : "border-hairline text-muted hover:bg-accent"
                      )}
                    >
                      {currencyCode === "PHP" ? "₱" : "$"}
                      {n.toLocaleString()}
                    </button>
                  ))}
                  {all > 0 && (
                    <button
                      type="button"
                      onClick={() => setAmount(String(Math.floor(all * 100) / 100))}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        Number(amount) === Math.floor(all * 100) / 100 ? "border-worker bg-worker text-white" : "border-hairline text-muted hover:bg-accent"
                      )}
                    >
                      {allLabel} · {formatWalletMoney(all, currencyCode)}
                    </button>
                  )}
                </div>
              </div>
              <p className="rounded-lg border border-hairline bg-secondary px-3 py-2 text-xs text-muted">
                {method.kind === "ewallet" && `Next, enter the ${method.method} account Giggre should send it to.`}
                {method.kind === "office" && "Next, you'll see where to pick up your cash. Bring a valid ID."}
                {method.kind === "remittance" && "Next, enter your full name as on your ID. Giggre sends you a control number to claim it at the center."} The amount
                is on hold from your Gig Wallet until Giggre pays it out.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={handleContinue} disabled={!ratesReady}>
                {amount ? `Continue · ${formatWalletMoney(Number(amount) || 0, currencyCode)}` : "Continue"}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "details" && method && (
          <>
            <DialogHeader>
              <DialogTitle>Withdraw {formatWalletMoney(Number(amount) || 0, currencyCode)}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="rounded-xl border border-hairline p-3">
                <p className="text-sm font-semibold text-ink">
                  {method.kind === "ewallet" && `Your ${method.method} account`}
                  {method.kind === "office" && `Pick up at ${method.method}`}
                  {method.kind === "remittance" && "Receiver details"}
                </p>
                <div className="mt-2 space-y-2">
                  {method.kind === "office" ? (
                    <>
                      {method.details && <p className="text-xs text-muted">{method.details}</p>}
                      <p className="text-xs text-muted">Bring a valid ID. Giggre completes the withdrawal when you receive the cash.</p>
                    </>
                  ) : (
                    <>
                      <div>
                        <Label htmlFor="payout-name">{method.kind === "remittance" ? "Full name (as on your valid ID)" : "Account name"}</Label>
                        <Input id="payout-name" value={payoutName} onChange={(e) => setPayoutName(e.target.value)} placeholder="Juan Dela Cruz" className="mt-1.5" />
                      </div>
                      <div>
                        <Label htmlFor="payout-number">{method.kind === "remittance" ? "Mobile number" : `${method.method} number`}</Label>
                        <Input id="payout-number" value={payoutNumber} onChange={(e) => setPayoutNumber(e.target.value)} placeholder="0917 123 4567" className="mt-1.5" />
                      </div>
                      <p className="text-xs text-muted">
                        {method.kind === "remittance"
                          ? "The name must match your ID exactly, or the center can't release it."
                          : "Double-check the number. Money sent to a wrong account may not be recoverable."}
                      </p>
                      {method.details && <p className="text-xs text-muted">{method.details}</p>}
                    </>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-hairline p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Method</span>
                  <span className="text-sm font-semibold text-ink">{method.method}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-sm text-muted">Amount</span>
                  <span className="text-base font-bold text-ink">{formatWalletMoney(Number(amount) || 0, currencyCode)}</span>
                </div>
                <p className="mt-2 text-xs text-muted">
                  This amount is taken from your Gig Wallet now and held until Giggre pays it out. If the request is rejected or you cancel it, it comes back.
                </p>
                {config.withdrawNote && <p className="mt-2 text-xs text-muted">{config.withdrawNote}</p>}
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-2" rows={2} placeholder="Note for Giggre (optional)" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSubmit} disabled={submitting || !ready}>
                {submitting ? "Submitting…" : "Request withdrawal"}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "success" && method && (
          <>
            <DialogHeader>
              <DialogTitle>Withdrawal requested</DialogTitle>
              <DialogDescription>
                {method.kind === "ewallet" &&
                  `${formatWalletMoney(submittedAmount, currencyCode)} is on hold. Giggre will send it to your ${method.method} account and notify you with the reference number.`}
                {method.kind === "office" &&
                  `${formatWalletMoney(submittedAmount, currencyCode)} is on hold for pickup at ${method.method}. Bring a valid ID when you collect it.`}
                {method.kind === "remittance" &&
                  `${formatWalletMoney(submittedAmount, currencyCode)} is on hold. Giggre will send it by remittance and notify you with the control number to claim it.`}
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

// ---------- Send dialog (number → amount+confirm → done) ----------

type SendStep = "number" | "amount" | "confirm";

function SendDialog({
  config,
  fx,
  currencyCode,
  balance,
  onClose,
}: {
  config: WalletRequestConfig;
  fx: FxRates | null;
  currencyCode: string;
  balance: number;
  onClose: () => void;
}) {
  const [step, setStep] = useState<SendStep>("number");
  const [digits, setDigits] = useState("");
  const [recipient, setRecipient] = useState<WalletRecipient | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isValidNumber = /^9\d{9}$/.test(digits);
  const limits = config.transfer;
  const min = fx && limits.min != null ? fromUsd(fx, limits.min, currencyCode) : null;
  const max = fx && limits.max != null ? fromUsd(fx, limits.max, currencyCode) : null;
  const value = Number(amount);
  const theyGet = recipient && recipient.currencyCode !== currencyCode && fx && Number.isFinite(value) ? convertDown(fx, value, currencyCode, recipient.currencyCode) : null;

  async function handleLookup() {
    if (!isValidNumber || lookingUp) return;
    setLookingUp(true);
    try {
      const freshConfig = await fetchWalletRequestConfig();
      if (!isWalletRequestTypeOpen(freshConfig, "transfer")) {
        toast.error("Send isn't available right now.");
        return;
      }
      const r = await lookupWalletRecipient(`+63${digits}`);
      setRecipient(r);
      setStep("amount");
    } catch (err) {
      console.error("Failed to look up recipient:", err);
      const message = (err as { message?: string })?.message || "Couldn't find that number.";
      toast.error(message);
    } finally {
      setLookingUp(false);
    }
  }

  function handleContinue() {
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter an amount above 0.");
      return;
    }
    if (min != null && value < min) {
      toast.error(`Minimum is ${formatWalletMoney(min, currencyCode)}.`);
      return;
    }
    if (max != null && value > max) {
      toast.error(`Maximum is ${formatWalletMoney(max, currencyCode)}.`);
      return;
    }
    if (value > balance) {
      toast.error(`Your GigCash is ${formatWalletMoney(balance, currencyCode)}.`);
      return;
    }
    setStep("confirm");
  }

  async function handleSend() {
    if (!recipient) return;
    setSubmitting(true);
    try {
      await createWalletRequest({ type: "transfer", amount: value, clientRequestId: generateClientRequestId(), recipientId: recipient.recipientId, note: note.trim() || undefined });
      toast.success(`Sending ${formatWalletMoney(value, currencyCode)} to ${recipient.name} is waiting for review. We'll notify you.`);
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
        {step === "number" && (
          <>
            <DialogHeader>
              <DialogTitle>Choose Recipient</DialogTitle>
              <DialogDescription>Send GigCash to another Giggre user by their mobile number.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="wallet-recipient">Mobile number</Label>
                <div className={cn("mt-1.5 flex items-center gap-2 rounded-lg border px-3", isValidNumber ? "border-worker" : "border-hairline")}>
                  <span className="text-sm text-muted">🇵🇭 +63</span>
                  <div className="h-5 w-px bg-hairline" />
                  <Input
                    id="wallet-recipient"
                    value={digits}
                    onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="Enter a mobile number"
                    className="border-0 px-0 shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleLookup} disabled={!isValidNumber || lookingUp}>
                {lookingUp ? "Looking up…" : "Continue"}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "amount" && recipient && (
          <>
            <button
              type="button"
              onClick={() => setStep("number")}
              className="-mt-1 -ml-1 flex w-fit items-center gap-0.5 rounded-md px-1 py-0.5 text-xs font-medium text-muted hover:text-ink"
            >
              <ChevronLeft className="size-3.5" /> Back
            </button>
            <DialogHeader>
              <DialogTitle>Send GigCash</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl border border-hairline p-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-(--worker-tint) text-sm font-bold text-(--worker-text)">
                  {recipient.name.charAt(0) || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{recipient.name}</p>
                  {recipient.code && <p className="truncate text-xs text-muted">{recipient.code}</p>}
                </div>
              </div>
              <div>
                <Label htmlFor="send-amount">Amount</Label>
                <div className="relative mt-1.5">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">{currencyCode === "PHP" ? "₱" : "$"}</span>
                  <Input id="send-amount" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="pl-7" />
                </div>
                <p className="mt-1 text-xs text-muted">
                  Available {formatWalletMoney(balance, currencyCode)}
                  {min != null && ` · Min ${formatWalletMoney(min, currencyCode)}`}
                  {max != null && ` · Max ${formatWalletMoney(max, currencyCode)}`}
                </p>
                {theyGet != null && (
                  <p className="mt-1.5 text-xs font-semibold text-ink">
                    {recipient.name} receives {formatWalletMoney(theyGet, recipient.currencyCode)} (their wallet is in {recipient.currencyCode})
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="send-note">Message (optional)</Label>
                <Textarea id="send-note" value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5" rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleContinue}>{amount ? `Send ${formatWalletMoney(value || 0, currencyCode)}` : "Send"}</Button>
            </DialogFooter>
          </>
        )}

        {step === "confirm" && recipient && (
          <>
            <DialogHeader>
              <DialogTitle>Send {formatWalletMoney(value, currencyCode)}?</DialogTitle>
              <DialogDescription>
                To {recipient.name}
                {recipient.code ? ` (${recipient.code})` : ""}.{theyGet != null && ` They receive ${formatWalletMoney(theyGet, recipient.currencyCode)} at the current exchange rate.`}{" "}
                A Giggre admin reviews every send. {formatWalletMoney(value, currencyCode)} is taken from your wallet now and refunded if it is rejected or you cancel it.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("amount")} disabled={submitting}>
                Back
              </Button>
              <Button onClick={handleSend} disabled={submitting}>
                {submitting ? "Sending…" : "Send request"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------- Requests tab ----------

function RequestRow({ request, onCancel }: { request: WalletRequest; onCancel?: () => void }) {
  const Icon = REQUEST_TYPE_ICON[request.type];
  const isOut = request.type !== "deposit";
  const voided = request.status === "rejected" || request.status === "cancelled";
  const title =
    request.type === "transfer"
      ? "Send"
      : request.type === "withdraw"
        ? `Withdraw${request.method ? ` · ${request.method}` : ""}`
        : `Top up${request.method ? ` via ${request.method}` : ""}`;
  const subtitle = [
    request.type === "transfer" && request.recipientName && `To ${request.recipientName}`,
    request.type === "withdraw" && request.payoutNumber && `To ${request.payoutNumber}`,
    request.type === "deposit" && request.reference && `Ref ${request.reference}`,
    formatDateTime(request.createdAt),
  ]
    .filter(Boolean)
    .join(" · ");

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(request.payoutReference);
      toast.success("Copied");
    } catch {
      toast.error("Couldn't copy — copy it manually.");
    }
  }

  return (
    <Card className="p-3">
      <div className="flex items-center gap-3">
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", isOut ? "bg-destructive/10 text-destructive" : "bg-(--success-tint) text-(--success-text)")}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{title}</p>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={cn("text-sm font-semibold", voided && "text-muted line-through", !voided && (request.status === "approved" ? (isOut ? "text-destructive" : "text-(--success-text)") : "text-ink"))}>
            {isOut ? "−" : "+"}
            {formatWalletMoney(request.amount, request.currencyCode)}
          </span>
          <Badge
            className={
              request.status === "approved"
                ? "bg-(--success-tint) text-(--success-text)"
                : request.status === "rejected"
                  ? "bg-destructive/10 text-destructive"
                  : request.status === "cancelled"
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
            }
          >
            {request.status === "pending" ? "Pending review" : request.status.charAt(0).toUpperCase() + request.status.slice(1)}
          </Badge>
        </div>
      </div>
      {request.type === "withdraw" && request.status === "approved" && request.payoutReference && (
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-hairline pt-2">
          <p className="text-xs font-semibold text-ink">
            {request.methodKind === "remittance" ? `Control no. ${request.payoutReference} — claim it with a valid ID.` : `Reference: ${request.payoutReference}`}
          </p>
          <Button size="icon-sm" variant="ghost" onClick={copyReference}>
            <Copy className="size-3.5" />
          </Button>
        </div>
      )}
      {request.decisionNote && <p className="mt-2 text-xs text-destructive">Reason: {request.decisionNote}</p>}
      {request.status === "pending" && (
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-hairline pt-2">
          <p className="text-xs text-muted">
            {request.type === "transfer" && "Amount on hold until a Giggre admin reviews it."}
            {request.type === "withdraw" && (request.methodKind === "office" ? "On hold for pickup. Bring a valid ID." : "On hold until Giggre pays it out.")}
            {request.type === "deposit" && "Giggre is confirming your payment."}
          </p>
          {onCancel && (
            <Button size="xs" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

// ---------- How it works tab ----------

function InfoCard({ title, icon: Icon, steps, footnote }: { title: string; icon: LucideIcon; steps: string[]; footnote?: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-(--worker-tint) text-(--worker-text)">
          <Icon className="size-3.5" />
        </div>
        <p className="font-medium text-ink">{title}</p>
      </div>
      <div className="mt-3 space-y-1.5">
        {steps.map((s, i) => (
          <div key={s} className="flex gap-2">
            <span className="w-4 shrink-0 text-xs font-bold text-(--worker-text)">{steps.length > 1 ? `${i + 1}.` : "•"}</span>
            <p className="text-xs text-muted">{s}</p>
          </div>
        ))}
      </div>
      {footnote && <p className="mt-2 text-xs font-semibold text-ink">{footnote}</p>}
    </Card>
  );
}

// ---------- Main page ----------

const TX_PAGE_SIZE = 30;
type WalletFilter = "all" | "moneyIn" | "moneyOut" | "pending";
const WALLET_FILTERS: { key: WalletFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "moneyIn", label: "Money in" },
  { key: "moneyOut", label: "Money out" },
  { key: "pending", label: "Pending" },
];
function matchesFilter(tx: WalletTransaction, filter: WalletFilter): boolean {
  switch (filter) {
    case "moneyIn":
      return isWalletTxIn(tx) && tx.status === "completed" && tx.type !== "refund";
    case "moneyOut":
      return !isWalletTxIn(tx) && tx.status === "completed";
    case "pending":
      return tx.status === "pending";
    default:
      return true;
  }
}

export default function WalletPage({ role }: { role: "host" | "worker" }) {
  const uid = useAppSelector((root) => root.user.authUser?.uid);
  const isVerified = useAppSelector((root) => root.user.profile?.isVerified) === "verified";

  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [config, setConfig] = useState<WalletRequestConfig | null>(null);
  const [fx, setFx] = useState<FxRates | null>(null);
  const [requests, setRequests] = useState<WalletRequest[]>([]);
  const [showInfo, setShowInfo] = useState(false);
  const [dialog, setDialog] = useState<WalletRequestType | null>(null);
  const [blockedDialog, setBlockedDialog] = useState<string | null>(null);

  const [activityFilter, setActivityFilter] = useState<WalletFilter>("all");
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
    fetchFxRates().then(setFx).catch(() => {});
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
        setTransactions(collapseWalletRefunds(result.transactions));
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
  const waitingRequests = requests.filter((r) => r.status === "pending");
  const completedRequests = requests.filter((r) => r.status !== "pending");

  const filteredTransactions = useMemo(() => transactions.filter((tx) => matchesFilter(tx, activityFilter)), [transactions, activityFilter]);

  const groupedTransactions = useMemo(() => {
    const groups: { label: string; items: WalletTransaction[] }[] = [];
    for (const tx of filteredTransactions) {
      const label = dayLabel(tx.createdAt);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(tx);
      else groups.push({ label, items: [tx] });
    }
    return groups;
  }, [filteredTransactions]);

  const currencyCode = balance?.currencyCode ?? "PHP";

  function handleActionClick(type: WalletRequestType) {
    if (pendingRequest) {
      setBlockedDialog(
        `Your ${walletRequestLabel(pendingRequest.type).toLowerCase()} of ${formatWalletMoney(pendingRequest.amount, pendingRequest.currencyCode)} is waiting for a Giggre admin. You can make a new request once it is approved or rejected, or cancel it from the Requests tab.`
      );
      return;
    }
    if (!config || !isWalletRequestTypeOpen(config, type)) {
      toast.error(`${REQUEST_TYPE_LABEL[type]} isn't available right now.`);
      return;
    }
    if ((type === "transfer" || type === "withdraw") && !isVerified) {
      toast.error(type === "transfer" ? "Only verified accounts can send money. Verify your account first." : "Only verified accounts can withdraw. Verify your account first.");
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

  return (
    <JoshDiv>
      <TitlePage title="Gig Wallet" description="Top up, send, withdraw, and track your GigCash" />

      <div className="mx-auto mt-6 max-w-3xl space-y-5">
        <Card className="relative gap-3 overflow-hidden border-none bg-gradient-to-br from-emerald-400 to-emerald-600 p-6 text-white">
          <div aria-hidden className="pointer-events-none absolute -top-12 -right-12 size-44 rounded-full border-[16px] border-white/10" />
          <div aria-hidden className="pointer-events-none absolute top-8 -right-2 size-24 rounded-full border-[10px] border-white/10" />

          <div className="relative flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-emerald-600">
                <WalletIcon className="size-3.5" />
              </span>
              <p className="text-sm font-medium text-white/90">Available GigCash</p>
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

          <p className="relative text-4xl font-bold">{balance ? formatWalletMoney(balance.balance, currencyCode) : "—"}</p>

          <p className="relative min-h-4 text-xs text-white/80">
            {[
              pendingRequest && `${walletRequestLabel(pendingRequest.type)} of ${formatWalletMoney(pendingRequest.amount, pendingRequest.currencyCode)} in review`,
              balance?.fromCache && "Offline — showing last synced balance",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          <div className="relative mt-1 grid grid-cols-3 gap-2">
            {(["deposit", "withdraw", "transfer"] as const).map((type) => {
              const Icon = REQUEST_TYPE_ICON[type];
              const open = !!config && isWalletRequestTypeOpen(config, type) && !pendingRequest;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleActionClick(type)}
                  className={cn("flex flex-col items-center gap-1.5 rounded-2xl bg-white/15 py-3 text-xs font-medium transition-colors hover:bg-white/20", !open && "opacity-50")}
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

        <StatsStrip transactions={txLoaded ? transactions : null} currencyCode={currencyCode} />

        <SecurityBanner role={role} />

        {config && !config.enabled && (
          <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50">
            Gig Wallet requests are paused right now. GigCash you already have is safe.
          </Card>
        )}

        <Tabs defaultValue="activity">
          <TabsList variant="line" className="h-auto w-full justify-start gap-5 border-b border-hairline pb-0">
            <TabsTrigger value="activity" className="gap-1.5 rounded-none border-0 px-0.5 pb-2.5 text-sm data-active:font-semibold data-active:after:bg-emerald-500">
              Activity
            </TabsTrigger>
            <TabsTrigger value="requests" className="gap-1.5 rounded-none border-0 px-0.5 pb-2.5 text-sm data-active:font-semibold data-active:after:bg-emerald-500">
              Requests
              {waitingRequests.length > 0 && <Badge className="bg-amber-500 text-white">{waitingRequests.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="info" className="gap-1.5 rounded-none border-0 px-0.5 pb-2.5 text-sm data-active:font-semibold data-active:after:bg-emerald-500">
              How it works
            </TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {WALLET_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setActivityFilter(f.key)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    activityFilter === f.key ? "border-emerald-500 bg-emerald-500 text-white" : "border-hairline text-muted hover:bg-accent"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {!txLoaded ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : filteredTransactions.length === 0 ? (
              <Card className="flex flex-col items-center gap-2 p-10 text-center">
                <WalletIcon className="size-8 text-muted" />
                <p className="text-sm font-medium text-ink">No transactions yet</p>
                <p className="text-xs text-muted">
                  {activityFilter === "all" ? "Top up to add GigCash, or earn it from gigs." : "Nothing here for this filter."}
                </p>
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
                              <p className="truncate text-xs text-muted">{walletTxTypeLabel(tx.type)}</p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <span className={cn("text-sm font-semibold", isWalletTxIn(tx) ? "text-(--success-text)" : "text-destructive", (tx.status === "failed" || tx.status === "reversed") && "text-muted line-through")}>
                                {formatWalletTxAmount(tx, currencyCode)}
                              </span>
                              {tx.status !== "completed" && (
                                <Badge
                                  className={
                                    tx.status === "pending"
                                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                      : "bg-secondary text-secondary-foreground"
                                  }
                                >
                                  {walletTxStatusLabel(tx.status)}
                                </Badge>
                              )}
                            </div>
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
          </TabsContent>

          <TabsContent value="requests" className="mt-4 space-y-4">
            {requests.length === 0 ? (
              <Card className="flex flex-col items-center gap-2 p-10 text-center">
                <WalletIcon className="size-8 text-muted" />
                <p className="text-sm font-medium text-ink">No requests yet</p>
                <p className="text-xs text-muted">Use Top Up or Send above — a Giggre admin reviews each one before it goes through.</p>
              </Card>
            ) : (
              <>
                {waitingRequests.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium tracking-wide text-muted uppercase">Waiting for review</p>
                    <div className="space-y-2">
                      {waitingRequests.map((r) => (
                        <RequestRow key={r.id} request={r} onCancel={() => setCancelTarget(r)} />
                      ))}
                    </div>
                  </div>
                )}
                {completedRequests.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium tracking-wide text-muted uppercase">Completed</p>
                    <div className="space-y-2">
                      {completedRequests.map((r) => (
                        <RequestRow key={r.id} request={r} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="info" className="mt-4 space-y-3">
            <InfoCard
              title="Top Up"
              icon={CreditCard}
              steps={[
                "Choose how to pay: cash at a Giggre office, a remittance center, or GCash.",
                "Enter the amount, then pay it using the details shown.",
                "Enter the receipt, control or reference number (and a photo if you have one).",
                "Giggre confirms the payment and adds the GigCash.",
              ]}
            />
            <InfoCard
              title="Send"
              icon={ArrowUpRight}
              steps={["Enter the person's mobile number.", "Enter the amount. It goes on hold in your wallet right away.", "Giggre reviews it, then the money arrives. If it is rejected or you cancel, it comes back."]}
              footnote="Only verified accounts can send."
            />
            <InfoCard
              title="Withdraw"
              icon={Landmark}
              steps={[
                "Choose how to receive it: your e-wallet, cash pickup at a Giggre office, or a remittance center.",
                "Enter the amount and where to send it. It goes on hold in your wallet right away.",
                "Giggre pays it out, then sends you the reference or control number.",
                "If it is rejected or you cancel, the amount comes back.",
              ]}
              footnote="Only verified accounts can withdraw."
            />
            <InfoCard
              title="Good to know"
              icon={Info}
              steps={["You can have one request waiting for review at a time.", "Each request has a minimum, a maximum and a daily limit.", "You're notified when a request is approved or rejected."]}
            />
            <SecurityBanner role={role} />
          </TabsContent>
        </Tabs>
      </div>

      <InfoDialog open={showInfo} onOpenChange={setShowInfo} />

      {dialog === "deposit" && config && <TopUpDialog uid={uid} config={config} fx={fx} currencyCode={currencyCode} onClose={() => setDialog(null)} />}
      {dialog === "withdraw" && config && <WithdrawDialog config={config} fx={fx} currencyCode={currencyCode} balance={balance?.balance ?? 0} onClose={() => setDialog(null)} />}
      {dialog === "transfer" && config && <SendDialog config={config} fx={fx} currencyCode={currencyCode} balance={balance?.balance ?? 0} onClose={() => setDialog(null)} />}

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
            <AlertDialogTitle>Cancel this {cancelTarget ? walletRequestLabel(cancelTarget.type).toLowerCase() : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget?.type === "deposit"
                ? "Giggre will no longer review this top up. If you already paid, contact support instead."
                : `${cancelTarget ? formatWalletMoney(cancelTarget.amount, cancelTarget.currencyCode) : ""} goes back to your Gig Wallet.`}
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
                  <span className="text-muted">Type</span>
                  <span className="text-ink">{walletTxTypeLabel(selectedTx.type)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted">Date &amp; time</span>
                  <span className="text-ink">{formatDateTime(selectedTx.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted">Amount</span>
                  <span className="font-semibold text-ink">{formatWalletTxAmount(selectedTx, currencyCode, false)}</span>
                </div>
                {selectedTx.balanceAfter != null && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted">GigCash after</span>
                    <span className="text-ink">{formatWalletMoney(selectedTx.balanceAfter, selectedTx.currencyCode)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted">Reference no.</span>
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-ink">{selectedTx.id}</span>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(selectedTx.id);
                          toast.success("Reference number copied.");
                        } catch {
                          toast.error("Couldn't copy — copy it manually.");
                        }
                      }}
                    >
                      <Copy className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted">Something wrong with this transaction? Contact support and include the reference number.</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </JoshDiv>
  );
}
