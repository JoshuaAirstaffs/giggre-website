"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Briefcase, Calendar, Check, Clock, MapPin } from "lucide-react";
import TitlePage from "@/components/TitlePage";
import JoshDiv from "@/components/DivAnimation";
import WorkingTimer from "@/components/WorkingTimer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import { capitalize, formatPostedAge, formatSchedule, salary } from "@/lib/gig-format";
import {
  CANCELLABLE_GIG_STATUSES,
  subscribeAcceptedApplications,
  subscribeOpenGigs,
  withdrawApplication,
  type AcceptedApplication,
  type Gig,
} from "@/lib/browse-gigs";
import CancelApplicationDialog from "./components/CancelApplicationDialog";

// Applications aren't a separate collection — a "pending application" is just
// an open_gigs doc that still has this worker's entry in its `applicants`
// array (see applyToOpenGig / withdrawApplication in lib/browse-gigs.ts).
// Once a host accepts, the entry moves to the gig's `workerId` field (or a
// `workers/{uid}` sub-doc for multi-slot gigs) and shows up in the "Accepted"
// section below instead — read-only here; its status only advances through
// the mobile app's WorkingUI, so there's no button on the web to change it.

// The gig's happy-path lifecycle once accepted — see ACTIVE_GIG_STATUSES in
// lib/browse-gigs.ts. 'cancellation_requested' can branch off from any of
// these, so it's shown as its own state rather than a step in this line.
const PROGRESS_STEPS = [
  { status: "navigating", label: "Navigating" },
  { status: "arrived", label: "Arrived" },
  { status: "working", label: "Working" },
  { status: "task_complete", label: "Complete" },
  { status: "payment", label: "Paid" },
];

function GigProgressSteps({ status }: { status: string }) {
  if (status === "cancellation_requested") {
    return (
      <Badge variant="secondary" className="bg-destructive/10 text-destructive">
        Cancellation requested
      </Badge>
    );
  }

  const currentIndex = PROGRESS_STEPS.findIndex((step) => step.status === status);

  return (
    <div className="flex items-center">
      {PROGRESS_STEPS.map((step, i) => {
        const done = currentIndex > i;
        const active = currentIndex === i;
        return (
          <div key={step.status} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex size-5 items-center justify-center rounded-full border text-[10px] font-semibold",
                  done && "border-(--success-text) bg-(--success-text) text-white",
                  active && "border-(--worker-end) bg-(--worker-end) text-white",
                  !done && !active && "border-hairline text-muted"
                )}
              >
                {done ? <Check className="size-3" /> : i + 1}
              </div>
              <span className={cn("text-[10px] whitespace-nowrap", active ? "font-semibold text-ink" : "text-muted")}>
                {step.label}
              </span>
            </div>
            {i < PROGRESS_STEPS.length - 1 && (
              <div className={cn("mx-1 h-px w-6 sm:w-10", done ? "bg-(--success-text)" : "bg-hairline")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function MyApplicationsPage() {
  const uid = useAppSelector((root) => root.user.authUser?.uid);
  const [openGigs, setOpenGigs] = useState<Gig[]>([]);
  const [pendingLoaded, setPendingLoaded] = useState(false);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const [accepted, setAccepted] = useState<AcceptedApplication[]>([]);
  const [acceptedLoaded, setAcceptedLoaded] = useState(false);
  const [acceptedError, setAcceptedError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AcceptedApplication | null>(null);

  useEffect(() => {
    if (!uid) return;
    const unsubscribe = subscribeOpenGigs(
      uid,
      (gigs) => {
        setOpenGigs(gigs);
        setPendingLoaded(true);
      },
      (err) => {
        console.error("Failed to load applications:", err);
        setPendingError("Couldn't load your applications. Please try again.");
        setPendingLoaded(true);
      }
    );
    return unsubscribe;
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const unsubscribe = subscribeAcceptedApplications(
      uid,
      (apps) => {
        setAccepted(apps);
        setAcceptedLoaded(true);
      },
      (err) => {
        console.error("Failed to load accepted applications:", err);
        setAcceptedError("Couldn't load your accepted gigs. Please try again.");
        setAcceptedLoaded(true);
      }
    );
    return unsubscribe;
  }, [uid]);

  const loading = !pendingLoaded || !acceptedLoaded;

  const pending = useMemo(() => {
    if (!uid) return [];
    return openGigs
      .filter((gig) => gig.applicants.some((a) => a.workerId === uid))
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  }, [openGigs, uid]);

  async function handleWithdraw(gig: Gig) {
    if (!uid) return;
    if (!window.confirm("Withdraw this application? You can take it again later if the gig is still open.")) return;
    setWithdrawingId(gig.id);
    try {
      const result = await withdrawApplication(gig.id, uid);
      if (result.ok) toast.success("Application withdrawn.");
      else toast.warning(result.reason);
    } catch (err) {
      console.error("Failed to withdraw application:", err);
      toast.error("Couldn't withdraw your application. Please try again.");
    } finally {
      setWithdrawingId(null);
    }
  }

  const isEmpty = pending.length === 0 && accepted.length === 0;

  return (
    <JoshDiv>
      <TitlePage title="My Applications" description="Gigs you've applied to, and how they're progressing" />

      <div className="mt-6">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
        ) : pendingError || acceptedError ? (
          <p className="text-sm text-destructive">{pendingError ?? acceptedError}</p>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Briefcase className="size-10 text-muted" />
            <p className="font-medium text-ink">No applications yet</p>
            <p className="text-sm text-muted">Gigs you apply to on the Browse page will show up here</p>
            <Button
              className="mt-3 bg-worker text-white hover:bg-(--worker-end)"
              render={<Link href="/app/worker/browse" />}
              nativeButton={false}
            >
              Browse open gigs
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            {accepted.length > 0 && (
              <div className="space-y-3">
                {/* A worker can only ever have one active gig at a time
                    (see workerHasActiveGig in lib/browse-gigs.ts), so the
                    count-y section header is only useful in the rare case
                    there's more than one to distinguish. */}
                {accepted.length > 1 && (
                  <p className="text-sm font-medium text-ink">
                    Accepted — in progress ({accepted.length})
                  </p>
                )}
                {accepted.map((app) => (
                  <Card key={app.gigId} className="p-4">
                    <CardContent className="flex flex-col gap-3 p-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">{app.title}</p>
                          {app.hostName && <p className="text-xs text-muted">by {app.hostName}</p>}
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-ink">{salary(app.currencyCode, app.budget)}/day</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="overflow-x-auto pb-1">
                          <GigProgressSteps status={app.status} />
                        </div>
                        {app.status === "working" && app.workStartedAt && (
                          <WorkingTimer startedAt={app.workStartedAt} />
                        )}
                      </div>

                      <div className="space-y-1.5">
                        {app.address && (
                          <div className="flex items-center gap-1 text-xs text-muted">
                            <MapPin className="size-3 shrink-0" />
                            <p className="truncate">{app.address}</p>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-xs text-muted">
                          <Calendar className="size-3 shrink-0" />
                          <p>{formatSchedule(app.scheduledDate)}</p>
                        </div>
                      </div>

                      {CANCELLABLE_GIG_STATUSES.includes(app.status) && (
                        <div className="pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-destructive/40 text-destructive hover:bg-destructive/10"
                            onClick={() => setCancelTarget(app)}
                          >
                            Cancel Application
                          </Button>
                          <p className="mt-1.5 text-[11px] text-muted">
                            Cancelling after being selected may affect your worker rating
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {pending.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-ink">
                  Pending ({pending.length})
                </p>
                {pending.map((gig) => (
                  <Card key={gig.id} className="p-4">
                    <CardContent className="flex flex-wrap items-start justify-between gap-4 p-0">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-ink">{gig.title}</p>
                          <span className="shrink-0 text-sm font-semibold text-ink">{salary(gig.currencyCode, gig.budget)}/day</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="secondary" className="bg-(--worker-tint) text-(--worker-text)">
                            Pending
                          </Badge>
                          {gig.hostName && <p className="text-xs text-muted">by {gig.hostName}</p>}
                        </div>
                        {gig.address && (
                          <div className="flex items-center gap-1 text-xs text-muted">
                            <MapPin className="size-3 shrink-0" />
                            <p className="truncate">{gig.address}</p>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-xs text-muted">
                          <Calendar className="size-3 shrink-0" />
                          <p>{formatSchedule(gig.scheduledDate)}</p>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted">
                          <Clock className="size-3 shrink-0" />
                          <p>
                            Posted {formatPostedAge(gig.createdAt)} · {capitalize(gig.experienceLevel)} ·{" "}
                            {gig.applicantCount} applicant{gig.applicantCount === 1 ? "" : "s"} so far
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        className="border-destructive/40 text-destructive hover:bg-destructive/10"
                        disabled={withdrawingId === gig.id}
                        onClick={() => handleWithdraw(gig)}
                      >
                        Withdraw
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <CancelApplicationDialog
        application={cancelTarget}
        workerId={uid}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
      />
    </JoshDiv>
  );
}
