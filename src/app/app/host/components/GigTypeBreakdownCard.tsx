"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type GigTypeKey } from "@/lib/earnings";
import { capitalize } from "@/lib/gig-format";
import type { HostGig } from "@/lib/host-gigs";

interface GigTypeBreakdownCardProps {
  gigs: HostGig[];
}

const TYPES: GigTypeKey[] = ["quick", "open", "offered"];

const DOT_CLASSES: Record<GigTypeKey, string> = {
  quick: "bg-(--quick-start)",
  open: "bg-worker",
  offered: "bg-(--offered-start)",
};

export default function GigTypeBreakdownCard({ gigs }: GigTypeBreakdownCardProps) {
  const total = gigs.length;

  return (
    <Card className="p-5">
      <CardHeader className="p-0">
        <CardTitle className="text-sm">Gig Types</CardTitle>
        <CardDescription>How your gigs break down by type</CardDescription>
      </CardHeader>
      <CardContent className="mt-3 space-y-3 p-0">
        {total === 0 ? (
          <p className="text-sm text-muted">No gigs posted yet.</p>
        ) : (
          TYPES.map((type) => {
            const count = gigs.filter((g) => g.gigType === type).length;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={type}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-ink">
                    <span className={`size-2 shrink-0 rounded-full ${DOT_CLASSES[type]}`} />
                    {capitalize(type)}
                  </span>
                  <span className="text-muted">{count}</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div className={`h-full rounded-full ${DOT_CLASSES[type]}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
