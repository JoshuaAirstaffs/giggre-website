"use client";

import ComingSoonPage from "@/components/ComingSoonPage";
// The full Notifications page (full history, reusing useNotifications)
// already exists at src/components/NotificationsPage.tsx — kept here, not
// deleted, but intentionally not wired in yet. Swap the import below back
// in once the page is ready to ship.
// import NotificationsPage from "@/components/NotificationsPage";

export default function WorkerNotificationsPage() {
  return <ComingSoonPage title="Notifications" description="Everything you've been notified about" />;
  // return <NotificationsPage />;
}
