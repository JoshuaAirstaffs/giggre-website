"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppSelector } from "@/store/hooks";
import { fetchFxRates, USD_ONLY, type FxRates } from "@/lib/fx-rates";
import { convertForDisplay, displayCurrencyOf, displayPayLabel } from "@/lib/display-currency";
import type { GigPay } from "@/lib/gig-format";

// Rates load once per page session and are shared by every component.
let cached: FxRates | null = null;
let loading: Promise<FxRates> | null = null;
function loadRates(): Promise<FxRates> {
  if (cached) return Promise.resolve(cached);
  loading ??= fetchFxRates().then((r) => {
    cached = r;
    return r;
  });
  return loading;
}

/** Gig pay in the viewer's currency (see lib/display-currency.ts). */
export function useDisplayPay() {
  const profileCurrency = useAppSelector((root) => (root.user.profile as { currencyCode?: string } | null | undefined)?.currencyCode);
  const signedIn = useAppSelector((root) => !!root.user.authUser?.uid);
  const viewer = displayCurrencyOf(profileCurrency);
  const [fx, setFx] = useState<FxRates>(cached ?? USD_ONLY);
  useEffect(() => {
    if (!signedIn || cached) return;
    let alive = true;
    loadRates().then((r) => alive && setFx(r));
    return () => {
      alive = false;
    };
  }, [signedIn]);
  const payLabel = useCallback(
    (currency: string | undefined, pay: GigPay, opts?: { withOriginal?: boolean }) => displayPayLabel(fx, viewer, currency, pay, opts),
    [fx, viewer],
  );
  const convert = useCallback((amount: number, from: string | undefined) => convertForDisplay(fx, amount, from, viewer), [fx, viewer]);
  return { payLabel, convert, viewer, fx };
}
