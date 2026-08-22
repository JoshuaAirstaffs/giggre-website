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

function timeAgo(date: Date) {
  const seconds = Math.max(0, (Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const uid = useAppSelector((root) => root.user.authUser?.uid);
  const { notifications, recentCount, loading, error } = useNotifications(uid);

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
        {recentCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
            {recentCount > 9 ? "9+" : recentCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end" sideOffset={8}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Notifications</DropdownMenuLabel>
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
            {notifications.map((notification) => (
              <DropdownMenuItem key={notification.id} className="flex-col items-start gap-0.5 py-2">
                <span className="truncate font-medium text-ink">{notification.title}</span>
                {notification.body && (
                  <p className="line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>
                )}
                <p className="text-[11px] text-muted-foreground">{timeAgo(notification.createdAt)}</p>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
