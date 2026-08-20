"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAppSelector } from "@/store/hooks";
import { currencySymbol, formatDate } from "@/lib/utils";
import { GIG_TYPE_BADGE_CLASSES, type CompletedEntry, type GigTypeKey } from "@/lib/earnings";

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
  "amount-desc": "Highest payout",
  "amount-asc": "Lowest payout",
};

const SORTERS: Record<SortOption, (a: CompletedEntry, b: CompletedEntry) => number> = {
  newest: (a, b) => b.completedAt.getTime() - a.completedAt.getTime(),
  oldest: (a, b) => a.completedAt.getTime() - b.completedAt.getTime(),
  "amount-desc": (a, b) => b.amount - a.amount,
  "amount-asc": (a, b) => a.amount - b.amount,
};

const PAGE_SIZE = 10;

interface RecentPayoutsCardProps {
  entries: CompletedEntry[];
  loading: boolean;
  error: string | null;
}

export default function RecentPayoutsCard({ entries, loading, error }: RecentPayoutsCardProps) {
  const currencyCode = useAppSelector((root) => root.user.profile?.currencyCode) ?? "USD";
  const symbol = currencySymbol(currencyCode);

  const [gigTypeFilter, setGigTypeFilter] = useState<GigTypeFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const payouts = useMemo(() => {
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;

    return entries
      .filter((e) => gigTypeFilter === "all" || e.gigTypeKey === gigTypeFilter)
      .filter((e) => !from || e.completedAt >= from)
      .filter((e) => !to || e.completedAt <= to)
      .sort(SORTERS[sortBy]);
  }, [entries, gigTypeFilter, sortBy, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(payouts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = payouts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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
        <CardTitle className="text-sm font-medium text-muted">Recent payouts</CardTitle>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="payouts-date-from" className="text-xs text-muted">
              From
            </Label>
            <input
              id="payouts-date-from"
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
            <Label htmlFor="payouts-date-to" className="text-xs text-muted">
              To
            </Label>
            <input
              id="payouts-date-to"
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
        ) : payouts.length === 0 ? (
          <p className="text-sm text-muted">No completed gigs match these filters.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gig</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Host</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((entry, i) => (
                  <TableRow key={i} className="hover:bg-transparent">
                    <TableCell className="font-medium text-ink">{entry.title}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={entry.gigTypeKey ? GIG_TYPE_BADGE_CLASSES[entry.gigTypeKey] : ""}
                      >
                        {entry.gigType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted">{entry.hostName || "—"}</TableCell>
                    <TableCell className="text-muted">{formatDate(entry.completedAt)}</TableCell>
                    <TableCell className="text-right font-medium text-(--worker-end)">
                      {symbol}
                      {entry.amount.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-muted">
                  Page {currentPage} of {totalPages} · {payouts.length} payout{payouts.length === 1 ? "" : "s"}
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
