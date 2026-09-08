"use client";

import TitlePage from "@/components/TitlePage";
import { useAppSelector } from "@/store/hooks";
import { useCompletedEntries } from "@/hooks/use-completed-entries";
import EarningsSummaryCard from "./components/EarningsSummaryCard";
import WeeklyEarningsCard from "./components/WeeklyEarningsCard";
import RecentPayoutsCard from "./components/RecentPayoutsCard";
import JoshDiv from "@/components/DivAnimation";

export default function WorkerEarningsPage() {
  const uid = useAppSelector((root) => root.user.authUser?.uid);
  const { entries, loading, error } = useCompletedEntries(uid);

  return (
    <JoshDiv>
      <TitlePage title="My Earnings" description="Track your income, payouts, and breakdowns" />

      <div className="mt-6 space-y-6">
        <EarningsSummaryCard entries={entries} loading={loading} />
        <WeeklyEarningsCard entries={entries} loading={loading} error={error} />
        <RecentPayoutsCard entries={entries} loading={loading} error={error} />
      </div>
    </JoshDiv>
  );
}
