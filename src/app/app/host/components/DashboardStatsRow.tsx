"use client";

import { Banknote, Briefcase, CheckCircle2, Megaphone, type LucideIcon } from "lucide-react";
import { currencySymbol } from "@/lib/utils";
import { startOfMonth, sumAmountBetween, type CompletedEntry } from "@/lib/earnings";
import { isActiveGigStatus, OPEN_CARD_STATUSES, type HostGig } from "@/lib/host-gigs";

function StatTile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-hairline bg-card px-3.5 py-2.5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-(--host-tint) text-(--host-text)">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted">{label}</p>
        <p className="truncate text-sm font-semibold text-ink">{value}</p>
      </div>
    </div>
  );
}

interface DashboardStatsRowProps {
  gigs: HostGig[];
  completedEntries: CompletedEntry[];
  currencyCode: string;
}

export default function DashboardStatsRow({ gigs, completedEntries, currencyCode }: DashboardStatsRowProps) {
  const activeCount = gigs.filter((g) => isActiveGigStatus(g.status)).length;
  const openCount = gigs.filter((g) => OPEN_CARD_STATUSES.has(g.status)).length;

  const monthStart = startOfMonth(new Date());
  const completedThisMonth = completedEntries.filter((e) => e.completedAt >= monthStart).length;
  const paidThisMonth = sumAmountBetween(completedEntries, monthStart, null);

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      <StatTile icon={Briefcase} label="Active gigs" value={activeCount} />
      <StatTile icon={Megaphone} label="Awaiting applicants" value={openCount} />
      <StatTile icon={CheckCircle2} label="Completed this month" value={completedThisMonth} />
      <StatTile
        icon={Banknote}
        label="Paid out this month"
        value={`${currencySymbol(currencyCode)}${paidThisMonth.toLocaleString()}`}
      />
    </div>
  );
}
