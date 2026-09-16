"use client";

import { Bell } from "lucide-react";
import TitlePage from "@/components/TitlePage";
import JoshDiv from "@/components/DivAnimation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppSelector } from "@/store/hooks";
import { useNotifications } from "@/hooks/use-notifications";
import { NOTIFICATIONS_FETCH_LIMIT, timeAgo } from "@/lib/notifications";

// Shared between /app/host/notifications and /app/worker/notifications — the
// full history behind the NotificationBell dropdown, which only ever shows
// the 20 most recent. Same data source (useNotifications), just requesting
// everything the underlying query fetches instead of the bell's slice.
export default function NotificationsPage() {
  const uid = useAppSelector((root) => root.user.authUser?.uid);
  const { notifications, readIds, markAsRead, markAllAsRead, unreadCount, loading, error } = useNotifications(
    uid,
    NOTIFICATIONS_FETCH_LIMIT
  );

  return (
    <JoshDiv>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TitlePage title="Notifications" description="Everything you've been notified about" />
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            Mark all read
          </Button>
        )}
      </div>

      <div className="mt-6 space-y-2">
        {loading ? (
          <>
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : notifications.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 p-10 text-center">
            <Bell className="size-8 text-muted" />
            <p className="text-sm font-medium text-ink">No notifications yet</p>
          </Card>
        ) : (
          notifications.map((notification) => {
            const unread = !readIds.has(notification.id);
            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => markAsRead(notification.id)}
                className={`flex w-full items-start gap-3 rounded-xl border border-hairline px-4 py-3 text-left transition-colors hover:bg-accent ${
                  unread ? "bg-(--worker-tint)/50" : ""
                }`}
              >
                {unread && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-worker" aria-hidden />}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${unread ? "font-semibold text-ink" : "font-medium text-muted-foreground"}`}>
                    {notification.title}
                  </p>
                  {notification.body && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{notification.body}</p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">{timeAgo(notification.createdAt)}</p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </JoshDiv>
  );
}
