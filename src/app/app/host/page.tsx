"use client";

import { useEffect, useState } from "react";
import TitlePage from "@/components/TitlePage";
import JoshDiv from "@/components/DivAnimation";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppSelector } from "@/store/hooks";
import { fetchHostGigs, type HostGig } from "@/lib/host-gigs";
import { useHostCompletedEntries } from "@/hooks/use-host-completed-entries";
import DashboardStatsRow from "./components/DashboardStatsRow";
import SpendChartCard from "./components/SpendChartCard";
import NeedsAttentionCard from "./components/NeedsAttentionCard";
import UpcomingGigsCard from "./components/UpcomingGigsCard";
import GigTypeBreakdownCard from "./components/GigTypeBreakdownCard";

export default function HostDashboardPage() {
  const uid = useAppSelector((root) => root.user.authUser?.uid);
  const currencyCode = useAppSelector((root) => root.user.profile?.currencyCode) ?? "USD";
  const [gigs, setGigs] = useState<HostGig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { entries, loading: entriesLoading, error: entriesError } = useHostCompletedEntries(uid);

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

  return (
    <JoshDiv>
      <TitlePage title="Dashboard" description="A snapshot of your gigs, spend, and what needs attention" />

      {loading ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-52 w-full rounded-2xl" />
        </div>
      ) : error ? (
        <p className="mt-6 text-sm text-destructive">{error}</p>
      ) : (
        <div className="mt-6 space-y-4">
          <DashboardStatsRow gigs={gigs} completedEntries={entries} currencyCode={currencyCode} />

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <SpendChartCard entries={entries} loading={entriesLoading} error={entriesError} />
              <NeedsAttentionCard gigs={gigs} />
            </div>
            <div className="space-y-4">
              <UpcomingGigsCard gigs={gigs} />
              <GigTypeBreakdownCard gigs={gigs} />
            </div>
          </div>
        </div>
      )}
    </JoshDiv>
  );
}
