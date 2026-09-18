"use client"

import * as React from "react"
import Image from "next/image"
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
import { Button } from "./ui/button"
import { useAppSelector } from "@/store/hooks"
import { subscribeUnreadRoomsCount } from "@/lib/chat"


export function AppSidebar({
  user,
  navItems,
  sharedItems,
  role,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: { name: string; email: string }
  navItems: NavItem[]
  sharedItems?: NavItem[]
  role?: "host" | "worker"
}) {
  const { profile, authUser } = useAppSelector((root) => root.user)
  const isVerified = profile?.isVerified === "verified"
  const pathname = usePathname()
  // Computed once across both groups combined so a shared-page URL (e.g.
  // /app/host/settings) doesn't also leave a role item (e.g. "Dashboard" at
  // /app/host, a prefix of every host route) highlighted at the same time.
  const activeUrl = findActiveUrl([...navItems, ...(sharedItems ?? [])], pathname)

  const [unreadChatCount, setUnreadChatCount] = React.useState(0)
  React.useEffect(() => {
    if (!authUser?.uid) {
      // Resetting for a signed-out/switched account, not reacting to its own value.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnreadChatCount(0)
      return
    }
    return subscribeUnreadRoomsCount(authUser.uid, setUnreadChatCount)
  }, [authUser?.uid])

  const sharedItemsWithBadges = React.useMemo(
    () => sharedItems?.map((item) => (item.title === "Chat" ? { ...item, badge: unreadChatCount } : item)),
    [sharedItems, unreadChatCount]
  )

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/" />}
            >
              <Image src="/assets/giggre_logo.png" alt="Giggre" width={120} height={57} className="h-6 w-auto" priority />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} activeUrl={activeUrl} role={role} />
        {sharedItemsWithBadges && sharedItemsWithBadges.length > 0 && (
          <NavMain items={sharedItemsWithBadges} label="General" activeUrl={activeUrl} role={role} />
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
