"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatSchedule } from "@/lib/gig-format";
import type { HostGig } from "@/lib/host-gigs";

interface UpcomingGigsCardProps {
  gigs: HostGig[];
}

export default function UpcomingGigsCard({ gigs }: UpcomingGigsCardProps) {
  // Read once per mount via a lazy initializer rather than calling Date.now()
  // directly in the render body (same pattern as WorkingTimer.tsx).
  const [now] = useState(() => Date.now());
  const upcoming = gigs
    .filter((g) => g.scheduledDate && g.scheduledDate.getTime() >= now)
    .sort((a, b) => (a.scheduledDate?.getTime() ?? 0) - (b.scheduledDate?.getTime() ?? 0))
    .slice(0, 5);

  return (
    <Card className="p-5">
      <CardHeader className="p-0">
        <CardTitle className="text-sm">Upcoming Gigs</CardTitle>
        <CardDescription>Your next scheduled gigs</CardDescription>
      </CardHeader>
      <CardContent className="mt-3 space-y-2 p-0">
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted">No upcoming gigs scheduled.</p>
        ) : (
          upcoming.map((gig) => (
            <Link
              key={gig.id}
              href={`/app/host/my-gigs/${gig.gigType}/${gig.id}`}
              className="flex items-center gap-3 rounded-lg border border-hairline px-3 py-2 transition-colors hover:bg-accent"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted">
                <Calendar className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{gig.title}</p>
                <p className="text-xs text-muted">{formatSchedule(gig.scheduledDate)}</p>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
