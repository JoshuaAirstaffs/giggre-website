"use client";

import { useMemo } from "react";
import { InfoIcon, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, currencySymbol } from "@/lib/utils";
import {
  startOfMonth,
  startOfPreviousMonth,
  startOfPreviousWeek,
  startOfWeek,
  sumAmountBetween,
  type CompletedEntry,
} from "@/lib/earnings";

// Host-side mirror of the worker's EarningsSummaryCard.tsx — same
// live-computed-from-entries approach (no aggregate profile field to fall
// back to here, unlike the worker's `profile.earnings.completedGigs`; hosts
// have no equivalent `spending` aggregate on their user doc), same
// week/month comparison, just "spend" instead of "earnings" and host-tinted.
type Change = { percent: number; neutral?: boolean };

function percentChange(current: number, previous: number): Change {
  if (previous === 0) return { percent: 0, neutral: true };
  return { percent: ((current - previous) / previous) * 100 };
}

function ChangeBadge({ change }: { change: Change }) {
  if (change.neutral) {
    return <span className="text-xs font-medium text-muted">0%</span>;
  }
  const isUp = change.percent >= 0;
  const Icon = isUp ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        // Inverted from the worker's ChangeBadge on purpose — spending more
        // than last period is not the "good" direction the way earning more
        // is, so it's shown in red, not green.
        isUp ? "text-red-600 dark:text-red-500" : "text-green-600 dark:text-green-500"
      )}
    >
      <Icon className="size-3" />
      {Math.abs(change.percent).toFixed(0)}%
    </span>
  );
}

interface SpendingSummaryCardProps {
  entries: CompletedEntry[];
  loading: boolean;
  currency: string | null;
}

export default function SpendingSummaryCard({ entries, loading, currency }: SpendingSummaryCardProps) {
  const symbol = currency ? currencySymbol(currency) : "";

  const filteredEntries = useMemo(
    () => (currency ? entries.filter((e) => e.currencyCode === currency) : entries),
    [entries, currency]
  );

  const { total, monthTotal, weekTotal, prevMonthTotal, prevWeekTotal } = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const weekStart = startOfWeek(now);
    return {
      total: sumAmountBetween(filteredEntries, new Date(0), null),
      monthTotal: sumAmountBetween(filteredEntries, monthStart, null),
      weekTotal: sumAmountBetween(filteredEntries, weekStart, null),
      prevMonthTotal: sumAmountBetween(filteredEntries, startOfPreviousMonth(now), monthStart),
      prevWeekTotal: sumAmountBetween(filteredEntries, startOfPreviousWeek(now), weekStart),
    };
  }, [filteredEntries]);

  const completedGigs = filteredEntries.length;

  return (
    <Card className="py-6 px-8">
      <CardHeader className="p-0">
        <CardTitle className="text-sm font-medium text-muted">Spending</CardTitle>
      </CardHeader>
      <CardContent className="mt-2 grid grid-cols-1 gap-4 p-0 sm:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted">Total Spent</p>
            <Tooltip>
              <TooltipTrigger>
                <InfoIcon className="h-3 w-3 text-muted" />
              </TooltipTrigger>
              <TooltipContent>Lifetime spend across all completed gigs.</TooltipContent>
            </Tooltip>
          </div>
          <p className="text-4xl font-bold text-(--host-end)">
            {symbol}
            {total.toLocaleString()}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {completedGigs} gig{completedGigs === 1 ? "" : "s"} completed
          </p>
        </div>
        <div className="border-hairline sm:border-l sm:pl-4">
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted">This Month</p>
            <Tooltip>
              <TooltipTrigger>
                <InfoIcon className="h-3 w-3 text-muted" />
              </TooltipTrigger>
              <TooltipContent>Total spent so far this calendar month, compared to last month.</TooltipContent>
            </Tooltip>
          </div>
          {loading ? (
            <Skeleton className="mt-1 h-8 w-24" />
          ) : (
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-bold text-(--host-end)">
                {symbol}
                {monthTotal.toLocaleString()}
              </p>
              <ChangeBadge change={percentChange(monthTotal, prevMonthTotal)} />
            </div>
          )}
        </div>
        <div className="border-hairline sm:border-l sm:pl-4">
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted">This Week</p>
            <Tooltip>
              <TooltipTrigger>
                <InfoIcon className="h-3 w-3 text-muted" />
              </TooltipTrigger>
              <TooltipContent>Total spent so far this week (Mon–Sun), compared to last week.</TooltipContent>
            </Tooltip>
          </div>
          {loading ? (
            <Skeleton className="mt-1 h-8 w-24" />
          ) : (
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-bold text-(--host-end)">
                {symbol}
                {weekTotal.toLocaleString()}
              </p>
              <ChangeBadge change={percentChange(weekTotal, prevWeekTotal)} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
