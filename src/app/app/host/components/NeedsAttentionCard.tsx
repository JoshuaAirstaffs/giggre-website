"use client";

import Link from "next/link";
import { Banknote, Users, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isActiveGigStatus, type HostGig } from "@/lib/host-gigs";

interface AttentionItem {
  gig: HostGig;
  icon: LucideIcon;
  label: string;
}

interface NeedsAttentionCardProps {
  gigs: HostGig[];
}

// Surfaces gig-level signals only — reliable for both single- and
// multi-slot gigs (pending applicants live on the parent doc either way),
// except the payment-step detection, which only ever shows up at the
// gig-level `status` for single-recipient gigs. A multi-slot gig's
// individual workers reaching task_complete/payment isn't visible here
// (that state lives on each worker's own subcollection doc) — a host still
// sees it on that gig's own detail page, just not surfaced on this list yet.
export default function NeedsAttentionCard({ gigs }: NeedsAttentionCardProps) {
  const items: AttentionItem[] = [];

  for (const gig of gigs) {
    // A cancelled/declined/no_worker/filled gig can still have leftover
    // entries in `applicantCount` — nothing ever clears `applicants` once a
    // gig stops accepting them (see selectApplicantForOpenGig's research
    // notes), so a straggler applicant on an already-fully-staffed gig must
    // not resurrect it here. Checking `status !== "filled"` explicitly
    // rather than relying solely on the filledSlotCount/workerSlots
    // comparison staying perfectly in sync with it.
    const hasOpenSlots = gig.filledSlotCount < gig.workerSlots;
    if (gig.gigType === "open" && isActiveGigStatus(gig.status) && gig.status !== "filled" && hasOpenSlots) {
      if (gig.applicantCount > 0) {
        items.push({
          gig,
          icon: Users,
          label: `${gig.applicantCount} applicant${gig.applicantCount === 1 ? "" : "s"} to review`,
        });
      } else if (gig.status === "partially_filled") {
        // Still actively staffing (some slots filled, some not) but no one
        // to review right now — worth a nudge to go find more workers,
        // distinct from a fresh "open" gig that just hasn't drawn any
        // applicants at all yet (nothing actionable there).
        const remaining = gig.workerSlots - gig.filledSlotCount;
        items.push({
          gig,
          icon: Users,
          label: `Still needs ${remaining} more worker${remaining === 1 ? "" : "s"}`,
        });
      }
    }
    if (gig.status === "task_complete") {
      items.push({ gig, icon: Banknote, label: "Confirm cash payment" });
    } else if (gig.status === "payment") {
      items.push({ gig, icon: Banknote, label: "Awaiting worker to confirm payment" });
    }
  }

  return (
    <Card className="p-5">
      <CardHeader className="p-0">
        <CardTitle className="text-sm">Needs Your Attention</CardTitle>
        <CardDescription>Gigs with pending applicants or payment steps</CardDescription>
      </CardHeader>
      <CardContent className="mt-3 space-y-2 p-0">
        {items.length === 0 ? (
          <p className="text-sm text-muted">Nothing needs your attention right now.</p>
        ) : (
          items.map(({ gig, icon: Icon, label }, i) => (
            <Link
              key={`${gig.id}-${i}`}
              href={`/app/host/my-gigs/${gig.gigType}/${gig.id}`}
              className="flex items-center gap-3 rounded-lg border border-hairline px-3 py-2 transition-colors hover:bg-accent"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-(--host-tint) text-(--host-text)">
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{gig.title}</p>
                <p className="text-xs text-muted">{label}</p>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
