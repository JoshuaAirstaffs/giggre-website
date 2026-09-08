import { collection, limit, onSnapshot, query, where, Timestamp, type Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Mirrors the account-notification half of the worker app's activity feed —
// see giggre_app/lib/features/gig_worker/presentation/widgets/worker_notifications_sheet.dart.
// Docs only carry `userId` / `category` / `message` / `createdAt`; there's no
// `title` field, so the title is derived from `category` (and `request_status`
// for request-type categories), same as _WorkerNotificationsSheetState._activities.
const NOTIFICATIONS_LIMIT = 20;

// Matches the Flutter sheet's kAccountWindow — account notifications older
// than this aren't counted as "recent" for the header badge.
const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

const REQUEST_STATUS_TITLES: Record<string, Record<string, string>> = {
  verification_requests: {
    approved: "Verification Request Approved",
    rejected: "Verification Request Rejected",
    pending: "Verification Request Pending",
  },
  skill_request: {
    approved: "Skill Request Approved",
    rejected: "Skill Request Rejected",
    pending: "Skill Request Pending",
  },
};

function titleForCategory(category: string, requestStatus: string) {
  const byStatus = REQUEST_STATUS_TITLES[category]?.[requestStatus];
  if (byStatus) return byStatus;
  if (!category) return "Account Notice";
  return category.charAt(0).toUpperCase() + category.slice(1).replaceAll("_", " ");
}

export interface NotificationEntry {
  id: string;
  title: string;
  body: string;
  createdAt: Date;
}

// Live listener rather than a one-time fetch — a new notification (e.g. a
// host approving a request) should show up in the bell without a reload.
// No orderBy here on purpose — the Firestore query only filters by userId
// (matching the Flutter sheet), then sorts client-side, avoiding the need
// for a composite index on (userId, createdAt).
export function subscribeNotifications(
  uid: string,
  onData: (notifications: NotificationEntry[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "notifications"), where("userId", "==", uid), limit(NOTIFICATIONS_LIMIT)),
    (snap) => {
      const entries = snap.docs.map((d) => {
        const data = d.data();
        const createdAt: Timestamp | undefined = data.createdAt;
        const category = (data.category as string | undefined) ?? "";
        const requestStatus = (data.request_status as string | undefined) ?? "";
        return {
          id: d.id,
          title: titleForCategory(category, requestStatus),
          body: (data.message as string | undefined) ?? "",
          createdAt: createdAt?.toDate() ?? new Date(),
        };
      });
      onData(entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    },
    onError
  );
}

export function isRecent(date: Date) {
  return Date.now() - date.getTime() <= RECENT_WINDOW_MS;
}
