"use client";

import { useMemo, useState } from "react";
import { Briefcase, Wallet } from "lucide-react";
import TitlePage from "@/components/TitlePage";
import JoshDiv from "@/components/DivAnimation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppSelector } from "@/store/hooks";
import { useCompletedEntries } from "@/hooks/use-completed-entries";
import { currencySymbol } from "@/lib/utils";
import { GIG_TYPE_BADGE_CLASSES, sumAmountBetween, type CompletedEntry, type GigTypeKey } from "@/lib/earnings";
import GigHistoryCard from "./components/GigHistoryCard";
import CompletedGigsTrendChart from "./components/CompletedGigsTrendChart";

const GIG_TYPE_COUNT_LABELS: Record<GigTypeKey, string> = {
  quick: "Quick Gigs",
  open: "Open Gigs",
  offered: "Offered Gigs",
};

function monthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function groupByMonth(entries: CompletedEntry[]) {
  const groups: { key: string; label: string; entries: CompletedEntry[] }[] = [];
  for (const entry of entries) {
    const key = monthKey(entry.completedAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.entries.push(entry);
    } else {
      groups.push({ key, label: monthLabel(entry.completedAt), entries: [entry] });
    }
  }
  return groups;
}

const PAGE_SIZE = 10;
const ALL_MONTHS = "all";

export default function GigHistoryPage() {
  const uid = useAppSelector((root) => root.user.authUser?.uid);
  const profile = useAppSelector((root) => root.user.profile);
  const { entries, loading, error } = useCompletedEntries(uid);
  const symbol = currencySymbol(profile?.currencyCode ?? "USD");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [monthFilter, setMonthFilter] = useState(ALL_MONTHS);

  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime()),
    [entries]
  );

  const monthOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const entry of sorted) {
      const key = monthKey(entry.completedAt);
      if (!seen.has(key)) seen.set(key, monthLabel(entry.completedAt));
    }
    return Array.from(seen, ([key, label]) => ({ key, label }));
  }, [sorted]);

  const filtered = useMemo(
    () => (monthFilter === ALL_MONTHS ? sorted : sorted.filter((e) => monthKey(e.completedAt) === monthFilter)),
    [sorted, monthFilter]
  );

  function handleMonthFilterChange(value: string | null) {
    setMonthFilter(value ?? ALL_MONTHS);
    setVisibleCount(PAGE_SIZE);
  }

  const groups = useMemo(() => groupByMonth(filtered.slice(0, visibleCount)), [filtered, visibleCount]);
  const totalEarned = useMemo(() => sumAmountBetween(entries, new Date(0), null), [entries]);
  const hasMore = visibleCount < filtered.length;

  const countsByType = useMemo(() => {
    const counts: Record<GigTypeKey, number> = { quick: 0, open: 0, offered: 0 };
    for (const entry of entries) {
      if (entry.gigTypeKey) counts[entry.gigTypeKey] += 1;
    }
    return counts;
  }, [entries]);

  return (
    <JoshDiv>
      <TitlePage title="Gig History" description="A record of your completed gigs and earnings" />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="py-5 px-6">
          <CardContent className="flex items-center gap-3 p-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-(--worker-tint) text-(--worker-text)">
              <Briefcase className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted">Total Gigs</p>
              {loading ? (
                <Skeleton className="mt-1 h-6 w-12" />
              ) : (
                <p className="text-xl font-bold text-ink">{entries.length}</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="py-5 px-6">
          <CardContent className="flex items-center gap-3 p-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-(--success-tint) text-(--success-text)">
              <Wallet className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted">Total Earned</p>
              {loading ? (
                <Skeleton className="mt-1 h-6 w-20" />
              ) : (
                <p className="text-xl font-bold text-ink">
                  {symbol}
                  {totalEarned.toLocaleString()}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(Object.keys(GIG_TYPE_COUNT_LABELS) as GigTypeKey[]).map((key) => (
          <Card key={key} className="py-4 px-6">
            <CardContent className="flex items-center justify-between p-0">
              <p className="text-xs text-muted">{GIG_TYPE_COUNT_LABELS[key]}</p>
              {loading ? (
                <Skeleton className="h-6 w-8" />
              ) : (
                <span
                  className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-sm font-bold ${GIG_TYPE_BADGE_CLASSES[key]}`}
                >
                  {countsByType[key]}
                </span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <CompletedGigsTrendChart entries={entries} loading={loading} error={error} />

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink">History</p>
        {!loading && !error && monthOptions.length > 0 && (
          <Select value={monthFilter} onValueChange={handleMonthFilterChange}>
            <SelectTrigger size="sm">
              <SelectValue>
                {monthFilter === ALL_MONTHS ? "All months" : monthOptions.find((m) => m.key === monthFilter)?.label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_MONTHS}>All months</SelectItem>
              {monthOptions.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="mt-3">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Briefcase className="size-10 text-muted" />
            <p className="font-medium text-ink">
              {sorted.length === 0 ? "No completed gigs yet" : "No gigs in this month"}
            </p>
            <p className="text-sm text-muted">
              {sorted.length === 0 ? "Your finished gigs will appear here" : "Try a different month filter"}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.key}>
                <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{group.label}</p>
                <div className="space-y-3">
                  {group.entries.map((entry, i) => (
                    <GigHistoryCard key={i} entry={entry} />
                  ))}
                </div>
              </div>
            ))}
            {hasMore && (
              <div className="flex flex-col items-center gap-2 pt-2">
                <p className="text-xs text-muted">
                  Showing {Math.min(visibleCount, filtered.length)} of {filtered.length} gigs
                </p>
                <Button variant="outline" size="sm" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                  Load more
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </JoshDiv>
  );
}
