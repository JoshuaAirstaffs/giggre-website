// Distance units by region — same rule as the app (core/utils/distance_units.dart):
// US users see miles (feet up close), Philippines and everyone else see km
// (metres). Distances are always stored/compared in km; only display changes.

export const KM_PER_MILE = 1.609344;
const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.28084;

export const distanceUnit = (miles: boolean) => (miles ? "mi" : "km");

/** 450 m / 1.2 km — or 300 ft / 0.8 mi. */
export function formatDistance(meters: number, miles: boolean): string {
  if (miles) {
    const mi = meters / METERS_PER_MILE;
    if (mi < 0.1) return `${Math.round(meters * FEET_PER_METER)} ft`;
    return `${mi.toFixed(1)} mi`;
  }
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

/** km → shown unit / shown unit → km. */
export const fromKm = (km: number, miles: boolean) => (miles ? km / KM_PER_MILE : km);
export const toKm = (value: number, miles: boolean) => (miles ? value * KM_PER_MILE : value);

/** Whole units, e.g. "31 mi" / "50 km". */
export const formatKmRounded = (km: number, miles: boolean) => `${Math.round(fromKm(km, miles))} ${distanceUnit(miles)}`;

// ── Quick Gig max search radius (admin: Quick Gigs Configuration) ──────────
// quick_gig_config/matching_engine has one value per region:
//   max_search_radius_km     — Philippines & everyone else, in km
//   max_search_radius_mi_us  — United States, in miles
// A field set to null means "Unlimited". A missing field falls back: US →
// the km value, km → 10 km (the original default).
export const DEFAULT_QUICK_GIG_RADIUS_KM = 10;

/** Max radius in km for a gig region (US = gig currency USD), or null for no limit. */
export function quickGigRadiusKm(config: Record<string, unknown>, us: boolean): number | null {
  if (us && "max_search_radius_mi_us" in config) {
    const mi = config.max_search_radius_mi_us;
    return typeof mi === "number" ? mi * KM_PER_MILE : null;
  }
  if ("max_search_radius_km" in config) {
    const km = config.max_search_radius_km;
    return typeof km === "number" ? km : null;
  }
  return DEFAULT_QUICK_GIG_RADIUS_KM;
}

/** "10 km" / "6 mi" / "Unlimited" — what this viewer's region uses. */
export function quickGigRadiusLabel(config: Record<string, unknown>, miles: boolean): string {
  const km = quickGigRadiusKm(config, miles);
  if (km == null) return "Unlimited";
  const v = fromKm(km, miles);
  return `${Number.isInteger(v) ? v : v.toFixed(1)} ${distanceUnit(miles)}`;
}

/**
 * Browser-only guess when the signed-in region isn't known yet: a US time
 * zone means miles. (Asia/Manila and everything else → km.)
 */
export function browserUsesMiles(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    return /^America\/(New_York|Chicago|Denver|Phoenix|Los_Angeles|Anchorage|Detroit|Boise|Indiana|Kentucky|North_Dakota|Menominee|Juneau|Sitka|Nome|Adak|Yakutat|Metlakatla)/.test(tz)
      || tz === "Pacific/Honolulu";
  } catch {
    return false;
  }
}
