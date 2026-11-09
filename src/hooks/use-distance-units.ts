"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppSelector } from "@/store/hooks";
import { signedInPhilippines } from "@/lib/tutorial-videos";
import { browserUsesMiles, distanceUnit, formatDistance, formatKmRounded, fromKm, toKm } from "@/lib/distance-units";
import { useWalletCurrency } from "@/hooks/use-wallet-currency";

/**
 * Miles (US) or km (Philippines & everyone else) — the same region the Gig
 * Wallet's ₱ / $ and the tutorial videos use: wallet currency first, then the
 * account's detected country / currency, then the browser's time zone.
 */
export function useDistanceUnits() {
  const uid = useAppSelector((root) => root.user.authUser?.uid);
  const profile = useAppSelector((root) => root.user.profile) as
    | { countryCode?: string; currencyCode?: string }
    | null
    | undefined;
  const walletCurrency = useWalletCurrency(uid);
  const [browserMiles, setBrowserMiles] = useState(false);
  useEffect(() => {
    // After mount only (no hydration mismatch).
    const t = setTimeout(() => setBrowserMiles(browserUsesMiles()), 0);
    return () => clearTimeout(t);
  }, []);

  const ph = uid
    ? signedInPhilippines({ walletCurrency, countryCode: profile?.countryCode, currencyCode: profile?.currencyCode })
    : null;
  // Signed-in region known → not PH means miles (wallets are PHP or USD);
  // unknown → browser guess.
  const miles = ph != null ? !ph : browserMiles;

  return {
    miles,
    unit: distanceUnit(miles),
    format: useCallback((meters: number) => formatDistance(meters, miles), [miles]),
    formatKm: useCallback((km: number) => formatKmRounded(km, miles), [miles]),
    fromKm: useCallback((km: number) => fromKm(km, miles), [miles]),
    toKm: useCallback((v: number) => toKm(v, miles), [miles]),
  };
}
