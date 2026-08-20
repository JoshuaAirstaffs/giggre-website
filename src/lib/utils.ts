import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Formats a date as "January 1, 2022". */
export function formatDate(date?: string | number | Date) {
  if (!date) return ""
  return new Date(date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

/** Currency symbol for the codes this app actually uses (PH/US), same as the mobile app. */
export function currencySymbol(code?: string) {
  if (code === "USD") return "$"
  if (code === "PHP") return "₱"
  return code ? `${code} ` : "$"
}

/** 1 = Monday .. 7 = Sunday (ISO), vs. JS's native 0 = Sunday .. 6 = Saturday. */
function isoWeekday(date: Date) {
  const day = date.getDay()
  return day === 0 ? 7 : day
}

/**
 * Current ISO week label, e.g. "2026-W28" — same algorithm as
 * giggre_app/lib/core/services/earnings_service.dart's currentWeekLabel(),
 * so it matches whatever the app itself last stamped on earnings.currentWeek.
 */
export function currentWeekLabel(now: Date = new Date()) {
  const thursday = new Date(now)
  thursday.setDate(now.getDate() - (isoWeekday(now) - 4))
  const weekYear = thursday.getFullYear()
  const jan4 = new Date(weekYear, 0, 4)
  const week1Monday = new Date(jan4)
  week1Monday.setDate(jan4.getDate() - (isoWeekday(jan4) - 1))
  const diffDays = Math.floor((now.getTime() - week1Monday.getTime()) / 86_400_000)
  const weekNumber = Math.floor(diffDays / 7) + 1
  return `${weekYear}-W${String(weekNumber).padStart(2, "0")}`
}
