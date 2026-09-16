import { BriefcaseBusiness, Clock, Coins, LayoutDashboardIcon, Wrench } from "lucide-react";
import type { NavItem } from "@/components/nav-main";
import { sharedNavItems } from "@/components/shared-nav-items";

export const sidebarItems: NavItem[] = [
  {
    title: "Browse",
    url: "/app/worker/browse",
    icon: <LayoutDashboardIcon />,
  },
  {
    title: "My Earnings",
    url: "/app/worker/earnings",
    icon: <Coins />,
  },
   {
    title: "Gig History",
    url: "/app/worker/gig-history",
    icon: <Clock />,
  },
   {
    title: "My Toolchest",
    url: "/app/worker/toolchest",
    icon: <Wrench />,
  },
  {
    title: "My Applications",
    url: "/app/worker/applications",
    icon: <BriefcaseBusiness />,
  },
];

export const sharedItems: NavItem[] = sharedNavItems("/app/worker");
