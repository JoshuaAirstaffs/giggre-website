import { Clock, Coins, LayoutDashboardIcon, Wrench } from "lucide-react";
import type { NavItem } from "@/components/nav-main";

export const sidebarItems: NavItem[] = [
  {
    title: "Browse",
    url: "/home/worker/browse",
    icon: <LayoutDashboardIcon />,
  },
  {
    title: "My Earnings",
    url: "/home/worker/earnings",
    icon: <Coins />,
  },
   {
    title: "Gig History",
    url: "/home/worker/gig-history",
    icon: <Clock />,
  },
   {
    title: "My Toolchest",
    url: "/home/worker/toolchest",
    icon: <Wrench />,
  },
];
