"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export type NavItem = {
  title: string
  url: string
  icon?: React.ReactNode
  badge?: number
}

// A nested item's URL is often a path *under* another item's URL (e.g.
// host's "Dashboard" at /app/host and "My Gigs" at /app/host/my-gigs), so
// matching each item independently with startsWith() would light up both
// on a /app/host/my-gigs/* route. Only the longest (most specific) matching
// URL should be treated as active. Exported so a page rendering more than
// one NavMain group (e.g. AppSidebar's role items + shared items) can find
// the single best match across ALL groups combined, instead of each
// instance only ever seeing its own item list and independently
// highlighting its own best-within-itself match.
export function findActiveUrl(items: NavItem[], pathname: string): string | null {
  return items.reduce<string | null>((best, item) => {
    if (!item.url) return best
    const matches = pathname === item.url || pathname.startsWith(`${item.url}/`)
    if (!matches) return best
    if (!best || item.url.length > best.length) return item.url
    return best
  }, null)
}

export function NavMain({
  items,
  label,
  activeUrl,
  role,
}: {
  items: NavItem[]
  label?: string
  activeUrl?: string | null
  role?: "host" | "worker"
}) {
  const pathname = usePathname()

  // Callers rendering a single NavMain group can omit activeUrl and let it
  // compute its own; callers rendering multiple groups should pass one
  // shared activeUrl (from findActiveUrl over every group's items combined).
  const resolvedActiveUrl = activeUrl !== undefined ? activeUrl : findActiveUrl(items, pathname)

  // Host's brand color is yellow, worker's is blue — the active sidebar item
  // reflects whichever role's section is currently being viewed.
  const activeClassName =
    role === "host"
      ? "data-active:bg-host data-active:text-on-host"
      : role === "worker"
        ? "data-active:bg-worker data-active:text-on-worker"
        : "data-active:bg-sidebar-primary data-active:text-sidebar-primary-foreground"

  // Icons stay tinted with the role color at rest, then switch to match the
  // active item's foreground once its solid role-color background kicks in.
  const iconClassName =
    role === "host"
      ? "text-(--host-text) group-data-active/menu-button:text-on-host"
      : role === "worker"
        ? "text-(--worker-text) group-data-active/menu-button:text-on-worker"
        : ""

  const badgeClassName =
    role === "host"
      ? "bg-host text-on-host"
      : role === "worker"
        ? "bg-worker text-on-worker"
        : "bg-sidebar-primary text-sidebar-primary-foreground"

  return (
    <SidebarGroup>
      {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu className="gap-2">
          {items.map((item) => {
            const isActive = item.url !== "" && item.url === resolvedActiveUrl
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={isActive}
                  className={activeClassName}
                  render={<Link href={item.url} />}
                >
                  <span className={iconClassName}>{item.icon}</span>
                  <span>{item.title}</span>
                </SidebarMenuButton>
                {!!item.badge && (
                  <SidebarMenuBadge className={badgeClassName}>
                    {item.badge > 99 ? "99+" : item.badge}
                  </SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
