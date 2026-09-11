import { Briefcase, CirclePlusIcon } from "lucide-react";
import type { NavItem } from "@/components/nav-main";

export const sidebarItems: NavItem[] = [
  {
    title: "Post a gig",
    url: "/app/host/post",
    icon: <CirclePlusIcon />,
  },
  {
    title: "My Gigs",
    url: "/app/host/my-gigs",
    icon: <Briefcase />,
  },
];
