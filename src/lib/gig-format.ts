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

export function capitalize(word?: string) {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function initialsOf(name?: string) {
  if (!name) return "?";
  return name.trim().charAt(0).toUpperCase();
}
