import { AppSidebar } from "@/components/app-sidebar";
import NewMessageToaster from "@/components/NewMessageToaster";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { verifySession } from "@/lib/dal";
import { sidebarItems, sharedItems } from "./sidebarItems";

export default async function HostLayout({ children }: { children: React.ReactNode }) {
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
          "--primary": "var(--host-start)",
          "--primary-foreground": "var(--on-host)",
          "--ring": "var(--host-start)",
          "--sidebar-primary": "var(--host-start)",
          "--sidebar-primary-foreground": "var(--on-host)",
          "--sidebar-ring": "var(--host-start)",
          "--sidebar-border": "var(--host-start)",
        } as React.CSSProperties
      }
    >
      <AppSidebar user={user} navItems={sidebarItems} sharedItems={sharedItems} role="host" />
      <NewMessageToaster />
      <SidebarInset>
        <SiteHeader
          title={`Hello ${user.name}!`}
          navItems={[...sidebarItems, ...sharedItems]}
          notifications
          role="host"
        />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
