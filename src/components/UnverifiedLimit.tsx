"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { InfoIcon, Lock, ShieldAlert } from "lucide-react";
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppSelector } from "@/store/hooks";
import { fetchFxRates, fromUsd, USD_ONLY, type FxRates } from "@/lib/fx-rates";
import { currencySymbol } from "@/lib/utils";
import {
  checkUnverifiedLimit, RESET_NOTE, subscribeLimitState, usageOf,
  type LimitAction, type LimitBlock, type LimitConfig,
} from "@/lib/unverified-limit";

// Unverified-account earning limit on the website — same behaviour as the
// app: a blocking "Unable to …" prompt before applying for / accepting /
// posting a gig over the limit, and a progress bar in the earnings card.

/**
 * const { guard, dialog } = useUnverifiedLimitGuard();
 * if (!(await guard({ amount, currencyCode, action: "apply" }))) return;
 * … and render {dialog}.
 */
export function useUnverifiedLimitGuard() {
  const uid = useAppSelector((root) => root.user.authUser?.uid);
  const pathname = usePathname();
  const basePath = pathname?.startsWith("/app/host") ? "/app/host" : "/app/worker";
  const [block, setBlock] = useState<LimitBlock | null>(null);

  const guard = useCallback(
    async (input: { amount: number; currencyCode: string; action: LimitAction }) => {
      if (!uid) return true;
      const b = await checkUnverifiedLimit({ uid, ...input });
      if (b) setBlock(b);
      return b == null;
    },
    [uid],
  );

  const dialog = (
    <AlertDialog open={block != null} onOpenChange={(next) => !next && setBlock(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
            <Lock className="size-6" />
          </div>
          <AlertDialogTitle className="text-center">{block?.title}</AlertDialogTitle>
          <AlertDialogDescription className="text-center">{block?.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => setBlock(null)}>Not now</Button>
          <Button
            className="bg-amber-600 text-white hover:bg-amber-700"
            render={<Link href={`${basePath}/verification`} onClick={() => setBlock(null)} />}
            nativeButton={false}
          >
            Verify Now
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { guard, dialog };
}

/**
 * "Earning limit" line + bar for the earnings card (app: Earned so far →
 * Earning limit). Renders nothing for verified users or when the limit is off.
 * Green < 50%, yellow 50–79%, red 80%+.
 */
export function UnverifiedLimitProgress({ currencyCode }: { currencyCode: string }) {
  const uid = useAppSelector((root) => root.user.authUser?.uid);
  const isVerified = useAppSelector((root) => root.user.profile?.isVerified) === "verified";
  const [state, setState] = useState<{ cfg: LimitConfig; totals: Record<string, unknown> | null } | null>(null);
  const [fx, setFx] = useState<FxRates>(USD_ONLY);

  useEffect(() => {
    if (!uid || isVerified) return;
    fetchFxRates().then(setFx).catch(() => {});
    return subscribeLimitState(uid, setState);
  }, [uid, isVerified]);

  if (!uid || isVerified || !state || !state.cfg.enabled || state.cfg.maxUsd == null) return null;
  const max = state.cfg.maxUsd;
  const { usedUsd, hostUsd } = usageOf(state.totals, state.cfg, fx);
  const pct = Math.min(usedUsd / max, 1);
  const reached = usedUsd >= max - 0.005;
  const color = pct >= 0.8 ? "#E5484D" : pct >= 0.5 ? "#F5C518" : "#2BB673";
  const accent = pct >= 0.8 ? color : "#D97706";
  const ccy = currencyCode === "PHP" && fx.perUsdRates.PHP ? "PHP" : currencyCode === "PHP" ? "USD" : currencyCode;
  const fmt = (usd: number) => {
    const v = fromUsd(fx, usd, ccy) ?? usd;
    return `${currencySymbol(ccy)}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  const note = RESET_NOTE[state.cfg.resetPeriod] || "It counts everything until you verify.";
  const tip =
    `Accounts that aren't verified yet can only earn up to ${fmt(max)} from gigs. Gigs you post as a host count toward it too. ${note} ` +
    "Once you reach it, you can't apply for or accept new gigs. Verify your account to remove the limit.";

  return (
    <div className="col-span-full mt-1">
      <div className="flex items-center gap-1.5 text-xs">
        <ShieldAlert className="size-3.5" style={{ color: accent }} />
        <span className="font-semibold" style={{ color: accent }}>Earning limit</span>
        <Tooltip>
          <TooltipTrigger aria-label="What is the earning limit?">
            <InfoIcon className="size-3.5 text-muted" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{tip}</TooltipContent>
        </Tooltip>
        <span className="ml-auto font-semibold" style={{ color: reached ? color : undefined }}>
          {reached ? "Limit reached" : `${fmt(usedUsd)} / ${fmt(max)}`}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ background: `${color}26` }}>
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct * 100}%`, background: color }} />
      </div>
      {hostUsd > 0 && <p className="mt-1 text-[11px] text-muted">Includes {fmt(hostUsd)} paid for gigs you hosted.</p>}
    </div>
  );
}
