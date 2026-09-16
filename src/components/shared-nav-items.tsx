import { Bell, FileText, MessageCircle, Settings } from "lucide-react";
import type { NavItem } from "@/components/nav-main";

// Pages that make sense for both roles (a single account's documents,
// notifications, chats, and settings aren't role-specific) — each role
// still gets its own route under its own layout/sidebar, just pointing at
// the same shared page component (see src/components/DocumentsPage.tsx,
// NotificationsPage.tsx, SettingsPage.tsx).
export function sharedNavItems(basePath: "/app/host" | "/app/worker"): NavItem[] {
  return [
    { title: "Documents", url: `${basePath}/documents`, icon: <FileText /> },
    { title: "Notifications", url: `${basePath}/notifications`, icon: <Bell /> },
    { title: "Chat", url: `${basePath}/chat`, icon: <MessageCircle /> },
    { title: "Settings", url: `${basePath}/settings`, icon: <Settings /> },
  ];
}
