"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useAppSelector } from "@/store/hooks";
import { consumeFreshLogin } from "@/lib/verification-prompt";

// Mirrors giggre_app's showAccountNotVerifiedModal, shown once right after a
// fresh login/registration (never on a page reload of an already-open
// session) — see HomeScreen._maybeShowVerifyPrompt /
// CurrentUserProvider.takeVerifyPromptAfterLogin. Same copy and gate for
// both roles: isVerified is one combined field covering both document sets.
export default function VerificationReminderModal({ role }: { role: "host" | "worker" }) {
  const router = useRouter();
  const profile = useAppSelector((root) => root.user.profile);
  const [open, setOpen] = useState(false);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current || profile === null) return;
    checkedRef.current = true;
    if (consumeFreshLogin() && profile.isVerified !== "verified") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot check on first profile load after mount
      setOpen(true);
    }
  }, [profile]);

  function handleVerifyNow() {
    setOpen(false);
    router.push(`/app/${role}/verification`);
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader className="items-center text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
            <TriangleAlert className="size-7" />
          </div>
          <AlertDialogTitle>Account Not Verified</AlertDialogTitle>
          <AlertDialogDescription>
            Get verified so hosts and workers know they can trust you.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:flex-col">
          <Button className="w-full bg-amber-600 text-white hover:bg-amber-700" onClick={handleVerifyNow}>
            Verify Now
          </Button>
          <AlertDialogCancel className="w-full border-none shadow-none">Not Now</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
