"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Construction, TriangleAlert } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { useAppSelector } from "@/store/hooks";
import { consumeFreshLogin } from "@/lib/verification-prompt";

type Step = "none" | "devNotice" | "verification";

// A short sequence of once-per-fresh-login announcements, shown right after
// sign-in/registration (never on a reload of an already-open session — see
// consumeFreshLogin). The dev notice always comes first since it applies to
// every account; the verification reminder (mirrors giggre_app's
// showAccountNotVerifiedModal) follows only if the account still needs it,
// so the two never show stacked on top of each other.
export default function PostLoginModals({ role }: { role: "host" | "worker" }) {
  const router = useRouter();
  const profile = useAppSelector((root) => root.user.profile);
  const [step, setStep] = useState<Step>("none");
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current || profile === null) return;
    checkedRef.current = true;
    if (consumeFreshLogin()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot check on first profile load after mount
      setStep("devNotice");
    }
  }, [profile]);

  function handleDevNoticeClosed() {
    setStep(profile?.isVerified !== "verified" ? "verification" : "none");
  }

  function handleVerifyNow() {
    setStep("none");
    router.push(`/app/${role}/verification`);
  }

  return (
    <>
      <AlertDialog open={step === "devNotice"} onOpenChange={(open) => !open && handleDevNoticeClosed()}>
        <AlertDialogContent>
          <AlertDialogHeader className="items-center text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-blue-500/10 text-blue-600">
              <Construction className="size-7" />
            </div>
            <AlertDialogTitle>Giggre website is still in development</AlertDialogTitle>
            <AlertDialogDescription>
              You might run into bugs or rough edges while we keep building. If something looks broken, let us know
              on the Help &amp; Support page — it helps us fix it faster.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="w-full">Got it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={step === "verification"} onOpenChange={(open) => !open && setStep("none")}>
        <AlertDialogContent>
          <AlertDialogHeader className="items-center text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
              <TriangleAlert className="size-7" />
            </div>
            <AlertDialogTitle>Account Not Verified</AlertDialogTitle>
            <AlertDialogDescription>Get verified so hosts and workers know they can trust you.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:flex-col">
            <Button className="w-full bg-amber-600 text-white hover:bg-amber-700" onClick={handleVerifyNow}>
              Verify Now
            </Button>
            <AlertDialogCancel className="w-full border-none shadow-none">Not Now</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
