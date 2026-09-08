"use client";

import { useMemo } from "react";
import { InfoIcon, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppSelector } from "@/store/hooks";
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
        isUp ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"
      )}
    >
      <Icon className="size-3" />
      {Math.abs(change.percent).toFixed(0)}%
    </span>
  );
}

interface EarningsSummaryCardProps {
  entries: CompletedEntry[];
  loading: boolean;
}

// All three figures are computed live from the raw completed-gig entries
// (same source WeeklyEarningsCard uses for its chart) rather than trusting
// the aggregated `users/{uid}.earnings.total` field — that field can end up
// split across a stray "USD" key when a gig doc is missing `currencyCode`
// (see fetchCompletedEntries), silently undercounting the lifetime total.
export default function EarningsSummaryCard({ entries, loading }: EarningsSummaryCardProps) {
  const profile = useAppSelector((root) => root.user.profile);

  const code = profile?.currencyCode ?? "USD";
  const symbol = currencySymbol(code);
  const completedGigs = profile?.earnings?.completedGigs ?? 0;

  const { total, monthTotal, weekTotal, prevMonthTotal, prevWeekTotal } = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const weekStart = startOfWeek(now);
    return {
      total: sumAmountBetween(entries, new Date(0), null),
      monthTotal: sumAmountBetween(entries, monthStart, null),
      weekTotal: sumAmountBetween(entries, weekStart, null),
      prevMonthTotal: sumAmountBetween(entries, startOfPreviousMonth(now), monthStart),
      prevWeekTotal: sumAmountBetween(entries, startOfPreviousWeek(now), weekStart),
    };
  }, [entries]);

  return (
    <Card className="py-6 px-8">
      <CardHeader className="p-0">
        <CardTitle className="text-sm font-medium text-muted">Earnings</CardTitle>
      </CardHeader>
      <CardContent className="mt-2 grid grid-cols-1 gap-4 p-0 sm:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted">Total Earnings</p>
            <Tooltip>
              <TooltipTrigger>
                <InfoIcon className="h-3 w-3 text-muted" />
              </TooltipTrigger>
              <TooltipContent>Lifetime earnings across all completed gigs.</TooltipContent>
            </Tooltip>
          </div>
          <p className="text-4xl font-bold text-(--worker-end)">
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
              <TooltipContent>Total earned so far this calendar month, compared to last month.</TooltipContent>
            </Tooltip>
          </div>
          {loading ? (
            <Skeleton className="mt-1 h-8 w-24" />
          ) : (
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-bold text-(--worker-end)">
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
              <TooltipContent>Total earned so far this week (Mon–Sun), compared to last week.</TooltipContent>
            </Tooltip>
          </div>
          {loading ? (
            <Skeleton className="mt-1 h-8 w-24" />
          ) : (
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-bold text-(--worker-end)">
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
