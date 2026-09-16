"use client";

import { useMemo, useState } from "react";
import TitlePage from "@/components/TitlePage";
import { useAppSelector } from "@/store/hooks";
import { useCompletedEntries } from "@/hooks/use-completed-entries";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EarningsSummaryCard from "./components/EarningsSummaryCard";
import WeeklyEarningsCard from "./components/WeeklyEarningsCard";
import RecentPayoutsCard from "./components/RecentPayoutsCard";
import JoshDiv from "@/components/DivAnimation";

export default function WorkerEarningsPage() {
  const uid = useAppSelector((root) => root.user.authUser?.uid);
  const { entries, loading, error } = useCompletedEntries(uid);
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);

  const currencies = useMemo(
    () => Array.from(new Set(entries.map((e) => e.currencyCode))).sort(),
    [entries],
  );

  // A worker can pick up gigs priced in more than one currency — mixing
  // those into a single total would be meaningless, so the summary and
  // weekly-breakdown cards share one currency selection here instead of
  // each picking independently.
  const activeCurrency = selectedCurrency && currencies.includes(selectedCurrency) ? selectedCurrency : currencies[0] ?? null;

  return (
    <JoshDiv>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <TitlePage title="My Earnings" description="Track your income, payouts, and breakdowns" />
        {currencies.length > 1 && (
          <Select value={activeCurrency ?? undefined} onValueChange={setSelectedCurrency}>
            <SelectTrigger size="sm" className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currencies.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="mt-6 space-y-6">
        <EarningsSummaryCard entries={entries} loading={loading} currency={activeCurrency} />
        <WeeklyEarningsCard entries={entries} loading={loading} error={error} currency={activeCurrency} />
        <RecentPayoutsCard entries={entries} loading={loading} error={error} />
      </div>
    </JoshDiv>
  );
}
