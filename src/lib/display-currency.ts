import { perUsd, type FxRates } from "@/lib/fx-rates";
import { payAmount, paySuffix, salary, type GigPay } from "@/lib/gig-format";

// Mirrors giggre_app's core/services/display_currency.dart +
// CurrencyFormatter.pay: gig pay is SHOWN in the viewer's currency (their
// location: Philippines → PHP, US and elsewhere → USD, USD by default).
// A gig in the other currency is converted at the live rate and marked "≈"
// (e.g. "≈ ₱570/day"), with "(orig. $10)" where there's room. Display only:
// gigs are stored, paid and settled in their own currency.

/** Viewer's display currency from the account's detected currency. */
export const displayCurrencyOf = (profileCurrency?: string | null) => (profileCurrency === "PHP" ? "PHP" : "USD");

/** [amount] in [from] → [to] at the mid rate, to the cent; null if no rate yet. */
export function convertForDisplay(fx: FxRates, amount: number, from: string | undefined, to: string): number | null {
  const src = from || "USD";
  if (src === to) return amount;
  const a = perUsd(fx, src);
  const b = perUsd(fx, to);
  if (a == null || b == null) return null;
  return Math.round((amount / a) * b * 100) / 100;
}

/** "≈ ₱570/day" (converted) or "$10/day" (same currency / no rate yet). */
export function displayPayLabel(fx: FxRates, viewer: string, currency: string | undefined, pay: GigPay, opts: { withOriginal?: boolean } = {}): string {
  const amount = payAmount(pay);
  const src = currency || "USD";
  const converted = convertForDisplay(fx, amount, src, viewer);
  if (src === viewer || converted == null) return `${salary(src, amount)}${paySuffix(pay)}`;
  const shown = `≈ ${salary(viewer, Math.round(converted))}${paySuffix(pay)}`;
  return opts.withOriginal ? `${shown} (orig. ${salary(src, amount)})` : shown;
}
