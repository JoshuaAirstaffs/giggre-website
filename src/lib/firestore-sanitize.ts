import { GeoPoint, Timestamp } from "firebase/firestore";

// Firestore Timestamps and GeoPoints aren't plain-serializable, so Redux
// flags any that slip into a dispatched action. Rather than whitelisting the
// specific fields we know about (createdAt, location, earnings.updatedAt...),
// walk the whole doc and convert every instance wherever it appears — this
// also covers fields stamped by admin/App-Check tooling outside this app
// (e.g. a top-level `debugTokenCheckedAt`) that we'd otherwise miss one at a
// time as they show up.
export function sanitizeFirestoreValue(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof GeoPoint) return { latitude: value.latitude, longitude: value.longitude };
  if (Array.isArray(value)) return value.map(sanitizeFirestoreValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, sanitizeFirestoreValue(v)]));
  }
  return value;
}

export function sanitizeFirestoreData<T extends Record<string, unknown>>(data: T): T {
  return sanitizeFirestoreValue(data) as T;
}
