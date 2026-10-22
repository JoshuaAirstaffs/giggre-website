"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { formatGigPoints, subscribeGigPointsBalance } from "@/lib/gig-points";

// A small header pill linking straight to /app/{role}/gig-points — mirrors
// giggre_app's GigPointsButton (home_screen.dart), which sits in the app's
// shared app bar (not gated by role) and opens the full screen directly on
// tap rather than a dropdown preview.
export default function GigPointsBadge({ role }: { role: "host" | "worker" }) {
  const uid = useAppSelector((root) => root.user.authUser?.uid);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    if (!uid) {
      // Resetting for a signed-out/switched account, not reacting to its own value.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBalance(0);
      return;
    }
    return subscribeGigPointsBalance(uid, (b) => setBalance(b.balance), () => {});
  }, [uid]);

  return (
    <Link
      href={`/app/${role}/gig-points`}
      className="flex h-9 items-center gap-1.5 rounded-full border border-hairline px-3 text-xs font-semibold text-amber-600 transition-colors hover:bg-amber-500/10"
    >
      <Star className="size-3.5 fill-amber-500 text-amber-500" />
      {formatGigPoints(balance)} pts
    </Link>
  );
}
