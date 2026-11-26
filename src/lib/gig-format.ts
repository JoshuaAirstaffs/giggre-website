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

// Generic — a "—" placeholder here means missing/unavailable data (a
// timeline entry, createdAt, cancelledAt), never an intentional choice.
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

// For a gig's own scheduledDate specifically, where null is the "Anytime"
// option (no fixed schedule — see the `anytime` field on
// CommonGigFieldsState) rather than missing data, so it gets a real label
// instead of formatSchedule's generic "—".
export function formatGigSchedule(date: Date | null): string {
  return date ? formatSchedule(date) : "Anytime";
}

// Same as formatGigSchedule, for the compact weekday + time shown on a gig
// card in the browse list (see formatSchedule's own format).
export function formatScheduleShort(date: Date | null): string {
  return date ? formatSchedule(date) : "Anytime";
}

export function currencySymbol(currency?: string) {
  // ₱ only for PHP; USD and anything unknown default to $ (same as the app).
  if (currency === "PHP") return "₱";
  return "$";
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

// Mirrors giggre_app's core/utils/gig_area.dart: a gig's general area —
// city and province/state, never the street — for workers who haven't been
// accepted yet. From the gig's saved `place`; for older gigs, the address
// minus its street line and anything with a house number / ZIP.
export function gigAreaLabel(address: string | undefined, place?: Record<string, string> | null): string {
  const city = place?.city;
  const upper = place?.province ?? place?.state ?? place?.region ?? place?.county;
  const fromPlace = [city, upper && upper !== city ? upper : undefined].filter((v): v is string => !!v);
  if (fromPlace.length > 0) return fromPlace.join(", ");
  const segs = (address ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (segs.length <= 1) return segs[0] && !/\d/.test(segs[0]) ? segs[0] : "";
  const rest = segs
    .slice(1)
    .map((s) => s.replace(/\b\d{3,6}\b/g, "").trim())
    .filter((s) => s && !/^\d/.test(s));
  return rest.slice(-2).join(", ");
}

/** The area, or a note that it's shown after acceptance. */
export const gigAreaOrHidden = (address: string | undefined, place?: Record<string, string> | null) =>
  gigAreaLabel(address, place) || "Area shown after you're accepted";

/** ~1 km-rounded coordinates for a "View area" link that doesn't pinpoint the address. */
export const approximateCoords = (lat: number, lng: number) => ({ lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 });
