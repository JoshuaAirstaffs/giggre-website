"use client"

import { usePathname } from "next/navigation"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { findActiveUrl, type NavItem } from "@/components/nav-main"
import ThemeToggle from "./ThemeToggle"
import NotificationBell from "./NotificationBell"

export function SiteHeader({
  title = "Home",
  notifications = false,
  role,
  navItems,
}: {
  title?: string
  notifications?: boolean
  role?: "host" | "worker"
  // When provided, the header title tracks the current route (the matching
  // item's title, same matching logic NavMain uses to highlight the active
  // sidebar entry) instead of staying fixed at `title` for every page.
  navItems?: NavItem[]
}) {
  const pathname = usePathname()
  const activeUrl = navItems ? findActiveUrl(navItems, pathname) : null
  const activeItem = activeUrl ? navItems?.find((item) => item.url === activeUrl) : undefined
  const resolvedTitle = activeItem?.title ?? title

  const roleClassName =
    role === "host"
      ? "bg-(--host-tint) text-(--host-text)"
      : role === "worker"
        ? "bg-(--worker-tint) text-(--worker-text)"
        : ""

  return (
    <header
      className={`flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height) ${roleClassName}`}
    >
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />
        <div className="flex justify-between items-center w-full">
          <h1 className="text-base font-medium">{resolvedTitle}</h1>
          <div className="flex items-center gap-2">
            {notifications && <NotificationBell />}
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  )
}
