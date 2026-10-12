"use client";

import { useEffect, useState } from "react";
import { Banknote, Briefcase, CheckCircle2, Zap, type LucideIcon } from "lucide-react";
import { currencySymbol } from "@/lib/utils";
import { fetchHostGigs, isActiveGigStatus } from "@/lib/host-gigs";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors gig_host_profile_screen.dart's "Overview" stat grid (Gigs Hosted /
// Active Gigs / Completed / Total Spent) — computed the same way its own
// _recomputeStats does (from every gig doc across the three collections),
// just via fetchHostGigs instead of three separate live listeners.
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

export default function ProfileOverviewStats({ hostId }: { hostId: string }) {
  const [loading, setLoading] = useState(true);
  const [gigsPosted, setGigsPosted] = useState(0);
  const [activeGigs, setActiveGigs] = useState(0);
  const [completedGigs, setCompletedGigs] = useState(0);
  const [spentByCurrency, setSpentByCurrency] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    // Resetting before (re)fetching, not reacting to loading itself.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetchHostGigs(hostId)
      .then((gigs) => {
        if (cancelled) return;
        setGigsPosted(gigs.length);
        setActiveGigs(gigs.filter((g) => isActiveGigStatus(g.status)).length);
        const completed = gigs.filter((g) => g.status === "completed");
        setCompletedGigs(completed.length);
        setSpentByCurrency(
          completed.reduce<Record<string, number>>((acc, g) => {
            acc[g.currencyCode] = (acc[g.currencyCode] ?? 0) + g.budget;
            return acc;
          }, {})
        );
      })
      .catch((err) => console.error("Failed to load profile stats:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hostId]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-2.5">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const spentEntries = Object.entries(spentByCurrency).sort(([a], [b]) => a.localeCompare(b));
  const totalSpentLabel =
    spentEntries.length === 0
      ? `${currencySymbol()}0`
      : spentEntries.map(([code, amount]) => `${currencySymbol(code)}${amount.toLocaleString()}`).join("  ");

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <StatTile icon={Briefcase} label="Gigs hosted" value={gigsPosted} />
      <StatTile icon={Zap} label="Active gigs" value={activeGigs} />
      <StatTile icon={CheckCircle2} label="Completed" value={completedGigs} />
      <StatTile icon={Banknote} label="Total spent" value={totalSpentLabel} />
    </div>
  );
}
