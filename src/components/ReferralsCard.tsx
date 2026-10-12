"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Copy } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppSelector } from "@/store/hooks";
import { referralLevelLabel } from "@/lib/registration";

// Mirrors giggre_app/lib/screens/referrals/my_referral_screen.dart's "Referral
// Code" tab — code is generated once at signup (register_screen.dart /
// welcome_screen.dart) and only ever copied, not shared via a deep link.
// The milestone nickname (referralLevelLabel) matches that screen's
// `referralMap` exactly; the full progress-bar/roadmap views are a separate,
// larger feature left out here. Referrals aren't role-specific (one code per
// account), so this is shared between the host and worker profile pages —
// `role` only picks which brand color it's tinted with. Links to the fuller
// /app/{role}/referrals page (referral history list + milestone roadmap,
// see ReferralsPage.tsx) for the parts that don't fit in a summary card.
export default function ReferralsCard({ role }: { role: "host" | "worker" }) {
  const referrals = useAppSelector((root) => root.user.profile?.referrals);
  const [copied, setCopied] = useState(false);

  const code = referrals?.referral_code;
  const level = referrals?.referral_level ?? 0;
  const totalReferred = referrals?.referrals_count ?? 0;
  const verified = referrals?.verified_referrals ?? 0;
  const milestoneLabel = referralLevelLabel(level);

  const tintClass = role === "host" ? "bg-host-tint" : "bg-worker-tint";
  const textClass = role === "host" ? "text-(--host-text)" : "text-(--worker-text)";

  async function handleCopy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Referral code copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy referral code:", err);
      toast.error("Couldn't copy code. Please try again.");
    }
  }

  return (
    <div>
      <p className="text-sm font-medium text-muted">Referrals</p>
      <div className="mt-2 space-y-4">
        {!code ? (
          <p className="text-sm text-muted">
            No referral code on this account yet. New accounts get one automatically at sign-up.
          </p>
        ) : (
          <>
            <div>
              <div className={`flex items-center justify-between gap-3 rounded-lg border border-dashed border-hairline ${tintClass} px-3 py-2`}>
                <span className={`font-mono text-sm font-semibold tracking-widest ${textClass}`}>{code}</span>
                <Button variant="ghost" size="icon-sm" onClick={handleCopy} aria-label="Copy referral code">
                  {copied ? <Check className="size-4 text-(--success-start)" /> : <Copy className="size-4" />}
                </Button>
              </div>
              <p className="mt-1.5 text-xs text-muted">Share this code with friends to earn referral rewards.</p>
            </div>

            {milestoneLabel && (
              <div className="flex justify-center">
                <Badge variant="secondary" className={`${tintClass} ${textClass}`}>
                  {milestoneLabel}
                </Badge>
              </div>
            )}

            <div className="grid grid-cols-3 divide-x divide-hairline text-center">
              <div>
                <p className="text-lg font-bold text-ink">{level}</p>
                <p className="text-xs text-muted">Level</p>
              </div>
              <div>
                <p className="text-lg font-bold text-ink">{totalReferred}</p>
                <p className="text-xs text-muted">Referred</p>
              </div>
              <div>
                <p className="text-lg font-bold text-(--success-text)">{verified}</p>
                <p className="text-xs text-muted">Verified</p>
              </div>
            </div>

            <Link
              href={`/app/${role}/referrals`}
              className={`flex items-center justify-center gap-1 text-sm font-medium ${textClass} hover:underline`}
            >
              View all referrals
              <ChevronRight className="size-3.5" />
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
