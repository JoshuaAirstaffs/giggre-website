"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { currencySymbol } from "@/lib/utils";
import { startOfWeek, type CompletedEntry } from "@/lib/earnings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type View = "week" | "month";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const chartConfig: ChartConfig = {
  earnings: {
    label: "Earnings",
    color: "var(--worker-start)",
  },
};

function formatWeekLabel(weekStart: Date, weekOffset: number) {
  if (weekOffset === 0) return "This week";
  const weekEndInclusive = new Date(weekStart);
  weekEndInclusive.setDate(weekStart.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const year = weekEndInclusive.getFullYear();
  return `${fmt(weekStart)} – ${fmt(weekEndInclusive)}, ${year}`;
}

function formatMonthLabel(monthStart: Date, monthOffset: number) {
  if (monthOffset === 0) return "This month";
  return monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

interface WeeklyEarningsCardProps {
  entries: CompletedEntry[];
  loading: boolean;
  error: string | null;
}

export default function WeeklyEarningsCard({ entries, loading, error }: WeeklyEarningsCardProps) {
  const currencyCode = useAppSelector((root) => root.user.profile?.currencyCode) ?? "USD";
  const [view, setView] = useState<View>("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  const weekStart = useMemo(() => {
    const start = startOfWeek(new Date());
    start.setDate(start.getDate() + weekOffset * 7);
    return start;
  }, [weekOffset]);

  const monthStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  }, [monthOffset]);

  const { chartData: weekChartData, total: weekTotal } = useMemo(() => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const inWeek = entries.filter((e) => e.completedAt >= weekStart && e.completedAt < weekEnd);

    const dayTotals = Array<number>(7).fill(0);
    let total = 0;

    for (const entry of inWeek) {
      total += entry.amount;
      const dayIndex = (entry.completedAt.getDay() + 6) % 7; // Mon=0 .. Sun=6
      dayTotals[dayIndex] += entry.amount;
    }

    return {
      chartData: DAY_LABELS.map((day, i) => ({ day, earnings: dayTotals[i] })),
      total,
    };
  }, [entries, weekStart]);

  const { chartData: monthChartData, total: monthTotal } = useMemo(() => {
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
    const inMonth = entries.filter((e) => e.completedAt >= monthStart && e.completedAt < monthEnd);

    const daysInMonth = Math.round((monthEnd.getTime() - monthStart.getTime()) / 86_400_000);
    const numWeeks = Math.ceil(daysInMonth / 7);
    const weekTotals = Array<number>(numWeeks).fill(0);
    let total = 0;

    for (const entry of inMonth) {
      total += entry.amount;
      const weekIndex = Math.floor((entry.completedAt.getDate() - 1) / 7);
      weekTotals[weekIndex] += entry.amount;
    }

    return {
      chartData: weekTotals.map((earnings, i) => ({ day: `Week ${i + 1}`, earnings })),
      total,
    };
  }, [entries, monthStart]);

  const isWeek = view === "week";
  const chartData = isWeek ? weekChartData : monthChartData;
  const total = isWeek ? weekTotal : monthTotal;
  const periodLabel = isWeek ? formatWeekLabel(weekStart, weekOffset) : formatMonthLabel(monthStart, monthOffset);
  const offset = isWeek ? weekOffset : monthOffset;
  const goPrev = () => (isWeek ? setWeekOffset((o) => o - 1) : setMonthOffset((o) => o - 1));
  const goNext = () => (isWeek ? setWeekOffset((o) => Math.min(0, o + 1)) : setMonthOffset((o) => Math.min(0, o + 1)));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-md bg-secondary p-0.5">
            <Button
              size="xs"
              variant={isWeek ? "default" : "ghost"}
              className={isWeek ? "bg-(--worker-end) text-white hover:bg-(--worker-end)/90" : ""}
              onClick={() => setView("week")}
            >
              Weekly
            </Button>
            <Button
              size="xs"
              variant={!isWeek ? "default" : "ghost"}
              className={!isWeek ? "bg-(--worker-end) text-white hover:bg-(--worker-end)/90" : ""}
              onClick={() => setView("month")}
            >
              Monthly
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={goPrev} aria-label={`Previous ${view}`}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-32 text-center text-xs text-muted">{periodLabel}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={goNext}
              disabled={offset >= 0}
              aria-label={`Next ${view}`}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
        <CardTitle className="mt-2 text-sm font-medium text-muted">
          {isWeek ? "Weekly breakdown" : "Monthly breakdown"}
        </CardTitle>
        {loading ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <div className="text-2xl font-bold text-ink">
            {currencySymbol(currencyCode)}
            {total.toLocaleString()}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-52 w-full" />
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-52 w-full">
            <BarChart data={chartData} margin={{ left: 0, right: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <Bar dataKey="earnings" fill="var(--color-earnings)" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
