import { Bell, FileText, Gift, MessageCircle, Settings, ShieldOff, UserIcon } from "lucide-react";
import type { NavItem } from "@/components/nav-main";

// Pages that make sense for both roles (a single account's profile,
// documents, notifications, chats, and settings aren't role-specific) — each
// role still gets its own route under its own layout/sidebar, just pointing
// at the same shared page component (see src/app/app/host/profile/page.tsx,
// worker/profile/page.tsx, DocumentsPage.tsx, NotificationsPage.tsx,
// SettingsPage.tsx, BlockedUsersPage.tsx). Profile was previously reachable
// only from the NavUser account dropdown; listing it here too surfaces it
// directly in the sidebar.
export function sharedNavItems(basePath: "/app/host" | "/app/worker"): NavItem[] {
  return [
    { title: "Profile", url: `${basePath}/profile`, icon: <UserIcon /> },
    { title: "Documents", url: `${basePath}/documents`, icon: <FileText /> },
    { title: "Notifications", url: `${basePath}/notifications`, icon: <Bell /> },
    { title: "Chat", url: `${basePath}/chat`, icon: <MessageCircle /> },
    { title: "My Referrals", url: `${basePath}/referrals`, icon: <Gift /> },
    { title: "Blocked Users", url: `${basePath}/blocked-users`, icon: <ShieldOff /> },
    { title: "Settings", url: `${basePath}/settings`, icon: <Settings /> },
  ];
}
