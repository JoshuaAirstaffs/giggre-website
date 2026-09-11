"use client";

import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ViewPaymentCodeDialogProps {
  workerName: string | null;
  paymentCode: string | null;
  onOpenChange: (open: boolean) => void;
}

function formatCode(code: string) {
  return `${code.slice(0, 3)}  ${code.slice(3)}`;
}

// Read-only re-display of an already-generated payment code — used by the
// "Show Payment Code" button (for a worker whose status is already
// 'payment') so re-opening it can never show the method-picker/confirm
// steps from CashPaymentDialog, only the QR + digits.
export default function ViewPaymentCodeDialog({ workerName, paymentCode, onOpenChange }: ViewPaymentCodeDialogProps) {
  const open = paymentCode !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onOpenChange(false);
      }}
    >
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Show This to {workerName}</DialogTitle>
          <DialogDescription>They&apos;ll scan or enter this code in their app to confirm they were paid.</DialogDescription>
        </DialogHeader>
        {paymentCode && (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="rounded-lg border border-hairline bg-white p-3">
              <QRCodeSVG value={paymentCode} size={160} />
            </div>
            <p className="font-mono text-2xl font-semibold tracking-widest text-ink">{formatCode(paymentCode)}</p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
