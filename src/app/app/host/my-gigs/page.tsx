"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Briefcase, ChevronLeft, ChevronRight, Eye, Megaphone, Search } from "lucide-react";
import TitlePage from "@/components/TitlePage";
import JoshDiv from "@/components/DivAnimation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAppSelector } from "@/store/hooks";
import { capitalize, formatSchedule, salary } from "@/lib/gig-format";
import { GIG_TYPE_BADGE_CLASSES, type GigTypeKey } from "@/lib/earnings";
import { fetchHostGigs, type HostGig } from "@/lib/host-gigs";

const PAGE_SIZE = 10;
type FilterKey = "all" | GigTypeKey;

const FILTERS: { key: FilterKey; label: string; activeClass: string }[] = [
  { key: "all", label: "All", activeClass: "data-active:bg-ink data-active:text-white" },
  { key: "quick", label: "Quick", activeClass: "data-active:bg-(--quick-start) data-active:text-white" },
  { key: "open", label: "Open", activeClass: "data-active:bg-worker data-active:text-white" },
  { key: "offered", label: "Offered", activeClass: "data-active:bg-(--offered-start) data-active:text-white" },
];

function formatStatus(status: string) {
  return capitalize(status.replace(/_/g, " "));
}

// A colored dot + matching text color per status, instead of one uniform
// gray badge, so the Status column reads at a glance — same status-color
// language used on the gig detail page's worker rows (worker=blue,
// host=amber for in-progress payment steps, success=green, destructive=red
// for an actual decline, muted for a plain cancellation).
const GIG_STATUS_CLASSES: Record<string, string> = {
  open: "text-(--worker-text)",
  scanning: "text-(--worker-text)",
  filled: "text-(--worker-text)",
  partially_filled: "text-(--worker-text)",
  navigating: "text-(--worker-text)",
  arrived: "text-(--worker-text)",
  working: "text-(--host-text)",
  task_complete: "text-(--host-text)",
  payment: "text-(--host-text)",
  completed: "text-(--success-text)",
  declined: "text-destructive",
  cancellation_requested: "text-destructive",
  cancelled: "text-muted",
  no_worker: "text-muted",
};

function GigStatusLabel({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${GIG_STATUS_CLASSES[status] ?? "text-muted"}`}>
      <span className="size-1.5 shrink-0 rounded-full bg-current" />
      {formatStatus(status)}
    </span>
  );
}

export default function MyGigsPage() {
  const uid = useAppSelector((root) => root.user.authUser?.uid);
  const [gigs, setGigs] = useState<HostGig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const fetched = await fetchHostGigs(uid);
        if (!cancelled) setGigs(fetched);
      } catch (err) {
        console.error("Failed to load your gigs:", err);
        if (!cancelled) setError("Couldn't load your gigs. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = { all: gigs.length, quick: 0, open: 0, offered: 0 };
    for (const gig of gigs) c[gig.gigType]++;
    return c;
  }, [gigs]);

  // "open" here is the gig's own status (open_gigs still awaiting an
  // applicant) — distinct from the "Open" tab above, which is the gig TYPE
  // and includes open_gigs that have since been filled/cancelled/etc.
  const openGigsCount = useMemo(() => gigs.filter((gig) => gig.status === "open").length, [gigs]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return gigs.filter(
      (gig) =>
        (filter === "all" || gig.gigType === filter) &&
        (!query || gig.title.toLowerCase().includes(query)) &&
        (!openOnly || gig.status === "open")
    );
  }, [gigs, filter, search, openOnly]);

  const totalPages = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
  const pageGigs = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleFilterChange(value: string | null) {
    setFilter((value as FilterKey) ?? "all");
    setPage(1);
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  function toggleOpenOnly() {
    setOpenOnly((prev) => !prev);
    setPage(1);
  }

  return (
    <JoshDiv>
      <TitlePage title="My Gigs" description="Every gig you've posted, latest first" />

      <button type="button" onClick={toggleOpenOnly} className="mt-6 block w-full text-left sm:w-64">
        <Card className={`px-6 py-5 transition-colors ${openOnly ? "border-worker ring-1 ring-worker" : ""}`}>
          <CardContent className="flex items-center gap-3 p-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-(--worker-tint) text-(--worker-text)">
              <Megaphone className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted">Open — awaiting applicants</p>
              <p className="text-xl font-bold text-ink">{openGigsCount}</p>
            </div>
          </CardContent>
        </Card>
      </button>

      <div className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={filter} onValueChange={handleFilterChange}>
            <TabsList className="bg-secondary">
              {FILTERS.map((f) => (
                <TabsTrigger key={f.key} value={f.key} className={`gap-1.5 ${f.activeClass}`}>
                  {f.label} ({counts[f.key]})
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by title"
              className="pl-8"
            />
          </div>
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-2xl" />
              ))}
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <Briefcase className="size-10 text-muted" />
              <p className="font-medium text-ink">
                {search ? "No gigs match your search" : openOnly ? "No open gigs" : "No gigs yet"}
              </p>
              <p className="text-sm text-muted">
                {search
                  ? `No titles match "${search}".`
                  : openOnly
                    ? "No gigs are currently awaiting applicants."
                    : filter === "all"
                      ? "Gigs you post will show up here"
                      : `You haven't posted any ${filter} gigs yet`}
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-hairline">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Budget</TableHead>
                      <TableHead>Slots</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageGigs.map((gig) => (
                      <TableRow key={gig.id}>
                        <TableCell className="max-w-48 truncate font-medium text-ink">{gig.title}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={GIG_TYPE_BADGE_CLASSES[gig.gigType]}>
                            {capitalize(gig.gigType)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <GigStatusLabel status={gig.status} />
                        </TableCell>
                        <TableCell>{salary(gig.currencyCode, gig.budget)}</TableCell>
                        <TableCell>
                          {gig.filledSlotCount}/{gig.workerSlots}
                        </TableCell>
                        <TableCell className="text-muted">{formatSchedule(gig.scheduledDate)}</TableCell>
                        <TableCell>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            render={<Link href={`/app/host/my-gigs/${gig.gigType}/${gig.id}`} />}
                            nativeButton={false}
                            aria-label="View details"
                          >
                            <Eye className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  >
                    <ChevronLeft className="size-4" />
                    Prev
                  </Button>
                  <p className="text-xs text-muted">
                    Page {page} of {totalPages}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  >
                    Next
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </JoshDiv>
  );
}
