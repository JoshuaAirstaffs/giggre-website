"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Banknote, Star } from "lucide-react";
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
import { salary } from "@/lib/gig-format";
import { confirmCashPayment, rateWorker, type HostGigDetail, type HostGigWorkerEntry } from "@/lib/host-gigs";

// Mirrors the host's payment flow in the Flutter app: PaymentSelectionSheet
// (cash-only today) -> its "Confirm Cash Payment" AlertDialog -> the code it
// hands off to HostPaymentCodeSheet -> once the worker confirms (mobile-only
// for now), _RatingDialog. This dialog covers the whole chain except the
// worker-side "enter code" step (worker_payment_confirm_sheet.dart), which
// still only exists on mobile.
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
  const [step, setStep] = useState<Step>("method");
  const [confirming, setConfirming] = useState(false);
  const [paymentCode, setPaymentCode] = useState<string | null>(null);
  const [selectedStars, setSelectedStars] = useState(0);
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
    setSelectedStars(0);
  }, [gig?.id, worker?.workerId, open]);

  // The worker confirming receipt (mobile-only for now) flips their status
  // past 'payment' — move straight to rating them once that happens while
  // the code screen is still showing, instead of leaving a stale code on
  // screen (mirrors the app going QR sheet -> celebration -> _RatingDialog).
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

  async function handleSubmitRating() {
    if (!gig || !worker || selectedStars === 0) return;
    setSubmittingRating(true);
    try {
      const result = await rateWorker(gig, worker, selectedStars);
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

  async function handleConfirmCash() {
    if (!gig || !worker) return;
    setConfirming(true);
    try {
      const result = await confirmCashPayment(gig, worker);
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

  const amount = gig ? salary(gig.currencyCode, gig.ratePerSlot) : "";

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
          <div className="rounded-lg bg-secondary px-3 py-2 text-center text-lg font-semibold text-ink">
            {amount}
          </div>
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
