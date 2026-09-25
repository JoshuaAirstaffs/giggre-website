"use client";

import { useMemo, useState } from "react";
import TitlePage from "@/components/TitlePage";
import { useAppSelector } from "@/store/hooks";
import { useHostCompletedEntries } from "@/hooks/use-host-completed-entries";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SpendingSummaryCard from "./components/SpendingSummaryCard";
import WeeklySpendingCard from "./components/WeeklySpendingCard";
import RecentPaymentsCard from "./components/RecentPaymentsCard";
import JoshDiv from "@/components/DivAnimation";

// Host-side mirror of the worker's earnings page (src/app/app/worker/earnings) —
// same three-card layout and shared-currency-selector pattern, "spend"
// instead of "earnings". Previously a host could only see spend as an
// inline dashboard chart (SpendChartCard) or a single lifetime total on
// their profile — this is the first dedicated, browsable spend history.
export default function HostSpendingPage() {
  const uid = useAppSelector((root) => root.user.authUser?.uid);
  const { entries, loading, error } = useHostCompletedEntries(uid);
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);

  const currencies = useMemo(() => Array.from(new Set(entries.map((e) => e.currencyCode))).sort(), [entries]);

  const activeCurrency = selectedCurrency && currencies.includes(selectedCurrency) ? selectedCurrency : currencies[0] ?? null;

  return (
    <JoshDiv>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <TitlePage title="My Spending" description="Track what you've paid out, and breakdowns" />
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
        <SpendingSummaryCard entries={entries} loading={loading} currency={activeCurrency} />
        <WeeklySpendingCard entries={entries} loading={loading} error={error} currency={activeCurrency} />
        <RecentPaymentsCard entries={entries} loading={loading} error={error} />
      </div>
    </JoshDiv>
  );
}
