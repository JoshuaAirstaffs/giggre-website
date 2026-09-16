"use client";

import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppSelector } from "@/store/hooks";
import { useNotifications } from "@/hooks/use-notifications";
import { timeAgo } from "@/lib/notifications";

export default function NotificationBell() {
  const uid = useAppSelector((root) => root.user.authUser?.uid);
  const { notifications, readIds, markAsRead, markAllAsRead, unreadCount, loading, error } = useNotifications(uid);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-muted transition-colors hover:text-ink"
          />
        }
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-80 max-h-[calc(var(--available-height)*0.6)]"
        align="end"
        sideOffset={8}
      >
        <DropdownMenuGroup className="flex items-center justify-between gap-2 pr-1">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="text-xs font-medium text-worker hover:underline"
            >
              Mark all read
            </button>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {loading ? (
          <p className="px-1.5 py-3 text-center text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          <p className="px-1.5 py-3 text-center text-sm text-destructive">{error}</p>
        ) : notifications.length === 0 ? (
          <p className="px-1.5 py-3 text-center text-sm text-muted-foreground">No notifications yet</p>
        ) : (
          <DropdownMenuGroup>
            {notifications.map((notification) => {
              const unread = !readIds.has(notification.id);
              return (
                <DropdownMenuItem
                  key={notification.id}
                  closeOnClick={false}
                  onClick={() => markAsRead(notification.id)}
                  className={`flex-col items-start gap-0.5 py-2 ${unread ? "bg-(--worker-tint)/50" : ""}`}
                >
                  <span className="flex w-full items-center gap-1.5">
                    {unread && <span className="size-1.5 shrink-0 rounded-full bg-worker" aria-hidden />}
                    <span className={`truncate ${unread ? "font-semibold text-ink" : "font-medium text-muted-foreground"}`}>
                      {notification.title}
                    </span>
                  </span>
                  {notification.body && (
                    <p
                      className={`line-clamp-2 text-xs ${unread ? "pl-3 text-muted-foreground" : "pl-3 text-muted-foreground/70"}`}
                    >
                      {notification.body}
                    </p>
                  )}
                  <p className="pl-3 text-[11px] text-muted-foreground">{timeAgo(notification.createdAt)}</p>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
