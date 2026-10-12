"use client";

import { useMemo, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { startOfWeek, type CompletedEntry } from "@/lib/earnings";

type View = "week" | "month";

const chartConfig: ChartConfig = {
  gigs: {
    label: "Gigs completed",
    color: "var(--worker-start)",
  },
};

// Fills every bucket between the worker's first and last completed gig with a
// real zero rather than skipping it — a bucket with no completed gigs is a
// known zero, not missing data, and skipping it would visually splice
// together unrelated buckets as if they were adjacent.
function buildBuckets(
  entries: CompletedEntry[],
  bucketStart: (d: Date) => Date,
  nextBucket: (d: Date) => Date,
  label: (d: Date) => string
) {
  if (entries.length === 0) return [];

  const counts = new Map<number, number>();
  for (const entry of entries) {
    const key = bucketStart(entry.completedAt).getTime();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const sortedAt = entries.map((e) => e.completedAt.getTime()).sort((a, b) => a - b);
  const first = bucketStart(new Date(sortedAt[0]));
  const last = bucketStart(new Date(sortedAt[sortedAt.length - 1]));

  const buckets: { key: number; label: string; gigs: number }[] = [];
  let cursor = first;
  while (cursor <= last) {
    buckets.push({ key: cursor.getTime(), label: label(cursor), gigs: counts.get(cursor.getTime()) ?? 0 });
    cursor = nextBucket(cursor);
  }
  return buckets;
}

// Weekly (not just monthly) buckets because gigs are short (often ≤2/day), so
// a worker crosses the "2 data points" threshold for a trend in 2 weeks
// instead of 2 months.
function weeklyBuckets(entries: CompletedEntry[]) {
  return buildBuckets(
    entries,
    startOfWeek,
    (d) => {
      const next = new Date(d);
      next.setDate(next.getDate() + 7);
      return next;
    },
    (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  );
}

function monthlyBuckets(entries: CompletedEntry[]) {
  return buildBuckets(
    entries,
    (d) => new Date(d.getFullYear(), d.getMonth(), 1),
    (d) => new Date(d.getFullYear(), d.getMonth() + 1, 1),
    (d) => d.toLocaleDateString("en-US", { month: "short", year: "numeric" })
  );
}

// recharts' own Props type for a Line's `label` renderer isn't exported in a
// form that satisfies strict parameter contravariance here, so this takes the
// escape hatch and narrows what it needs at runtime instead.
function makeEndLabel(lastIndex: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function EndLabel(props: any) {
    const { x, y, index, value } = props as { x?: number; y?: number; index?: number; value?: number };
    if (index !== lastIndex || x == null || y == null || value == null) return null;
    return (
      <text x={x} y={y - 12} textAnchor="end" className="fill-ink text-xs font-semibold">
        {value.toLocaleString()}
      </text>
    );
  };
}

interface CompletedGigsTrendChartProps {
  entries: CompletedEntry[];
  loading: boolean;
  error: string | null;
}

export default function CompletedGigsTrendChart({ entries, loading, error }: CompletedGigsTrendChartProps) {
  const [view, setView] = useState<View>("week");
  const isWeek = view === "week";

  const weekData = useMemo(() => weeklyBuckets(entries), [entries]);
  const monthData = useMemo(() => monthlyBuckets(entries), [entries]);
  const data = isWeek ? weekData : monthData;

  // A single point has no trend to show — the "Total Gigs" stat above
  // already covers that case. Checked per-view so switching views can still
  // reveal a chart the other view didn't have enough buckets for.
  if (!loading && !error && weekData.length < 2 && monthData.length < 2) return null;

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium text-muted">
            Gigs completed per {isWeek ? "week" : "month"}
          </CardTitle>
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
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-52 w-full" />
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : data.length < 2 ? (
          <p className="flex h-52 items-center justify-center text-sm text-muted">
            Not enough {isWeek ? "weekly" : "monthly"} history yet.
          </p>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-52 w-full">
            <ComposedChart data={data} margin={{ top: 20, left: 0, right: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
              <ChartTooltip
                cursor={{ stroke: "var(--border)" }}
                content={
                  <ChartTooltipContent
                    formatter={(value) => (
                      <>
                        <div className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: "var(--color-gigs)" }} />
                        <div className="flex flex-1 items-center justify-between leading-none">
                          <span className="text-muted-foreground">Gigs completed</span>
                          <span className="font-mono font-medium text-foreground tabular-nums">
                            {Number(value).toLocaleString()}
                          </span>
                        </div>
                      </>
                    )}
                  />
                }
              />
              <defs>
                <linearGradient id="gigsTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-gigs)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--color-gigs)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area dataKey="gigs" stroke="none" fill="url(#gigsTrendFill)" isAnimationActive={false} tooltipType="none" />
              <Line
                dataKey="gigs"
                type="monotone"
                stroke="var(--color-gigs)"
                strokeWidth={2}
                dot={{ r: 4, strokeWidth: 2, stroke: "var(--card)", fill: "var(--color-gigs)" }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
                label={makeEndLabel(data.length - 1)}
              />
            </ComposedChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
