"use client";

import { useState } from "react";
import { toast } from "sonner";
import { XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cancelGig, type HostGigDetail } from "@/lib/host-gigs";

interface CancelGigDialogProps {
  gig: HostGigDetail | null;
  onOpenChange: (open: boolean) => void;
  onCancelled: () => void;
}

// Mirrors _CancelReasonDialog in gig_detail_sheet.dart — an Open gig with no
// worker assigned yet cancels immediately on submit; everything else (an
// Offered gig at any point, or an Open gig once someone's assigned) instead
// submits a request pending admin review. Same copy/behavior, just one
// dialog instead of the app's per-screen duplicates.
export default function CancelGigDialog({ gig, onOpenChange, onCancelled }: CancelGigDialogProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const open = gig !== null;
  const immediate = gig?.gigType === "open" && gig.workers.length === 0;

  function close(next: boolean) {
    if (!next && !submitting) {
      onOpenChange(false);
      setReason("");
    }
  }

  async function handleSubmit() {
    if (!gig || !reason.trim()) return;
    setSubmitting(true);
    try {
      const result = await cancelGig(gig, reason.trim());
      if (result.ok) {
        toast.success(immediate ? "Gig cancelled." : "Cancellation request submitted. Pending admin review.");
        onOpenChange(false);
        setReason("");
        onCancelled();
      } else {
        toast.error(result.reason);
      }
    } catch (err) {
      console.error("Failed to cancel gig:", err);
      toast.error("Couldn't cancel this gig. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex size-10 items-center justify-center rounded-full bg-(--danger-tint)">
            <XCircle className="size-5 text-(--danger-text)" />
          </div>
          <DialogTitle>{immediate ? "Cancel Gig" : "Request Cancellation"}</DialogTitle>
          <DialogDescription>
            {immediate
              ? "No worker has been assigned yet, so this gig will be cancelled right away. Please tell us why."
              : "Your request will be reviewed by an admin before the gig is cancelled."}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Describe your reason for cancelling..."
          rows={3}
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" disabled={submitting} onClick={() => close(false)}>
            Go Back
          </Button>
          <Button variant="destructive" disabled={submitting || !reason.trim()} onClick={handleSubmit}>
            {submitting ? "Submitting…" : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
