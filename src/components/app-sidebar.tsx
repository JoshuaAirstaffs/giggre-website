"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { NavMain, findActiveUrl, type NavItem } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { CommandIcon } from "lucide-react"
import { Button } from "./ui/button"
import { useAppSelector } from "@/store/hooks"


export function AppSidebar({
  user,
  navItems,
  sharedItems,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: { name: string; email: string }
  navItems: NavItem[]
  sharedItems?: NavItem[]
}) {
  const { profile } = useAppSelector((root) => root.user)
  const isVerified = profile?.isVerified === "verified"
  const pathname = usePathname()
  // Computed once across both groups combined so a shared-page URL (e.g.
  // /app/host/settings) doesn't also leave a role item (e.g. "Dashboard" at
  // /app/host, a prefix of every host route) highlighted at the same time.
  const activeUrl = findActiveUrl([...navItems, ...(sharedItems ?? [])], pathname)

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/" />}
            >
              <CommandIcon className="size-5!" />
              <span className="text-base font-semibold">Giggre</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} activeUrl={activeUrl} />
        {sharedItems && sharedItems.length > 0 && (
          <NavMain items={sharedItems} label="General" activeUrl={activeUrl} />
        )}
      </SidebarContent>
      <SidebarFooter>
        {/* {!isVerified && (
          <Alert className="max-w-md border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-50">
            <AlertTitle>Account not verified</AlertTitle>
            <AlertDescription className="text-xs">
              Request to admin for veriification
            </AlertDescription>
            <AlertAction>
              <Button size="xs" variant="default" className="bg-(--worker-end)">
                Request
              </Button>
            </AlertAction>
          </Alert>
        )} */}
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
