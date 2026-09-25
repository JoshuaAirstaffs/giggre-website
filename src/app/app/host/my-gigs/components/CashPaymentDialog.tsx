"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Banknote, Check, Pencil, Star, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { salary } from "@/lib/gig-format";
import {
  confirmCashPayment,
  payableAmountForWorker,
  rateWorker,
  type HostGigDetail,
  type HostGigWorkerEntry,
} from "@/lib/host-gigs";
import { RATING_COMMENT_MAX_LENGTH, WORKER_RATING_TAGS } from "@/lib/ratings";
import { useAppSelector } from "@/store/hooks";

// Mirrors the host's payment flow in the Flutter app: PaymentSelectionSheet
// (cash-only today, with its manual amount-override editor) -> its "Confirm
// Cash Payment" AlertDialog -> the code it hands off to HostPaymentCodeSheet
// -> once the worker confirms (mobile-only for now), the shared
// RatingDialog (rating_dialog.dart). This dialog covers the whole chain
// except the worker-side "enter code" step (worker_payment_confirm_sheet.dart),
// which still only exists on mobile.
type Step = "method" | "confirm" | "code" | "rating";

const STAR_LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

interface CashPaymentDialogProps {
  gig: HostGigDetail | null;
  worker: HostGigWorkerEntry | null;
  onOpenChange: (open: boolean) => void;
}

function formatCode(code: string) {
  return `${code.slice(0, 3)}  ${code.slice(3)}`;
}

export default function CashPaymentDialog({ gig, worker, onOpenChange }: CashPaymentDialogProps) {
  const authUid = useAppSelector((root) => root.user.authUser?.uid);
  const myName = useAppSelector((root) => root.user.profile?.name) || "Host";

  const [step, setStep] = useState<Step>("method");
  const [confirming, setConfirming] = useState(false);
  const [paymentCode, setPaymentCode] = useState<string | null>(null);

  // Manual amount override — mirrors PaymentSelectionSheet's edit-pencil
  // flow exactly. `overrideAmount` is only committed once the host taps the
  // inline editor's checkmark; `amountDraft`/`adjustmentReason` are the
  // in-progress form values.
  const [editingAmount, setEditingAmount] = useState(false);
  const [overrideAmount, setOverrideAmount] = useState<number | null>(null);
  const [amountDraft, setAmountDraft] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");

  const [selectedStars, setSelectedStars] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const open = gig !== null && worker !== null;

  useEffect(() => {
    if (!open) return;
    // Resetting to the first step whenever a new target opens, not reacting
    // to it. Re-viewing an already-generated code is handled by the separate
    // ViewPaymentCodeDialog instead, so this always starts a fresh flow.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStep("method");
    setPaymentCode(null);
    setEditingAmount(false);
    setOverrideAmount(null);
    setAmountDraft("");
    setAdjustmentReason("");
    setSelectedStars(0);
    setSelectedTags([]);
    setComment("");
  }, [gig?.id, worker?.workerId, open]);

  // The worker confirming receipt (mobile-only for now) flips their status
  // past 'payment' — move straight to rating them once that happens while
  // the code screen is still showing, instead of leaving a stale code on
  // screen (mirrors the app going QR sheet -> celebration -> RatingDialog).
  useEffect(() => {
    if (step !== "code" || !worker || !gig) return;
    const latest = gig.workers.find((w) => w.workerId === worker.workerId);
    if (latest && latest.status !== "payment") {
      toast.success(`${worker.workerName} confirmed the payment.`);
      // Reacting to an external Firestore change (the worker confirming on
      // their own device), not to local state — same justification as the
      // reset-on-new-target effect above.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep("rating");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gig, step]);

  function toggleTag(tag: string) {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function handleSubmitRating() {
    if (!gig || !worker || !authUid || selectedStars === 0) return;
    setSubmittingRating(true);
    try {
      const result = await rateWorker(gig, worker, authUid, myName, selectedStars, selectedTags, comment);
      if (result.ok) {
        toast.success(`Rating submitted for ${worker.workerName}.`);
        onOpenChange(false);
      } else {
        toast.error(result.reason);
      }
    } catch (err) {
      console.error("Failed to submit rating:", err);
      toast.error("Couldn't submit this rating. Please try again.");
    } finally {
      setSubmittingRating(false);
    }
  }

  function handleStartEditAmount() {
    if (!gig || !worker) return;
    setAmountDraft(String(overrideAmount ?? payableAmountForWorker(gig, worker)));
    setEditingAmount(true);
  }

  function handleSaveAmount() {
    const parsed = Number(amountDraft);
    if (!amountDraft.trim() || Number.isNaN(parsed) || parsed < 0) {
      toast.error("Enter a valid amount (0 or more).");
      return;
    }
    setOverrideAmount(parsed);
    setEditingAmount(false);
  }

  async function handleConfirmCash() {
    if (!gig || !worker) return;
    setConfirming(true);
    try {
      const result = await confirmCashPayment(
        gig,
        worker,
        overrideAmount ?? undefined,
        adjustmentReason.trim() || undefined
      );
      if (result.ok) {
        setPaymentCode(result.paymentCode);
        setStep("code");
      } else {
        toast.error(result.reason);
        setStep("method");
      }
    } catch (err) {
      console.error("Failed to confirm cash payment:", err);
      toast.error("Couldn't confirm this payment. Please try again.");
      setStep("method");
    } finally {
      setConfirming(false);
    }
  }

  const effectiveAmount = gig && worker ? (overrideAmount ?? payableAmountForWorker(gig, worker)) : 0;
  const amount = gig ? salary(gig.currencyCode, effectiveAmount) : "";

  return (
    <>
      <Dialog
        open={open && step === "method"}
        onOpenChange={(next) => {
          if (!next) onOpenChange(false);
        }}
      >
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Select Payment Method</DialogTitle>
            <DialogDescription>{gig?.title}</DialogDescription>
          </DialogHeader>

          {editingAmount ? (
            <div className="space-y-2 rounded-lg border border-hairline p-3">
              <div className="space-y-1.5">
                <Label htmlFor="cash-amount-override">Amount</Label>
                <Input
                  id="cash-amount-override"
                  type="number"
                  min={0}
                  step="0.01"
                  value={amountDraft}
                  onChange={(e) => setAmountDraft(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cash-amount-reason">Reason (optional)</Label>
                <Textarea
                  id="cash-amount-reason"
                  rows={2}
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="e.g. worker left the gig early"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="icon-sm" aria-label="Cancel edit" onClick={() => setEditingAmount(false)}>
                  <X className="size-4" />
                </Button>
                <Button size="icon-sm" aria-label="Save amount" onClick={handleSaveAmount}>
                  <Check className="size-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-lg bg-secondary px-3 py-2 text-center text-lg font-semibold text-ink">
              {amount}
              <button
                type="button"
                aria-label="Adjust amount"
                onClick={handleStartEditAmount}
                className="text-muted transition-colors hover:text-ink"
              >
                <Pencil className="size-4" />
              </button>
            </div>
          )}

          <p className="text-xs font-medium tracking-wide text-muted uppercase">Payment options</p>
          <button
            type="button"
            onClick={() => setStep("confirm")}
            className="flex items-center gap-3 rounded-lg border border-hairline px-3 py-3 text-left transition-colors hover:bg-accent"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-(--success-tint) text-(--success-text)">
              <Banknote className="size-4" />
            </span>
            <span>
              <span className="block text-sm font-medium text-ink">Cash</span>
              <span className="block text-xs text-muted">Pay in person</span>
            </span>
          </button>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={open && step === "confirm"}
        onOpenChange={(next) => {
          if (!next && !confirming) setStep("method");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Cash Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Please confirm you have received the cash payment from the gig worker and the gig is complete.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-lg bg-secondary px-3 py-2 text-center text-sm font-medium text-ink">
            {amount} · Cash
          </div>
          <AlertDialogFooter>
            <Button variant="outline" disabled={confirming} onClick={() => setStep("method")}>
              Cancel
            </Button>
            <Button
              disabled={confirming}
              onClick={handleConfirmCash}
              className="bg-(--success-start) text-white hover:bg-(--success-end)"
            >
              {confirming ? "Confirming…" : "Confirm"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={open && step === "code"}
        onOpenChange={(next) => {
          if (!next) onOpenChange(false);
        }}
      >
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Show This to {worker?.workerName}</DialogTitle>
            <DialogDescription>They&apos;ll scan or enter this code in their app to confirm they were paid.</DialogDescription>
          </DialogHeader>
          {paymentCode && (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="rounded-lg border border-hairline bg-white p-3">
                <QRCodeSVG value={paymentCode} size={160} />
              </div>
              <p className="font-mono text-2xl font-semibold tracking-widest text-ink">
                {formatCode(paymentCode)}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={open && step === "rating"}
        onOpenChange={(next) => {
          if (!next && !submittingRating) onOpenChange(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rate Your Worker</AlertDialogTitle>
            <AlertDialogDescription>How was {worker?.workerName}?</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`${value} star${value === 1 ? "" : "s"}`}
                  onClick={() => setSelectedStars(value)}
                  className="p-0.5"
                >
                  <Star
                    className={`size-8 ${
                      value <= selectedStars ? "fill-(--host-start) text-(--host-start)" : "text-muted"
                    }`}
                  />
                </button>
              ))}
            </div>
            <p className="text-sm text-muted">{STAR_LABELS[selectedStars] || "Tap a star to rate"}</p>
          </div>

          {selectedStars > 0 && (
            <div className="w-full space-y-3">
              <div className="flex flex-wrap justify-center gap-1.5">
                {WORKER_RATING_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      selectedTags.includes(tag)
                        ? "border-(--host-start) bg-(--host-tint) text-(--host-text)"
                        : "border-hairline text-muted hover:bg-accent"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rating-comment" className="text-xs text-muted">
                  Optional — shown on their worker profile.
                </Label>
                <Textarea
                  id="rating-comment"
                  rows={2}
                  maxLength={RATING_COMMENT_MAX_LENGTH}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="What was it like working with them?"
                />
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <Button variant="outline" disabled={submittingRating} onClick={() => onOpenChange(false)}>
              Skip
            </Button>
            <Button
              disabled={submittingRating || selectedStars === 0}
              onClick={handleSubmitRating}
              className="bg-(--success-start) text-white hover:bg-(--success-end)"
            >
              {submittingRating ? "Submitting…" : "Submit"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
