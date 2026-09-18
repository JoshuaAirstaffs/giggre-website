import { AppSidebar } from "@/components/app-sidebar";
import NewMessageToaster from "@/components/NewMessageToaster";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { verifySession } from "@/lib/dal";
import { sidebarItems, sharedItems } from "./navtems";

export default async function WorkerLayout({ children }: { children: React.ReactNode }) {
  const session = await verifySession();
  const user = {
    name: session.email?.split("@")[0] ?? "there",
    email: session.email ?? "",
  };
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
          "--primary": "var(--worker-start)",
          "--primary-foreground": "var(--on-worker)",
          "--ring": "var(--worker-start)",
          "--sidebar-primary": "var(--worker-start)",
          "--sidebar-primary-foreground": "var(--on-worker)",
          "--sidebar-ring": "var(--worker-start)",
          "--sidebar-border": "var(--worker-start)",
        } as React.CSSProperties
      }
    >
      <AppSidebar user={user} navItems={sidebarItems} sharedItems={sharedItems} role="worker" />
      <NewMessageToaster />
      <SidebarInset>
        <SiteHeader title={`Hello ${user.name}!`} notifications role="worker" />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
