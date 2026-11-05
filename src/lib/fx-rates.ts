import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Mirrors giggre_app's core/services/fx_rates.dart — live USD exchange rates
// from general_config/fx_rates (refreshed every 6 hours by functions/src/fx.ts).
// Gig Wallet's limits are set in USD; a PHP wallet sees them converted.
// Amounts shown here are previews — the server converts with the same rate
// and locks it onto each request. Only USD and PHP are actually supported —
// any other currency code is treated as 1-per-USD (USD-equivalent), exactly
// matching the app's own perUsd() behavior.

export interface FxRates {
  perUsdRates: Record<string, number>;
}

export const USD_ONLY: FxRates = { perUsdRates: { USD: 1 } };

export function perUsd(fx: FxRates, currencyCode: string): number | null {
  return currencyCode === "PHP" ? (fx.perUsdRates.PHP ?? null) : 1;
}

export function fxKnows(fx: FxRates, currencyCode: string): boolean {
  return perUsd(fx, currencyCode) != null;
}

export function fromUsd(fx: FxRates, usd: number, currencyCode: string): number | null {
  const r = perUsd(fx, currencyCode);
  return r == null ? null : Math.round(usd * r * 100) / 100;
}

/** Between two currencies, rounded down (same as convertDown on the server). */
export function convertDown(fx: FxRates, amount: number, from: string, to: string): number | null {
  if (from === to) return Math.round(amount * 100) / 100;
  const a = perUsd(fx, from);
  const b = perUsd(fx, to);
  if (a == null || b == null) return null;
  return Math.floor(((amount / a) * b * 100 + 1e-9)) / 100;
}

export async function fetchFxRates(): Promise<FxRates> {
  try {
    const snap = await getDoc(doc(db, "general_config", "fx_rates"));
    const data = snap.data();
    const live = (data?.rates as Record<string, number> | undefined) ?? {};
    const override = (data?.override as Record<string, number> | undefined) ?? {};
    const php = (typeof override.PHP === "number" && override.PHP > 0 ? override.PHP : undefined) ?? (typeof live.PHP === "number" && live.PHP > 0 ? live.PHP : undefined);
    return { perUsdRates: { USD: 1, ...(php != null ? { PHP: php } : {}) } };
  } catch {
    return USD_ONLY;
  }
}
