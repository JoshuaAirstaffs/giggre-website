"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BadgeCheck,
  CircleCheck,
  CircleX,
  Clock,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import TitlePage from "@/components/TitlePage";
import JoshDiv from "@/components/DivAnimation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAppSelector } from "@/store/hooks";
import {
  canSubmitVerification,
  cancelVerificationRequest,
  fetchUserDocuments,
  submitVerificationRequest,
  type VerificationStatus,
} from "@/lib/documents";

// Mirrors giggre_app/lib/features/gig_worker/presentation/verification_screen.dart
// — a status dashboard + static explainer + submit/cancel action, distinct
// from MyDocumentsScreen (the upload UI, ported as DocumentsPage.tsx here).
// Reused for both roles: isVerified is one account-wide flag, and
// canSubmitVerification requires a worker-category AND a host-category
// document regardless of which role is currently viewing this page.

const STATUS_COPY: Record<VerificationStatus, { title: string; subtitle: string }> = {
  unverified: { title: "Not Verified", subtitle: "Verify your identity to build trust on every gig." },
  pending: { title: "Pending Request", subtitle: "Your verification request is being processed." },
  verified: { title: "Verified", subtitle: "Your identity has been verified." },
  rejected: { title: "Rejected", subtitle: "Your verification request was rejected. Please resubmit." },
};

const PERKS = [
  { icon: BadgeCheck, title: "Verified Badge", description: "A badge visible to everyone on your profile and gig listings." },
  { icon: TrendingUp, title: "Higher Visibility", description: "Verified accounts appear higher in search results." },
  { icon: Users, title: "More Interested Gigs", description: "People are more likely to work with verified accounts." },
  { icon: ShieldCheck, title: "Trust & Safety", description: "Show others that your account is legitimate and trustworthy." },
];

const PROCESS_STEPS = [
  { title: "Upload Documents", description: "Add at least one Gig Worker and one Gig Host document in My Documents." },
  { title: "Submit Request", description: "Tap the button below to send your verification request." },
  { title: "Manual Review", description: "Our team reviews your profile and account activity within 24–48 hours." },
  { title: "Get Verified", description: "You'll receive a notification once your account is approved." },
];

function StatusBanner({ status }: { status: VerificationStatus }) {
  const copy = STATUS_COPY[status];
  if (status === "verified") {
    return (
      <Alert className="my-6 max-w-2xl border-(--success-tint) bg-(--success-tint) text-(--success-text)">
        <CircleCheck />
        <AlertTitle>{copy.title}</AlertTitle>
        <AlertDescription className="py-1">{copy.subtitle}</AlertDescription>
      </Alert>
    );
  }
  if (status === "pending") {
    return (
      <Alert className="my-6 max-w-2xl border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50">
        <Clock />
        <AlertTitle>{copy.title}</AlertTitle>
        <AlertDescription className="py-1">{copy.subtitle}</AlertDescription>
      </Alert>
    );
  }
  if (status === "rejected") {
    return (
      <Alert className="my-6 max-w-2xl border-(--danger-tint) bg-(--danger-tint) text-(--danger-text)">
        <CircleX />
        <AlertTitle>{copy.title}</AlertTitle>
        <AlertDescription className="py-1">{copy.subtitle}</AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert className="my-6 max-w-2xl border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-50">
      <ShieldAlert />
      <AlertTitle>{copy.title}</AlertTitle>
      <AlertDescription className="py-1">{copy.subtitle}</AlertDescription>
    </Alert>
  );
}

export default function VerificationPage({ role }: { role: "host" | "worker" }) {
  const router = useRouter();
  const { authUser, profile } = useAppSelector((root) => root.user);
  const uid = authUser?.uid;
  const status: VerificationStatus = (profile?.isVerified as VerificationStatus) ?? "unverified";

  const [canSubmit, setCanSubmit] = useState(false);
  const [checkingDocs, setCheckingDocs] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showCantSubmit, setShowCantSubmit] = useState(false);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      setCheckingDocs(true);
      try {
        const documents = await fetchUserDocuments(uid);
        if (!cancelled) setCanSubmit(canSubmitVerification(documents));
      } catch (err) {
        console.error("Failed to check uploaded documents:", err);
      } finally {
        if (!cancelled) setCheckingDocs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  async function handleSubmit() {
    if (!uid) return;
    if (!canSubmit) {
      setShowCantSubmit(true);
      return;
    }
    setSubmitting(true);
    try {
      await submitVerificationRequest(uid, {
        name: profile?.name,
        email: profile?.email,
        phone: profile?.phone,
        photoUrl: profile?.photoUrl,
      });
      toast.success("Verification request submitted!");
    } catch (err) {
      console.error("Failed to submit verification request:", err);
      toast.error("Failed to submit request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!uid) return;
    setSubmitting(true);
    try {
      await cancelVerificationRequest(uid);
      toast.success("Verification request cancelled.");
    } catch (err) {
      console.error("Failed to cancel verification request:", err);
      toast.error("Failed to cancel request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <JoshDiv>
      <TitlePage title="Verify your account" description="Build trust with the other side of every gig" />

      <StatusBanner status={status} />

      <div className="max-w-2xl space-y-8">
        <div>
          <p className="mb-3 text-sm font-medium text-muted">Why Get Verified</p>
          <div className="space-y-2">
            {PERKS.map((perk) => (
              <Card key={perk.title} className="flex-row items-center gap-3 p-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <perk.icon className="size-4.5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{perk.title}</p>
                  <p className="text-xs text-muted">{perk.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-3 text-sm font-medium text-muted">Verification Process</p>
          <div>
            {PROCESS_STEPS.map((step, i) => (
              <div key={step.title} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-ink">
                    {i + 1}
                  </div>
                  {i < PROCESS_STEPS.length - 1 && <div className="w-0.5 flex-1 bg-hairline" />}
                </div>
                <div className="min-w-0 flex-1 pb-4">
                  <p className="text-sm font-medium text-ink">{step.title}</p>
                  <p className="text-xs text-muted">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {status !== "verified" && (
          <div>
            {status === "pending" ? (
              <Button variant="outline" disabled={submitting} onClick={handleCancel} className="w-full sm:w-auto">
                {submitting ? "Cancelling…" : "Cancel Verification Request"}
              </Button>
            ) : (
              <Button disabled={submitting || checkingDocs} onClick={handleSubmit} className="w-full sm:w-auto">
                {submitting
                  ? "Submitting…"
                  : status === "rejected"
                    ? "Resubmit Verification Request"
                    : "Submit Verification Request"}
              </Button>
            )}
            <p className="mt-2 text-xs text-muted">Review typically takes 24–48 hours</p>
          </div>
        )}
      </div>

      <AlertDialog open={showCantSubmit} onOpenChange={setShowCantSubmit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unable to Submit</AlertDialogTitle>
            <AlertDialogDescription>
              Upload at least 1 document for each role (Gig Worker &amp; Gig Host) in My Documents to continue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction render={<Button />}>Not now</AlertDialogAction>
            <Button onClick={() => router.push(`/app/${role}/documents`)}>Go to My Documents</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </JoshDiv>
  );
}
