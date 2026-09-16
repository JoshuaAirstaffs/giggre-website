import { Briefcase, Heart, LayoutDashboard } from "lucide-react";
import type { NavItem } from "@/components/nav-main";
import { sharedNavItems } from "@/components/shared-nav-items";

// Posting a gig now lives under My Gigs (/app/host/my-gigs/post, reachable
// via the "Post a Gig" button there) instead of being its own top-level
// destination.
export const sidebarItems: NavItem[] = [
  {
    title: "Dashboard",
    url: "/app/host",
    icon: <LayoutDashboard />,
  },
  {
    title: "My Gigs",
    url: "/app/host/my-gigs",
    icon: <Briefcase />,
  },
  {
    title: "Favorites",
    url: "/app/host/favorites",
    icon: <Heart />,
  },
];

export const sharedItems: NavItem[] = sharedNavItems("/app/host");
