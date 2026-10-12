// Formatting helpers shared by the worker-facing gig pages (browse, my
// applications) so the same gig data reads consistently across both.

function pluralize(value: number, unit: string) {
  return `${value} ${unit}${value === 1 ? "" : "s"} ago`;
}

export function formatPostedAge(date: Date | null) {
  if (!date) return null;
  const days = Math.floor(Math.max(0, (Date.now() - date.getTime()) / 86_400_000));

  if (days < 1) return "Today";
  if (days < 7) return pluralize(days, "day");
  if (days < 30) return pluralize(Math.floor(days / 7), "week");
  if (days < 365) return pluralize(Math.floor(days / 30), "month");
  return pluralize(Math.floor(days / 365), "year");
}

export function formatSchedule(date: Date | null) {
  if (!date) return "—";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function currencySymbol(currency?: string) {
  if (currency === "USD") return "$";
  return "₱";
}

export function salary(currency?: string, budget?: number) {
  if (budget === undefined) return "Rate not specified";
  return `${currencySymbol(currency)}${budget.toLocaleString()}`;
}

// `payType`/`budget`/`hourlyRate` shows up on every gig/application/detail
// type — a shared shape so callers don't each re-derive "hourly or flat"
// themselves.
export interface GigPay {
  payType?: string;
  budget: number;
  hourlyRate?: number | null;
}

// Nearest-minute rounding, matching hourlyPayAmount in the Flutter app's
// active_gig_step.dart exactly — the one source of truth for turning
// tracked work duration into an hourly payout.
export function hourlyPayAmount(hourlyRate: number, durationSeconds: number): number {
  const roundedMinutes = Math.round(durationSeconds / 60);
  return hourlyRate * (roundedMinutes / 60);
}

export function payAmount(pay: GigPay): number {
  return pay.payType === "hourly" && pay.hourlyRate != null ? pay.hourlyRate : pay.budget;
}

export function paySuffix(pay: GigPay): "/hr" | "/day" {
  return pay.payType === "hourly" ? "/hr" : "/day";
}

export function payLabel(currency: string | undefined, pay: GigPay): string {
  return `${salary(currency, payAmount(pay))}${paySuffix(pay)}`;
}

// "~4 hrs", "~1.5 hrs" — decorative only, never fed into any pay
// calculation. `hours` already comes in as whatever the host typed
// (e.g. 4 or 1.5), so plain interpolation trims trailing zeros for free.
export function formatWorkDuration(hours: number): string {
  return `~${hours} hr${hours === 1 ? "" : "s"}`;
}

// "2h 15m" / "45m" — a completed, static work duration (rounds to the
// nearest minute, same as hourlyPayAmount above). Distinct from
// formatElapsed, which renders a live ticking MM:SS/H:MM:SS clock instead.
export function formatDuration(durationSeconds: number): string {
  const totalMinutes = Math.round(durationSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

export function capitalize(word?: string) {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function initialsOf(name?: string) {
  if (!name) return "?";
  return name.trim().charAt(0).toUpperCase();
}

// MM:SS, escalating to H:MM:SS once past an hour — same format as _fmt in
// the app's working_ui.dart.
export function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}
