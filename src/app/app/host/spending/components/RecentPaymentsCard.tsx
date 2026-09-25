"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Clock, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currencySymbol, formatDate } from "@/lib/utils";
import { formatDuration } from "@/lib/gig-format";
import { GIG_TYPE_BADGE_CLASSES, type CompletedEntry, type GigTypeKey } from "@/lib/earnings";

// Host-side mirror of the worker's RecentPayoutsCard.tsx, grouped by gig
// rather than one row per worker payment — a multi-worker gig otherwise
// shows up as N separate rows (fetchHostCompletedEntries emits one
// CompletedEntry per paid worker slot, see its own comments), which reads
// as N unrelated payments rather than one gig with several workers. Each
// group row expands to a per-worker breakdown: name, worked hours
// (durationSeconds, decorative-only elsewhere too), and that worker's own
// final payment.
type GigTypeFilter = GigTypeKey | "all";
type SortOption = "newest" | "oldest" | "amount-desc" | "amount-asc";

const GIG_TYPE_FILTER_LABELS: Record<GigTypeFilter, string> = {
  all: "All types",
  quick: "Quick Gig",
  open: "Open Gig",
  offered: "Offered Gig",
};

const SORT_LABELS: Record<SortOption, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  "amount-desc": "Highest payment",
  "amount-asc": "Lowest payment",
};

const ENTRY_FILTERS_SORTERS: Record<SortOption, (a: CompletedEntry, b: CompletedEntry) => number> = {
  newest: (a, b) => b.completedAt.getTime() - a.completedAt.getTime(),
  oldest: (a, b) => a.completedAt.getTime() - b.completedAt.getTime(),
  "amount-desc": (a, b) => b.amount - a.amount,
  "amount-asc": (a, b) => a.amount - b.amount,
};

interface GigGroup {
  gigId: string;
  title: string;
  gigType: string;
  gigTypeKey: GigTypeKey | null;
  currencyCode: string;
  latestCompletedAt: Date;
  totalAmount: number;
  workers: CompletedEntry[];
}

// A gig missing gigId (shouldn't happen, but the field only started being
// populated going forward) falls back to grouping by title+timestamp,
// which just means it renders as its own single-worker group instead of
// merging with anything — never crashes, never silently merges unrelated
// gigs.
function groupByGig(list: CompletedEntry[]): GigGroup[] {
  const groups = new Map<string, GigGroup>();
  for (const entry of list) {
    const key = entry.gigId || `${entry.title}-${entry.completedAt.getTime()}`;
    const existing = groups.get(key);
    if (existing) {
      existing.totalAmount += entry.amount;
      existing.workers.push(entry);
      if (entry.completedAt > existing.latestCompletedAt) existing.latestCompletedAt = entry.completedAt;
    } else {
      groups.set(key, {
        gigId: key,
        title: entry.title,
        gigType: entry.gigType,
        gigTypeKey: entry.gigTypeKey,
        currencyCode: entry.currencyCode,
        latestCompletedAt: entry.completedAt,
        totalAmount: entry.amount,
        workers: [entry],
      });
    }
  }
  return Array.from(groups.values());
}

const GROUP_SORTERS: Record<SortOption, (a: GigGroup, b: GigGroup) => number> = {
  newest: (a, b) => b.latestCompletedAt.getTime() - a.latestCompletedAt.getTime(),
  oldest: (a, b) => a.latestCompletedAt.getTime() - b.latestCompletedAt.getTime(),
  "amount-desc": (a, b) => b.totalAmount - a.totalAmount,
  "amount-asc": (a, b) => a.totalAmount - b.totalAmount,
};

const PAGE_SIZE = 10;

interface RecentPaymentsCardProps {
  entries: CompletedEntry[];
  loading: boolean;
  error: string | null;
}

export default function RecentPaymentsCard({ entries, loading, error }: RecentPaymentsCardProps) {
  const [gigTypeFilter, setGigTypeFilter] = useState<GigTypeFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [expandedGigIds, setExpandedGigIds] = useState<Set<string>>(new Set());

  function toggleExpanded(gigId: string) {
    setExpandedGigIds((prev) => {
      const next = new Set(prev);
      if (next.has(gigId)) next.delete(gigId);
      else next.add(gigId);
      return next;
    });
  }

  const groups = useMemo(() => {
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;

    const filtered = entries
      .filter((e) => gigTypeFilter === "all" || e.gigTypeKey === gigTypeFilter)
      .filter((e) => !from || e.completedAt >= from)
      .filter((e) => !to || e.completedAt <= to)
      // Sorted before grouping too, so each group's `workers` list — used
      // for the expanded breakdown — reads newest/highest-paid first
      // regardless of which sort the host picked for the gig-level rows.
      .sort(ENTRY_FILTERS_SORTERS[sortBy]);

    return groupByGig(filtered).sort(GROUP_SORTERS[sortBy]);
  }, [entries, gigTypeFilter, sortBy, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = groups.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const hasActiveFilters = gigTypeFilter !== "all" || sortBy !== "newest" || dateFrom !== "" || dateTo !== "";

  function resetFilters() {
    setGigTypeFilter("all");
    setSortBy("newest");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted">Recent payments</CardTitle>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="payments-date-from" className="text-xs text-muted">
              From
            </Label>
            <input
              id="payments-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="payments-date-to" className="text-xs text-muted">
              To
            </Label>
            <input
              id="payments-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted">Gig type</Label>
            <Select
              value={gigTypeFilter}
              onValueChange={(v) => {
                setGigTypeFilter(v as GigTypeFilter);
                setPage(1);
              }}
            >
              <SelectTrigger size="sm">
                <SelectValue>{GIG_TYPE_FILTER_LABELS[gigTypeFilter]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(GIG_TYPE_FILTER_LABELS) as GigTypeFilter[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {GIG_TYPE_FILTER_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted">Sort by</Label>
            <Select
              value={sortBy}
              onValueChange={(v) => {
                setSortBy(v as SortOption);
                setPage(1);
              }}
            >
              <SelectTrigger size="sm">
                <SelectValue>{SORT_LABELS[sortBy]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {SORT_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <RotateCcw className="size-3.5" />
              Reset
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-muted">No completed gigs match these filters.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Gig</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Workers</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((group) => {
                  const expanded = expandedGigIds.has(group.gigId);
                  const singleWorker = group.workers.length === 1 ? group.workers[0] : null;
                  return (
                    <Fragment key={group.gigId}>
                      <TableRow
                        className="cursor-pointer hover:bg-accent"
                        onClick={() => toggleExpanded(group.gigId)}
                      >
                        <TableCell>
                          <ChevronDown
                            className={`size-4 text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-ink">{group.title}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={group.gigTypeKey ? GIG_TYPE_BADGE_CLASSES[group.gigTypeKey] : ""}>
                            {group.gigType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted">
                          {singleWorker
                            ? singleWorker.workerName || "—"
                            : `${group.workers.length} workers`}
                        </TableCell>
                        <TableCell className="text-muted">{formatDate(group.latestCompletedAt)}</TableCell>
                        <TableCell className="text-right font-medium text-(--host-end)">
                          {currencySymbol(group.currencyCode)}
                          {group.totalAmount.toLocaleString()}
                        </TableCell>
                      </TableRow>
                      {expanded && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={6} className="bg-secondary/40 p-0">
                            <div className="space-y-2 p-3">
                              {group.workers.map((w, i) => (
                                <div
                                  key={i}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-hairline bg-card px-3 py-2 text-sm"
                                >
                                  <span className="font-medium text-ink">{w.workerName || "Unknown worker"}</span>
                                  <div className="flex items-center gap-3">
                                    <span className="flex items-center gap-1 text-xs text-muted">
                                      <Clock className="size-3.5" />
                                      {w.durationSeconds != null ? formatDuration(w.durationSeconds) : "Hours not tracked"}
                                    </span>
                                    <span className="font-medium text-(--host-end)">
                                      {currencySymbol(w.currencyCode)}
                                      {w.amount.toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-muted">
                  Page {currentPage} of {totalPages} · {groups.length} gig{groups.length === 1 ? "" : "s"}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setPage((p) => p - 1)}
                    disabled={currentPage <= 1}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={currentPage >= totalPages}
                    aria-label="Next page"
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
