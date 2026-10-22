"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeftRight,
  Award,
  CircleCheck,
  Clock,
  Gift,
  Handshake,
  Info,
  Megaphone,
  MinusCircle,
  PlusCircle,
  Sparkles,
  Star,
  Target,
  Wallet,
  Zap,
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
import { GIG_TYPE_BADGE_CLASSES, type GigTypeKey } from "@/lib/earnings";
import { capitalize } from "@/lib/gig-format";
import { HOST_GIG_COLLECTIONS } from "@/lib/host-gigs";
import { subscribeAcceptedApplications } from "@/lib/browse-gigs";
import { subscribeWalletBalance, type WalletBalance } from "@/lib/wallet";
import { cancelGigPointsRequest, createGigPointsRequest, generateClientRequestId, type PointsRequestType } from "@/lib/firebase-functions";
import {
  cashForPoints,
  fetchGigPointsConfig,
  fetchGigPointsLedgerEntry,
  fetchGigPointsRequestLimits,
  formatGigPoints,
  isConversionTx,
  isMovementTx,
  isRequestTypeOpen,
  movementStatusLabel,
  rewardStageForGigStatus,
  rewardStageForTransaction,
  subscribeGigPointsBalance,
  subscribeGigPointsRequests,
  subscribeGigPointsTransactions,
  transactionTitle,
  POINTS_REQUEST_LABEL,
  POINTS_REQUEST_NOUN,
  POINTS_REQUEST_TITLE,
  REWARD_STAGE_INFO,
  type GigPointsBalance,
  type GigPointsConfig,
  type GigPointsRequest,
  type GigPointsTransaction,
  type GigPointsTxType,
  type PointsRequestLimits,
  type PointsTypeLimits,
  type RewardStage,
} from "@/lib/gig-points";
import { currencySymbol } from "@/lib/utils";

// Mirrors giggre_app's lib/features/gig_points/gig_points_screen.dart — a
// wallet-style screen (hero balance + a Points ⇄ GigCash conversion, a stats
// strip, a current-gig-reward card, and 3 pinned tabs: Activity / Requests /
// How to earn). Every balance/ledger/request mutation happens server-side —
// "To GigCash"/"To Points" only ever create admin-reviewed conversion
// requests via the 2 callables in firebase-functions.ts, approved/rejected
// from giggre-admin's Gig Points → Requests tab. There is no more P2P
// transfer here — that now lives only in Gig Wallet's own Send.

function formatCash(amount: number, currencyCode: string): string {
  return `${currencySymbol(currencyCode)}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function gigTypeBadgeClass(gigType: string): string {
  return GIG_TYPE_BADGE_CLASSES[gigType as GigTypeKey] ?? "bg-secondary text-secondary-foreground";
}

const GIG_TYPE_ICON: Record<string, LucideIcon> = { quick: Zap, open: Megaphone, offered: Handshake };

// Legacy deposit/withdraw/transfer entries can still appear on old ledgers —
// kept for display only, nothing creates them anymore.
const MOVEMENT_ICON: Record<string, { icon: LucideIcon; className: string }> = {
  convert_to_cash: { icon: Wallet, className: "bg-amber-500/10 text-amber-700" },
  convert_to_points: { icon: Star, className: "bg-blue-500/10 text-blue-700" },
  deposit: { icon: PlusCircle, className: "bg-(--success-tint) text-(--success-text)" },
  withdraw: { icon: Wallet, className: "bg-amber-500/10 text-amber-700" },
  transfer_out: { icon: ArrowLeftRight, className: "bg-blue-500/10 text-blue-700" },
  transfer_in: { icon: ArrowLeftRight, className: "bg-blue-500/10 text-blue-700" },
};

function TransactionIcon({ tx }: { tx: GigPointsTransaction }) {
  if (tx.type === "earn") {
    const Icon = GIG_TYPE_ICON[tx.gigType] ?? Star;
    return (
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-(--worker-tint) text-(--worker-text)">
        <Icon className="size-4" />
      </div>
    );
  }
  if (tx.type === "adjustment") {
    const positive = tx.points >= 0;
    return (
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          positive ? "bg-(--success-tint) text-(--success-text)" : "bg-destructive/10 text-destructive"
        )}
      >
        {positive ? <Gift className="size-4" /> : <MinusCircle className="size-4" />}
      </div>
    );
  }
  const movement = MOVEMENT_ICON[tx.type];
  const Icon = movement?.icon ?? Star;
  return (
    <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", movement?.className)}>
      <Icon className="size-4" />
    </div>
  );
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

const STAGE_BADGE_CLASS: Record<RewardStage, string> = {
  notYetEarned: "bg-secondary text-secondary-foreground",
  awaitingApproval: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  approvedProcessing: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  credited: "bg-(--success-tint) text-(--success-text)",
  notEligible: "bg-destructive/10 text-destructive",
};

function StagePill({ stage }: { stage: RewardStage }) {
  return <Badge className={STAGE_BADGE_CLASS[stage]}>{REWARD_STAGE_INFO[stage].label}</Badge>;
}

// Movements (conversions, and legacy deposit/withdraw/transfer) are worded as
// a request's progress rather than a reward stage — same stage colors, but
// movementStatusLabel's wording ("Pending review"/"Completed"/"Rejected"/
// "Cancelled") instead of REWARD_STAGE_INFO's task-reward labels.
function TxStatusPill({ tx }: { tx: GigPointsTransaction }) {
  const stage = rewardStageForTransaction(tx.status);
  const label = isMovementTx(tx) ? movementStatusLabel(tx) : REWARD_STAGE_INFO[stage].label;
  return <Badge className={STAGE_BADGE_CLASS[stage]}>{label}</Badge>;
}

// One card for the sidebar column next to the hero — icon, label + subtext,
// and a value, each on its own row, separated by hairlines (not 3 cards).
function StatsColumn({ balance }: { balance: GigPointsBalance | null }) {
  const n = (v: number | undefined) => (balance ? formatGigPoints(v ?? 0) : "–");
  return (
    <Card className="divide-y divide-hairline gap-0 p-0">
      <StatRow icon={Clock} iconClassName="text-muted" label="Processing" subtext="In escrow / pending" value={n(balance?.pendingPoints)} unit="pts" />
      <StatRow
        icon={Award}
        iconClassName="text-amber-600 dark:text-amber-400"
        label="Lifetime earned"
        subtext="Total historical points"
        value={n(balance?.lifetimeEarned)}
        unit="pts"
      />
      <StatRow
        icon={Target}
        iconClassName="text-blue-600 dark:text-blue-400"
        label="Tasks rewarded"
        subtext="Completed assignments"
        value={balance ? String(balance.gigsRewarded) : "–"}
      />
    </Card>
  );
}

function StatRow({
  icon: Icon,
  iconClassName,
  label,
  subtext,
  value,
  unit,
}: {
  icon: LucideIcon;
  iconClassName: string;
  label: string;
  subtext: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="flex flex-1 items-center justify-between gap-3 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary", iconClassName)}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{label}</p>
          <p className="truncate text-xs text-muted">{subtext}</p>
        </div>
      </div>
      <p className="shrink-0 text-lg font-bold text-ink">
        {value}
        {unit && <span className="ml-1 text-xs font-medium text-muted">{unit}</span>}
      </p>
    </div>
  );
}

const REQUEST_TYPE_ICON: Record<PointsRequestType, LucideIcon> = { toCash: Wallet, toPoints: Star };
const REQUEST_STATUS_BADGE: Record<GigPointsRequest["status"], string> = {
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  approved: "bg-(--success-tint) text-(--success-text)",
  rejected: "bg-destructive/10 text-destructive",
  cancelled: "bg-secondary text-secondary-foreground",
};
const REQUEST_STATUS_LABEL: Record<GigPointsRequest["status"], string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

// ---------- Current gig reward card ----------

const REWARD_STEPS: RewardStage[] = ["notYetEarned", "awaitingApproval", "approvedProcessing", "credited"];

function CurrentGigRewardCard({ uid, config }: { uid: string; config: GigPointsConfig | null }) {
  const [activeGig, setActiveGig] = useState<{ gigId: string; gigType: "open"; title: string; status: string } | null>(null);
  const [ledgerEntry, setLedgerEntry] = useState<GigPointsTransaction | null>(null);

  useEffect(() => {
    return subscribeAcceptedApplications(
      uid,
      (apps) => setActiveGig(apps[0] ?? null),
      (err) => console.error("Failed to load active gig for Gig Points card:", err)
    );
  }, [uid]);

  useEffect(() => {
    if (!activeGig) {
      // Resetting for "no active gig anymore," not reacting to its own value.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLedgerEntry(null);
      return;
    }
    const collectionName = HOST_GIG_COLLECTIONS[activeGig.gigType];
    fetchGigPointsLedgerEntry(uid, collectionName, activeGig.gigId)
      .then(setLedgerEntry)
      .catch((err) => console.error("Failed to load gig reward entry:", err));
  }, [uid, activeGig]);

  if (!activeGig) return null;

  const stage = ledgerEntry ? rewardStageForTransaction(ledgerEntry.status) : rewardStageForGigStatus(activeGig.status);
  const points = ledgerEntry?.points ?? config?.pointsByGigType[activeGig.gigType];
  const stepIndex = Math.max(0, REWARD_STEPS.indexOf(stage));

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-ink">Current gig reward</p>
        <StagePill stage={stage} />
      </div>
      <p className="mt-1 truncate text-sm text-muted">{activeGig.title}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{points != null ? `${points} pts` : "No reward set"}</p>
      <div className="mt-3 flex items-center gap-1">
        {REWARD_STEPS.map((step, i) => (
          <div key={step} className={cn("h-1.5 flex-1 rounded-full", i <= stepIndex ? "bg-(--worker-end)" : "bg-hairline")} />
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">{REWARD_STAGE_INFO[stage].explanation}</p>
    </Card>
  );
}

// ---------- Info dialog ----------

function InfoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>How Gig Points work</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-medium text-ink">Available balance</p>
            <p className="text-muted">Only credited points. You can convert these to GigCash.</p>
          </div>
          <div>
            <p className="font-medium text-ink">Processing</p>
            <p className="text-muted">Rewards the host has approved, waiting for payment to be confirmed. Not spendable yet.</p>
          </div>
          <div>
            <p className="font-medium text-ink">On hold</p>
            <p className="text-muted">
              Points reserved by a conversion to GigCash that a Giggre admin is reviewing. They come back if it is
              rejected or you cancel it.
            </p>
          </div>
          <div>
            <p className="font-medium text-ink">Conversion</p>
            <p className="text-muted">
              Turn points into GigCash in your Gig Wallet, or GigCash into points, at the rates Giggre sets. Each
              conversion is reviewed by a Giggre admin before it goes through, and you can have one waiting at a time.
            </p>
          </div>
          <div className="border-t border-hairline pt-3">
            <p className="mb-1.5 font-medium text-ink">What the labels mean</p>
            <div className="space-y-2">
              {(Object.keys(REWARD_STAGE_INFO) as RewardStage[]).map((stage) => (
                <div key={stage} className="flex items-start gap-2">
                  <StagePill stage={stage} />
                  <p className="text-xs text-muted">{REWARD_STAGE_INFO[stage].explanation}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Points ⇄ GigCash conversion dialog ----------
// Mirrors points_request_sheet.dart's two steps (form with a live preview,
// then a confirmation summary) — nothing is sent until the user confirms.

type ConversionStep = "form" | "confirm" | "done";

function PointsRequestDialog({
  type,
  typeLimits,
  availablePoints,
  wallet,
  onClose,
}: {
  type: PointsRequestType;
  typeLimits: PointsTypeLimits;
  availablePoints: number;
  wallet: WalletBalance | null;
  onClose: () => void;
}) {
  const [step, setStep] = useState<ConversionStep>("form");
  const [points, setPoints] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const toCash = type === "toCash";
  const rate = typeLimits.rate ?? 1;
  const ccy = wallet?.currencyCode ?? "PHP";
  const walletBal = wallet?.balance ?? 0;

  const pointsValue = (() => {
    const v = Number(points);
    return Number.isInteger(v) && v > 0 ? v : null;
  })();
  const cash = pointsValue == null ? null : cashForPoints(type, pointsValue, rate);

  const maxPoints = Math.max(
    0,
    Math.min(
      toCash ? availablePoints : Math.floor(walletBal * rate + 1e-6),
      typeLimits.max ?? Infinity,
      typeLimits.dailyMax ?? Infinity
    )
  );

  const amountError = (() => {
    if (!points.trim()) return null;
    if (pointsValue == null) return "Enter a whole number of points.";
    if (typeLimits.min != null && pointsValue < typeLimits.min) return `Minimum is ${typeLimits.min} points.`;
    if (typeLimits.max != null && pointsValue > typeLimits.max) return `Maximum is ${typeLimits.max} points per request.`;
    if (typeLimits.dailyMax != null && pointsValue > typeLimits.dailyMax) return `The daily limit is ${typeLimits.dailyMax} points.`;
    const c = cash ?? 0;
    if (c <= 0) return "That is worth less than ₱0.01. Enter more points.";
    if (toCash && pointsValue > availablePoints) return `You only have ${availablePoints} available points.`;
    if (!toCash && c > walletBal) return `This costs ${formatCash(c, ccy)} but your GigCash is ${formatCash(walletBal, ccy)}.`;
    return null;
  })();

  const formReady = pointsValue != null && amountError == null;

  async function handleSubmit() {
    if (pointsValue == null) return;
    setSubmitting(true);
    try {
      await createGigPointsRequest({
        type,
        points: pointsValue,
        clientRequestId: generateClientRequestId(),
        note: note.trim() || undefined,
      });
      setStep("done");
    } catch (err) {
      console.error("Failed to submit conversion request:", err);
      const message = (err as { message?: string })?.message || "Couldn't submit your conversion request.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && step !== "done" && onClose()}>
      <DialogContent>
        {step === "form" && (
          <>
            <DialogHeader>
              <DialogTitle>{toCash ? "Convert to GigCash" : "Convert to Points"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 p-3.5">
                <p className="text-sm font-semibold text-ink">
                  {toCash ? `Rate: ${rate} points = ${formatCash(1, ccy)}` : `Rate: ${formatCash(1, ccy)} = ${rate} points`}
                </p>
                <p className="mt-1.5 text-xs text-muted">
                  Available points: {formatGigPoints(availablePoints)} · GigCash: {wallet ? formatCash(walletBal, ccy) : "–"}
                </p>
              </div>
              <div>
                <Label htmlFor="gp-points">{toCash ? "Points to convert" : "Points to get"}</Label>
                <Input
                  id="gp-points"
                  type="number"
                  min={1}
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  placeholder="0"
                  className="mt-1.5"
                />
                <p className="mt-1 text-xs text-muted">{amountError ?? "Min/max limits are set by Giggre."}</p>
                {maxPoints > 0 && (
                  <Button type="button" variant="ghost" size="xs" className="mt-1 px-0" onClick={() => setPoints(String(maxPoints))}>
                    Use maximum ({formatGigPoints(maxPoints)})
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-secondary px-3.5 py-3">
                <ArrowLeftRight className="size-4 shrink-0 text-muted" />
                <span className="flex-1 text-xs text-muted">{toCash ? "You receive" : "It costs"}</span>
                <span className="text-sm font-bold text-ink">{cash == null ? "–" : `${formatCash(cash, ccy)} GigCash`}</span>
              </div>
              <div>
                <Label htmlFor="gp-note">Note (optional)</Label>
                <Textarea id="gp-note" value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5" rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={() => setStep("confirm")} disabled={!formReady}>
                Review conversion
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "confirm" && pointsValue != null && cash != null && (
          <>
            <DialogHeader>
              <DialogTitle>Confirm conversion</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5 rounded-xl border border-hairline p-3.5 text-sm">
                <SummaryRow label="Conversion" value={POINTS_REQUEST_TITLE[type]} />
                <SummaryRow label={toCash ? "You give" : "You get"} value={`${formatGigPoints(pointsValue)} points`} />
                <SummaryRow label={toCash ? "You get" : "You pay"} value={`${formatCash(cash, ccy)} GigCash`} />
                <SummaryRow label="Rate" value={`${rate} points per ${formatCash(1, ccy)}`} />
                <SummaryRow
                  label={toCash ? "Points after hold" : "GigCash after"}
                  value={toCash ? formatGigPoints(availablePoints - pointsValue) : formatCash(walletBal - cash, ccy)}
                />
                {note.trim() && <SummaryRow label="Note" value={note.trim()} />}
              </div>
              <p className="rounded-lg bg-amber-500/10 px-3.5 py-3 text-xs text-ink">
                {toCash
                  ? `A Giggre admin reviews every conversion. ${formatGigPoints(pointsValue)} points go on hold now and come back to you if it is rejected or you cancel it.`
                  : `A Giggre admin reviews every conversion. ${formatCash(cash, ccy)} is taken from your Gig Wallet now and refunded if it is rejected or you cancel it.`}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("form")} disabled={submitting}>
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Sending…" : "Send request"}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "done" && (
          <>
            <DialogHeader>
              <DialogTitle>Request sent</DialogTitle>
              <DialogDescription>
                Your {POINTS_REQUEST_NOUN[type]} is waiting for review. We&apos;ll notify you when it&apos;s approved or
                rejected. You can cancel it from the Requests tab until then.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={onClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="text-right font-semibold text-ink">{value}</span>
    </div>
  );
}

// ---------- Main page ----------

type ActivityFilter = "all" | "earned" | "conversions";
const ACTIVITY_FILTERS: { key: ActivityFilter; label: string; types?: GigPointsTxType[] }[] = [
  { key: "all", label: "All" },
  { key: "earned", label: "Earned", types: ["earn", "adjustment"] },
  { key: "conversions", label: "Conversions", types: ["convert_to_cash", "convert_to_points"] },
];
const TX_PAGE_SIZE = 20;

export default function GigPointsPage() {
  const uid = useAppSelector((root) => root.user.authUser?.uid);

  const [balance, setBalance] = useState<GigPointsBalance | null>(null);
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [config, setConfig] = useState<GigPointsConfig | null>(null);
  const [limits, setLimits] = useState<PointsRequestLimits | null>(null);
  const [requests, setRequests] = useState<GigPointsRequest[]>([]);
  const [showInfo, setShowInfo] = useState(false);
  const [requestDialogType, setRequestDialogType] = useState<PointsRequestType | null>(null);
  const [blockedDialog, setBlockedDialog] = useState<string | null>(null);

  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [txLimit, setTxLimit] = useState(TX_PAGE_SIZE);
  const [transactions, setTransactions] = useState<GigPointsTransaction[]>([]);
  const [txHasMore, setTxHasMore] = useState(false);
  const [txLoaded, setTxLoaded] = useState(false);
  const [selectedTx, setSelectedTx] = useState<GigPointsTransaction | null>(null);

  const [cancelTarget, setCancelTarget] = useState<GigPointsRequest | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!uid) return;
    return subscribeGigPointsBalance(uid, setBalance, (err) => console.error("Failed to load Gig Points balance:", err));
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return subscribeWalletBalance(uid, setWallet, (err) => console.error("Failed to load Gig Wallet balance:", err));
  }, [uid]);

  useEffect(() => {
    fetchGigPointsConfig().then(setConfig).catch(() => {});
    fetchGigPointsRequestLimits().then(setLimits).catch(() => {});
  }, []);

  useEffect(() => {
    if (!uid) return;
    return subscribeGigPointsRequests(uid, setRequests, (err) => console.error("Failed to load Gig Points requests:", err));
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    // Resetting for a new filter/limit, not reacting to its own value.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTxLoaded(false);
    const types = ACTIVITY_FILTERS.find((f) => f.key === activityFilter)?.types;
    return subscribeGigPointsTransactions(
      uid,
      { limit: txLimit, types },
      (result) => {
        setTransactions(result.transactions);
        setTxHasMore(result.hasMore);
        setTxLoaded(true);
      },
      (err) => {
        console.error("Failed to load Gig Points activity:", err);
        setTxLoaded(true);
      }
    );
  }, [uid, activityFilter, txLimit]);

  const pendingRequest = useMemo(() => requests.find((r) => r.status === "pending") ?? null, [requests]);
  const myRequests = useMemo(() => requests.filter((r) => !r.byAdmin), [requests]);
  const waitingRequests = myRequests.filter((r) => r.status === "pending");
  const completedRequests = myRequests.filter((r) => r.status !== "pending");

  const groupedTransactions = useMemo(() => {
    const groups: { label: string; items: GigPointsTransaction[] }[] = [];
    for (const tx of transactions) {
      const label = dayLabel(tx.createdAt);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(tx);
      else groups.push({ label, items: [tx] });
    }
    return groups;
  }, [transactions]);

  function handleActionClick(type: PointsRequestType) {
    if (pendingRequest) {
      const noun = pendingRequest.type ? POINTS_REQUEST_NOUN[pendingRequest.type] : "request";
      setBlockedDialog(
        `Your ${noun} of ${pendingRequest.points} points is waiting for a Giggre admin. You can make a new request once it is approved or rejected, or cancel it from the Requests tab.`
      );
      return;
    }
    if (!limits || !isRequestTypeOpen(limits, type)) {
      toast.error(`${POINTS_REQUEST_TITLE[type]} isn't available right now.`);
      return;
    }
    const empty = type === "toCash" ? !balance || balance.balance <= 0 : !wallet || wallet.balance <= 0;
    if (empty) {
      toast.error(
        type === "toCash" ? "You need available points to convert to GigCash." : "You need GigCash in your Gig Wallet to convert to points."
      );
      return;
    }
    setRequestDialogType(type);
  }

  async function handleCancelRequest() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancelGigPointsRequest(cancelTarget.id);
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
      <TitlePage title="Gig Points" description="Earn points and convert them to GigCash, or buy more with GigCash" />

      <div className="mx-auto mt-6 max-w-5xl space-y-5">
        <div className="grid items-stretch gap-5 lg:grid-cols-[1fr_440px]">
          <div className="flex h-full flex-col gap-5">
            <Card className="relative flex-1 gap-3 overflow-hidden border-none bg-gradient-to-br from-amber-400 to-amber-600 p-6 text-white">
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
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-amber-600">
                    <Star className="size-3.5 fill-amber-600" />
                  </span>
                  <p className="text-sm font-medium text-white/90">Available balance</p>
                </div>
                <button
                  type="button"
                  aria-label="How Gig Points work"
                  onClick={() => setShowInfo(true)}
                  className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/40 text-white/90 hover:bg-white/10"
                >
                  <Info className="size-3.5" />
                </button>
              </div>

              <p className="relative flex items-baseline gap-1.5">
                <span className="text-4xl font-bold">{balance ? formatGigPoints(balance.balance) : "—"}</span>
                <span className="text-base font-medium text-white/80">pts</span>
              </p>

              <p className="relative min-h-4 text-xs text-white/80">
                {[
                  !!balance?.heldPoints && `${formatGigPoints(balance.heldPoints)} pts on hold`,
                  !!balance?.pendingPoints && `${formatGigPoints(balance.pendingPoints)} pts processing`,
                  wallet && `${formatCash(wallet.balance, wallet.currencyCode)} GigCash`,
                  pendingRequest && `Conversion of ${pendingRequest.points} pts in review`,
                  balance?.fromCache && "Offline — showing last synced balance",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>

              <div className="relative mt-1 grid grid-cols-2 gap-2">
                {(["toCash", "toPoints"] as const).map((type) => {
                  const Icon = REQUEST_TYPE_ICON[type];
                  const open = !!limits && isRequestTypeOpen(limits, type) && !pendingRequest;
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
                      {POINTS_REQUEST_LABEL[type]}
                    </button>
                  );
                })}
              </div>
            </Card>

            {config && !config.enabled && (
              <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50">
                Gig Points rewards are paused right now. Points you already have are safe.
              </Card>
            )}
          </div>

          <StatsColumn balance={balance} />
        </div>

        <CurrentGigRewardCard uid={uid} config={config} />

        <Tabs defaultValue="activity">
          <TabsList variant="line" className="h-auto w-full justify-start gap-5 border-b border-hairline pb-0">
            <TabsTrigger value="activity" className="gap-1.5 rounded-none border-0 px-0.5 pb-2.5 text-sm data-active:font-semibold data-active:after:bg-amber-500">
              Activity
            </TabsTrigger>
            <TabsTrigger value="requests" className="gap-1.5 rounded-none border-0 px-0.5 pb-2.5 text-sm data-active:font-semibold data-active:after:bg-amber-500">
              Requests
              {waitingRequests.length > 0 && (
                <Badge className="bg-amber-500 text-white">{waitingRequests.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="earn" className="gap-1.5 rounded-none border-0 px-0.5 pb-2.5 text-sm data-active:font-semibold data-active:after:bg-amber-500">
              How to earn
            </TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {ACTIVITY_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => {
                    setActivityFilter(f.key);
                    setTxLimit(TX_PAGE_SIZE);
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    activityFilter === f.key ? "border-amber-500 bg-amber-500 text-white" : "border-hairline text-muted hover:bg-accent"
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
            ) : transactions.length === 0 ? (
              <Card className="flex flex-col items-center gap-2 p-10 text-center">
                <Star className="size-8 text-muted" />
                <p className="text-sm font-medium text-ink">No activity yet</p>
                <p className="text-xs text-muted">
                  {activityFilter === "all"
                    ? "Finish a gig as a worker to earn points — they show here as processing once the host approves, and are credited when payment is confirmed."
                    : `No ${ACTIVITY_FILTERS.find((f) => f.key === activityFilter)?.label.toLowerCase()} yet.`}
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
                              <p className="truncate text-sm font-medium text-ink">{transactionTitle(tx)}</p>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {tx.type === "earn" && <Badge className={gigTypeBadgeClass(tx.gigType)}>{capitalize(tx.gigType)}</Badge>}
                                <TxStatusPill tx={tx} />
                              </div>
                              {isMovementTx(tx) && tx.note && <p className="truncate text-xs text-muted italic">{tx.note}</p>}
                            </div>
                            <span className={cn("shrink-0 text-sm font-semibold", tx.points < 0 ? "text-destructive" : "text-(--success-text)")}>
                              {tx.points >= 0 ? "+" : ""}
                              {tx.points} pts
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
          </TabsContent>

          <TabsContent value="requests" className="mt-4 space-y-4">
            {myRequests.length === 0 ? (
              <Card className="flex flex-col items-center gap-2 p-10 text-center">
                <Wallet className="size-8 text-muted" />
                <p className="text-sm font-medium text-ink">No conversions yet</p>
                <p className="text-xs text-muted">
                  Use To GigCash or To Points above — a Giggre admin reviews each one before it goes through.
                </p>
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

          <TabsContent value="earn" className="mt-4 space-y-4">
            <Card className="p-5">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-(--worker-text)" />
                <p className="font-medium text-ink">Points per finished gig</p>
              </div>
              <div className="mt-3 space-y-1.5">
                {(["quick", "open", "offered"] as const).map((key) => {
                  const Icon = GIG_TYPE_ICON[key];
                  return (
                    <div key={key} className="flex items-center justify-between gap-2 rounded-lg border border-hairline px-3 py-2">
                      <Badge className={gigTypeBadgeClass(key)}>
                        <Icon className="size-3" />
                        {key === "open" ? "Posted" : capitalize(key)} Gig
                      </Badge>
                      <span className="text-sm font-semibold text-ink">
                        {config?.pointsByGigType[key] != null ? `${config.pointsByGigType[key]} pts` : "Not set"}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-muted">
                {config?.maxPointsPerGig != null
                  ? `Max ${config.maxPointsPerGig} pts per gig. `
                  : ""}
                Some gigs carry their own reward, shown on the gig.
              </p>
            </Card>

            <Card className="p-5">
              <p className="font-medium text-ink">How it works</p>
              <div className="mt-3 space-y-3">
                {[
                  { title: "Finish the gig", body: "Complete the work as a worker." },
                  { title: "Host approves", body: "The reward is locked in and shows as processing." },
                  { title: "Points credited", body: "Once payment is confirmed they join your available balance." },
                ].map((step, i) => (
                  <div key={step.title} className="flex gap-3">
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-ink">
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-ink">{step.title}</p>
                      <p className="text-xs text-muted">{step.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <p className="font-medium text-ink">What the labels mean</p>
              <div className="mt-3 space-y-2">
                {(Object.keys(REWARD_STAGE_INFO) as RewardStage[]).map((stage) => (
                  <div key={stage} className="flex items-start gap-2">
                    <StagePill stage={stage} />
                    <p className="text-xs text-muted">{REWARD_STAGE_INFO[stage].explanation}</p>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <InfoDialog open={showInfo} onOpenChange={setShowInfo} />

      {requestDialogType && limits && (
        <PointsRequestDialog
          type={requestDialogType}
          typeLimits={limits.byType[requestDialogType]}
          availablePoints={balance?.balance ?? 0}
          wallet={wallet}
          onClose={() => setRequestDialogType(null)}
        />
      )}

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
            <AlertDialogTitle>
              Cancel this {cancelTarget?.type ? POINTS_REQUEST_NOUN[cancelTarget.type] : "request"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget?.type === "toPoints"
                ? `${cancelTarget ? formatCash(cancelTarget.cash, cancelTarget.currencyCode) : ""} is refunded to your Gig Wallet.`
                : `The ${cancelTarget?.points ?? 0} held points go back to your balance.`}
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
                <DialogTitle>{transactionTitle(selectedTx)}</DialogTitle>
                <DialogDescription>Gig Points transaction details</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                {selectedTx.type === "earn" && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted">Gig</span>
                    <span className="truncate text-ink">{selectedTx.gigTitle || "Untitled gig"}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted">Status</span>
                  <TxStatusPill tx={selectedTx} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted">Points</span>
                  <span className="font-semibold text-ink">
                    {selectedTx.points >= 0 ? "+" : ""}
                    {selectedTx.points} pts
                  </span>
                </div>
                {isConversionTx(selectedTx) && selectedTx.cash != null && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted">GigCash</span>
                    <span className="text-ink">{formatCash(selectedTx.cash, selectedTx.currencyCode)}</span>
                  </div>
                )}
                {selectedTx.counterpartyName && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted">{selectedTx.type === "transfer_out" ? "To" : "From"}</span>
                    <span className="text-ink">{selectedTx.counterpartyName}</span>
                  </div>
                )}
                {selectedTx.approvedAt && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted">Approved</span>
                    <span className="text-ink">{formatDateTime(selectedTx.approvedAt)}</span>
                  </div>
                )}
                {selectedTx.creditedAt && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted">
                      <CircleCheck className="mr-1 inline size-3.5 text-(--success-text)" />
                      Credited
                    </span>
                    <span className="text-ink">{formatDateTime(selectedTx.creditedAt)}</span>
                  </div>
                )}
                {selectedTx.voidedAt && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted">Voided</span>
                    <span className="text-ink">{formatDateTime(selectedTx.voidedAt)}</span>
                  </div>
                )}
                {selectedTx.reference && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted">Reference</span>
                    <span className="text-ink">{selectedTx.reference}</span>
                  </div>
                )}
                {(selectedTx.voidReason || selectedTx.description || selectedTx.note || selectedTx.reason) && (
                  <p className="pt-1 text-xs text-muted">
                    {selectedTx.voidReason || selectedTx.description || selectedTx.note || selectedTx.reason}
                  </p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </JoshDiv>
  );
}

function RequestRow({ request, onCancel }: { request: GigPointsRequest; onCancel?: () => void }) {
  const Icon = request.type ? REQUEST_TYPE_ICON[request.type] : Wallet;
  const title = request.type ? POINTS_REQUEST_TITLE[request.type] : "Points request";
  const positive = request.type === "toPoints";
  const voided = request.status === "rejected" || request.status === "cancelled";
  return (
    <Card className="flex-row items-center gap-3 p-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-(--worker-tint) text-(--worker-text)">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium text-ink">{title}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge className={REQUEST_STATUS_BADGE[request.status]}>{REQUEST_STATUS_LABEL[request.status]}</Badge>
          {request.type && (
            <span className="text-xs text-muted">
              {request.type === "toCash" ? "Get" : "Pay"} {formatCash(request.cash, request.currencyCode)} GigCash
            </span>
          )}
        </div>
        {request.decisionNote && <p className="text-xs text-destructive">Reason: {request.decisionNote}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span
          className={cn(
            "text-sm font-semibold",
            voided ? "text-muted line-through" : positive ? "text-(--success-text)" : "text-destructive"
          )}
        >
          {positive ? "+" : "−"}
          {request.points} pts
        </span>
        {onCancel && (
          <Button size="xs" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </Card>
  );
}
