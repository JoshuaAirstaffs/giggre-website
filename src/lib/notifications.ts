import { collection, limit, onSnapshot, query, where, Timestamp, type Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Mirrors the account-notification half of the worker app's activity feed —
// see giggre_app/lib/features/gig_worker/presentation/widgets/worker_notifications_sheet.dart.
// Docs only carry `userId` / `category` / `message` / `createdAt`; there's no
// `title` field, so the title is derived from `category` (and `request_status`
// for request-type categories), same as _WorkerNotificationsSheetState._activities.
const NOTIFICATIONS_DISPLAY_LIMIT = 20;

// The Firestore query itself asks for far more than what's displayed —
// `where(userId==uid)` has no `orderBy` (avoiding a composite index, per the
// note below), so once an account has more matching docs than the query's
// `limit()`, Firestore does NOT guarantee the returned subset is the most
// recent ones — a brand-new notification could silently fall outside a
// small limit and never surface. Querying a generous ceiling here, then
// sorting client-side and slicing down to NOTIFICATIONS_DISPLAY_LIMIT,
// means a new notification (always the most recent by createdAt) is
// essentially guaranteed to be included and always sorts first.
const NOTIFICATIONS_FETCH_LIMIT = 300;

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
// for a composite index on (userId, createdAt). See NOTIFICATIONS_FETCH_LIMIT
// above for why the query limit itself is much bigger than what's displayed.
export function subscribeNotifications(
  uid: string,
  onData: (notifications: NotificationEntry[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "notifications"), where("userId", "==", uid), limit(NOTIFICATIONS_FETCH_LIMIT)),
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
      entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      onData(entries.slice(0, NOTIFICATIONS_DISPLAY_LIMIT));
    },
    onError
  );
}
