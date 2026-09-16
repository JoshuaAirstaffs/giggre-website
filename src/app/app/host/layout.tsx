import { AppSidebar } from "@/components/app-sidebar";
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
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" user={user} navItems={sidebarItems} sharedItems={sharedItems} />
      <SidebarInset>
        <SiteHeader title="Host home" notifications />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
