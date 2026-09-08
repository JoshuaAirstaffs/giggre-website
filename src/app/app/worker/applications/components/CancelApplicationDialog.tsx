"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requestApplicationCancellation, type AcceptedApplication } from "@/lib/browse-gigs";

// Mirrors _CancelReasonDialog / _showCancelReasonDialog in the app's
// working_ui.dart — same copy, same admin-review framing, same write shape.
// This is a *request*, not an instant cancel: the gig only actually cancels
// once an admin approves it.

interface CancelApplicationDialogProps {
  application: AcceptedApplication | null;
  workerId: string | undefined;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: () => void;
}

export default function CancelApplicationDialog({
  application,
  workerId,
  onOpenChange,
  onSubmitted,
}: CancelApplicationDialogProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!application || !workerId) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      toast.error("Please describe your reason for cancelling.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await requestApplicationCancellation(application, workerId, trimmed);
      if (result.ok) {
        toast.warning("Cancellation request submitted. Pending admin review.");
        setReason("");
        onOpenChange(false);
        onSubmitted?.();
      } else {
        toast.error(result.reason);
      }
    } catch (err) {
      console.error("Failed to submit cancellation request:", err);
      toast.error("Failed to submit cancellation request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={!!application}
      onOpenChange={(open) => {
        if (!open) setReason("");
        onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Request Cancellation</DialogTitle>
          <DialogDescription>
            Your request will be reviewed by an admin before the gig is cancelled. Cancelling after being selected
            may affect your worker rating.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="cancel-reason">Reason</Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe your reason for cancelling..."
            rows={3}
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {submitting ? "Submitting…" : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
