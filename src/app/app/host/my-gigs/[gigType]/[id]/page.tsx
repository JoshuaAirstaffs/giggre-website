"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  BadgeCheck,
  Banknote,
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Heart,
  MapPin,
  Navigation,
  Star,
  User,
  Users,
  Wallet,
} from "lucide-react";
import JoshDiv from "@/components/DivAnimation";
import WorkingTimer from "@/components/WorkingTimer";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { capitalize, formatSchedule, salary } from "@/lib/gig-format";
import { GIG_TYPE_BADGE_CLASSES, type GigTypeKey } from "@/lib/earnings";
import {
  selectApplicantForOpenGig,
  subscribeHostGigDetail,
  toggleFavoriteWorker,
  type HostGigApplicantEntry,
  type HostGigDetail,
  type HostGigWorkerEntry,
} from "@/lib/host-gigs";
import { useFavoriteWorkerIds } from "@/hooks/use-favorite-worker-ids";
import { useAppSelector } from "@/store/hooks";
import CashPaymentDialog from "../../components/CashPaymentDialog";
import ViewPaymentCodeDialog from "../../components/ViewPaymentCodeDialog";
import GigLocationMap from "../../components/GigLocationMap";
import WorkerTrackingMap from "../../components/WorkerTrackingMap";

function formatStatus(status: string) {
  return capitalize(status.replace(/_/g, " "));
}

function isGigType(value: string): value is GigTypeKey {
  return value === "quick" || value === "open" || value === "offered";
}

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

function SectionLabel({ icon: Icon, children }: { icon: typeof User; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
      <Icon className="size-3.5 shrink-0" />
      {children}
    </p>
  );
}

// Purely presentational — color-codes each worker's status pill by what
// phase of the journey it's in, instead of one uniform gray badge, so the
// Workers list reads at a glance.
const WORKER_STATUS_CLASSES: Record<string, string> = {
  navigating: "bg-(--worker-tint) text-(--worker-text)",
  arrived: "bg-(--worker-tint) text-(--worker-text)",
  working: "bg-(--host-tint) text-(--host-text)",
  task_complete: "bg-(--host-tint) text-(--host-text)",
  payment: "bg-(--offered-tint) text-(--offered-text)",
  completed: "bg-(--success-tint) text-(--success-text)",
  declined: "bg-(--danger-tint) text-(--danger-text)",
  cancelled: "bg-(--danger-tint) text-(--danger-text)",
  no_worker: "bg-(--danger-tint) text-(--danger-text)",
};

// Same per-status icons the host app's own progress tracker uses
// (_GigProgressCard._stepIcons in gig_progress_tracker.dart) — declined /
// cancelled / no_worker have no icon there either, just the red color above.
const WORKER_STATUS_ICONS: Partial<Record<string, typeof User>> = {
  navigating: Navigation,
  arrived: MapPin,
  working: Briefcase,
  task_complete: CheckCircle2,
  payment: CreditCard,
  completed: BadgeCheck,
};

// Same idea for the Timeline card's dots — a color per milestone instead of
// one uniform worker-blue marker.
const TIMELINE_DOT_CLASSES: Record<string, string> = {
  "Gig posted": "bg-worker",
  "Search started": "bg-worker",
  "Dispatched to a worker": "bg-(--host-start)",
  "Worker selected": "bg-(--host-start)",
  "Work completed": "bg-(--success-text)",
  Completed: "bg-(--success-text)",
  "Cancellation requested": "bg-destructive",
  Cancelled: "bg-destructive",
};

function StatTile({ icon: Icon, label, value }: { icon: typeof User; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-hairline bg-card px-3.5 py-2.5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted">{label}</p>
        <p className="truncate text-sm font-semibold text-ink">{value}</p>
      </div>
    </div>
  );
}

export default function HostGigDetailPage({ params }: { params: Promise<{ gigType: string; id: string }> }) {
  const { gigType: rawGigType, id } = use(params);
  const [gig, setGig] = useState<HostGigDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [confirmApplicant, setConfirmApplicant] = useState<HostGigApplicantEntry | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<HostGigWorkerEntry | null>(null);
  const [viewCodeTarget, setViewCodeTarget] = useState<HostGigWorkerEntry | null>(null);
  const [favoritingId, setFavoritingId] = useState<string | null>(null);
  // Workers default to expanded — this just tracks who's been collapsed,
  // rather than who's been expanded, so a newly-appearing worker starts open.
  const [collapsedWorkerIds, setCollapsedWorkerIds] = useState<Set<string>>(new Set());
  // workerId -> a nonce that changes every time that worker's status
  // changes, so the row remounts (see the `key` below) and its glow
  // animation plays again — a plain re-render wouldn't restart a finished
  // CSS animation since the class name itself doesn't change.
  const [statusGlowNonces, setStatusGlowNonces] = useState<Map<string, number>>(new Map());
  const prevWorkerStatusesRef = useRef<Map<string, string> | null>(null);

  const hostId = useAppSelector((root) => root.user.authUser?.uid);
  const favoriteIds = useFavoriteWorkerIds(hostId);

  const gigType = isGigType(rawGigType) ? rawGigType : null;

  function toggleWorkerCollapsed(workerId: string) {
    setCollapsedWorkerIds((prev) => {
      const next = new Set(prev);
      if (next.has(workerId)) next.delete(workerId);
      else next.add(workerId);
      return next;
    });
  }

  async function handleToggleFavorite(worker: HostGigWorkerEntry) {
    if (!hostId) return;
    const isFavorite = favoriteIds.has(worker.workerId);
    setFavoritingId(worker.workerId);
    try {
      const result = await toggleFavoriteWorker(hostId, worker.workerId, isFavorite);
      if (!result.ok) toast.error(result.reason);
    } catch (err) {
      console.error("Failed to update favorites:", err);
      toast.error("Couldn't update favorites. Please try again.");
    } finally {
      setFavoritingId(null);
    }
  }

  // Selecting an applicant no longer needs a manual re-fetch afterward — the
  // live subscription below picks up the resulting gig-doc/workers-
  // subcollection writes on its own.
  async function confirmSelectApplicant() {
    if (!gig || !confirmApplicant) return;
    const applicant = confirmApplicant;
    setSelectingId(applicant.workerId);
    try {
      const result = await selectApplicantForOpenGig(gig, applicant);
      if (result.ok) {
        toast.success(`${applicant.workerName} has been selected.`);
      } else {
        toast.error(result.reason);
      }
    } catch (err) {
      console.error("Failed to select applicant:", err);
      toast.error("Couldn't select this worker. Please try again.");
    } finally {
      setSelectingId(null);
      setConfirmApplicant(null);
    }
  }

  useEffect(() => {
    if (!gigType) {
      // Resetting local state before bailing out, not reacting to it.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("Unknown gig type.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeHostGigDetail(
      gigType,
      id,
      (fetched) => {
        if (!fetched) setError("This gig couldn't be found.");
        else setGig(fetched);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load gig details:", err);
        setError("Couldn't load this gig. Please try again.");
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [gigType, id]);

  // Flags whichever workers just had a status change (a host looking at the
  // page while, say, a worker moves from 'arrived' to 'working' should see
  // that update happen, not just silently find the badge different later).
  useEffect(() => {
    if (!gig) return;
    const prev = prevWorkerStatusesRef.current;
    if (prev) {
      const changedIds = gig.workers
        .filter((w) => {
          const prevStatus = prev.get(w.workerId);
          return prevStatus !== undefined && prevStatus !== w.status;
        })
        .map((w) => w.workerId);
      if (changedIds.length > 0) {
        const now = Date.now();
        setStatusGlowNonces((current) => {
          const next = new Map(current);
          for (const id of changedIds) next.set(id, now);
          return next;
        });
      }
    }
    prevWorkerStatusesRef.current = new Map(gig.workers.map((w) => [w.workerId, w.status]));
  }, [gig]);

  const navigatingWorkers = gig?.workers.filter((w) => w.status === "navigating" && w.workerLocation) ?? [];

  return (
    <JoshDiv>
      <Button
        variant="ghost"
        size="sm"
        className="mb-2 -ml-2 gap-1.5"
        render={<Link href="/app/host/my-gigs" />}
        nativeButton={false}
      >
        <ArrowLeft className="size-4" />
        Back to My Gigs
      </Button>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : error || !gig ? (
        <p className="text-sm text-destructive">{error ?? "This gig couldn't be found."}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-baseline gap-2">
                <h1 className="text-2xl font-bold text-ink">{gig.title}</h1>
                <span className="text-xs text-muted">#{gig.id.slice(-6).toUpperCase()}</span>
              </div>
              <p className="flex items-center gap-1.5 text-sm text-muted">
                <Calendar className="size-3.5 shrink-0" />
                Posted {formatSchedule(gig.createdAt)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className={GIG_TYPE_BADGE_CLASSES[gig.gigType]}>
                {capitalize(gig.gigType)}
              </Badge>
              <Badge variant="secondary">{formatStatus(gig.status)}</Badge>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <StatTile icon={Users} label="Workers" value={`${gig.filledSlotCount} / ${gig.workerSlots}`} />
            <StatTile icon={Wallet} label="Rate / worker" value={salary(gig.currencyCode, gig.ratePerSlot)} />
            <StatTile icon={Banknote} label="Total budget" value={salary(gig.currencyCode, gig.budget)} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-5">
            <div className="space-y-4 lg:col-span-3">
              <Card className="p-5">
                <CardHeader className="p-0">
                  <CardTitle className="text-sm">Workers</CardTitle>
                  <CardDescription>
                    Skills, progress, and payment status for each assigned worker
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-3 space-y-2 p-0">
                  {navigatingWorkers.length > 0 && gig.location && (
                    <div className="mb-3">
                      <WorkerTrackingMap
                        workers={navigatingWorkers.map((w) => ({
                          workerId: w.workerId,
                          workerName: w.workerName,
                          location: w.workerLocation!,
                          photoUrl: w.photoUrl,
                        }))}
                        destination={gig.location}
                      />
                    </div>
                  )}
                  {gig.workers.length === 0 ? (
                    <p className="text-sm text-muted">No worker assigned.</p>
                  ) : (
                    <div className="space-y-2">
                      {gig.workers.map((w) => {
                        const expanded = !collapsedWorkerIds.has(w.workerId);
                        return (
                          <div
                            key={`${w.workerId}-${statusGlowNonces.get(w.workerId) ?? "static"}`}
                            className={`rounded-lg border border-hairline px-3 py-2 ${
                              statusGlowNonces.has(w.workerId) ? "worker-status-glow" : ""
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleWorkerCollapsed(w.workerId)}
                              className="flex w-full items-center justify-between gap-2 text-left"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <Avatar size="sm">
                                  <AvatarImage src={w.photoUrl || undefined} alt={w.workerName} />
                                  <AvatarFallback className="text-xs">{initials(w.workerName)}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <span className="flex items-center gap-1 truncate text-sm text-ink">
                                    {w.workerName}
                                    {w.isVerified && (
                                      <BadgeCheck
                                        className="size-3.5 shrink-0 fill-(--worker-end) text-white"
                                        aria-label="Verified"
                                      >
                                        <title>Verified</title>
                                      </BadgeCheck>
                                    )}
                                  </span>
                                  {w.skills.length > 0 && (
                                    <div className="mt-0.5 flex flex-wrap gap-1">
                                      {w.skills.map((skill) => (
                                        <Badge key={skill} variant="secondary" className="text-xs">
                                          {skill}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-1.5">
                                {w.status === "working" && w.workStartedAt && (
                                  <WorkingTimer startedAt={w.workStartedAt} />
                                )}
                                {w.status === "completed" && (
                                  <Badge className="bg-(--success-tint) text-(--success-text)">
                                    <Banknote />
                                    Paid
                                  </Badge>
                                )}
                                <Badge variant="secondary" className={WORKER_STATUS_CLASSES[w.status] ?? ""}>
                                  {(() => {
                                    const StatusIcon = WORKER_STATUS_ICONS[w.status];
                                    return StatusIcon && <StatusIcon />;
                                  })()}
                                  {formatStatus(w.status)}
                                </Badge>
                                <ChevronDown
                                  className={`size-4 shrink-0 text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
                                />
                              </div>
                            </button>

                            {expanded && (
                              <>
                                {w.status === "navigating" && !w.workerLocation && (
                                  <div className="mt-2 border-t border-hairline pt-2">
                                    <p className="text-xs text-muted">Waiting for {w.workerName}&apos;s location…</p>
                                  </div>
                                )}
                                {(w.timeline?.length ?? 0) > 0 && (
                                  <div className="mt-2 space-y-1.5 border-t border-hairline pt-2 pl-1">
                                    {w.timeline.map((entry, i) => (
                                      <div key={i} className="flex items-center gap-2">
                                        <div className="size-1.5 shrink-0 rounded-full bg-worker" />
                                        <p className="text-xs text-ink">{entry.label}</p>
                                        <p className="text-xs text-muted">{formatSchedule(entry.at)}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {w.status === "task_complete" && (
                                  <div className="mt-2 border-t border-hairline pt-2">
                                    <Button
                                      size="sm"
                                      onClick={() => setPaymentTarget(w)}
                                      className="bg-(--success-start) text-white hover:bg-(--success-end)"
                                    >
                                      Gig Complete
                                    </Button>
                                  </div>
                                )}
                                {w.status === "payment" && w.paymentCode && (
                                  <div className="mt-2 border-t border-hairline pt-2">
                                    <Button size="sm" variant="outline" onClick={() => setViewCodeTarget(w)}>
                                      Show Payment Code
                                    </Button>
                                  </div>
                                )}
                                {w.status === "completed" && (
                                  <div className="mt-2 flex items-center justify-between gap-2 border-t border-hairline pt-2">
                                    {w.ratingCount > 0 ? (
                                      <span className="flex items-center gap-1 text-sm text-ink">
                                        <Star className="size-3.5 shrink-0 fill-(--host-start) text-(--host-start)" />
                                        {w.ratingAsWorker.toFixed(1)} / 5
                                      </span>
                                    ) : (
                                      <span />
                                    )}
                                    <button
                                      type="button"
                                      disabled={favoritingId !== null}
                                      onClick={() => handleToggleFavorite(w)}
                                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${
                                        favoriteIds.has(w.workerId)
                                          ? "border-destructive/40 bg-destructive/10 text-destructive"
                                          : "border-hairline text-muted hover:bg-accent"
                                      }`}
                                    >
                                      <Heart
                                        className={`size-3.5 shrink-0 ${favoriteIds.has(w.workerId) ? "fill-destructive" : ""}`}
                                      />
                                      {favoriteIds.has(w.workerId) ? "In Favorites" : `Add to Favorites`}
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {gig.gigType === "open" && gig.applicants.length > 0 && (
                    <>
                      <Separator className="my-3" />
                      <SectionLabel icon={Users}>
                        Applicants ({gig.applicants.length})
                      </SectionLabel>
                      <div className="space-y-2">
                        {gig.applicants.map((a) => {
                          const canSelect = gig.filledSlotCount < gig.workerSlots;
                          return (
                            <div
                              key={a.workerId}
                              className="flex items-center gap-2 rounded-lg border border-hairline px-3 py-2"
                            >
                              <Avatar size="sm">
                                <AvatarImage src={a.photoUrl || undefined} alt={a.workerName} />
                                <AvatarFallback className="text-xs">{initials(a.workerName)}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <div>
                                  <span className="truncate text-sm text-ink">{a.workerName}</span>
                                  {a.isVerified && (
                                    <BadgeCheck
                                      className="ml-1 inline size-3.5 shrink-0 fill-(--worker-end) text-white"
                                      aria-label="Verified"
                                    >
                                      <title>Verified</title>
                                    </BadgeCheck>
                                  )}
                                  {a.ratingCount > 0 && (
                                    <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-muted">
                                      <Star className="size-3 shrink-0 fill-worker text-worker" />
                                      {a.ratingAsWorker.toFixed(1)}
                                    </span>
                                  )}
                                </div>
                                {a.skills.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {a.skills.map((skill) => (
                                      <Badge key={skill} variant="secondary" className="text-xs">
                                        {skill}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                              {canSelect ? (
                                <Button
                                  size="sm"
                                  disabled={selectingId !== null}
                                  onClick={() => setConfirmApplicant(a)}
                                  className="shrink-0 bg-(--success-start) text-white hover:bg-(--success-end)"
                                >
                                  {selectingId === a.workerId ? "Selecting…" : "Select"}
                                </Button>
                              ) : (
                                <Badge variant="secondary" className="shrink-0">
                                  Not selected
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="p-5">
                <CardHeader className="p-0">
                  <CardTitle className="text-sm">Payment &amp; Slots</CardTitle>
                  <CardDescription>Budget breakdown and slot utilization for this gig</CardDescription>
                </CardHeader>
                <CardContent className="mt-3 p-0">
                  <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted">Rate / worker</p>
                      <p className="font-semibold text-ink">{salary(gig.currencyCode, gig.ratePerSlot)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted">Total budget</p>
                      <p className="font-semibold text-ink">{salary(gig.currencyCode, gig.budget)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted">Slots filled</p>
                      <p className="font-semibold text-ink">
                        {gig.filledSlotCount} of {gig.workerSlots}
                      </p>
                      <p className="text-xs text-muted">
                        {Math.round((gig.filledSlotCount / gig.workerSlots) * 100)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted">Completed</p>
                      <p className="font-semibold text-ink">{gig.slotsCompleted}</p>
                      <p className="text-xs text-muted">worker{gig.slotsCompleted === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="p-5">
                <CardHeader className="p-0">
                  <CardTitle className="text-sm">Gig Timeline</CardTitle>
                  <CardDescription>Every milestone recorded for this gig, newest first</CardDescription>
                </CardHeader>
                <CardContent className="mt-3 p-0">
                  {gig.timeline.length === 0 ? (
                    <p className="text-sm text-muted">No activity recorded yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {gig.timeline.map((entry, i) => (
                        <div key={i} className="flex items-start justify-between gap-2.5">
                          <div className="flex items-start gap-2.5">
                            <div
                              className={`mt-1.5 size-2 shrink-0 rounded-full ${TIMELINE_DOT_CLASSES[entry.label] ?? "bg-worker"}`}
                            />
                            <div>
                              <p className="text-sm font-medium text-ink">{entry.label}</p>
                              <p className="text-xs text-muted">{formatSchedule(entry.at)}</p>
                            </div>
                          </div>
                          <Badge variant="secondary" className="shrink-0 bg-(--success-tint) text-(--success-text)">
                            Done
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4 lg:col-span-2">
              <Card className="p-5">
                <CardHeader className="p-0">
                  <CardTitle className="text-sm">Gig Overview</CardTitle>
                </CardHeader>
                <CardContent className="mt-3 space-y-3 p-0">
                  <p className="text-sm text-ink">{gig.description || "No description provided."}</p>
                  <Separator />
                  <div className="space-y-2 text-sm">
                    {gig.gigType === "quick" && (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted">Category</span>
                          <span className="font-medium text-ink">{gig.category || "—"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted">Duration</span>
                          <span className="font-medium text-ink">{gig.duration || "—"}</span>
                        </div>
                      </>
                    )}
                    {gig.gigType === "open" && (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted">Required skill</span>
                          <span className="font-medium text-ink">{gig.requiredSkills?.join(", ") || "—"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted">Experience level</span>
                          <span className="font-medium text-ink">{capitalize(gig.experienceLevel) || "—"}</span>
                        </div>
                      </>
                    )}
                    {gig.gigType === "offered" && (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted">Required skill</span>
                          <span className="font-medium text-ink">{gig.skillRequired || "—"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted">Experience level</span>
                          <span className="font-medium text-ink">{capitalize(gig.experienceLevel) || "—"}</span>
                        </div>
                      </>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted">Posted by</span>
                      <span className="font-medium text-ink">{gig.hostName || "—"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="p-5">
                <CardHeader className="p-0">
                  <CardTitle className="text-sm">Schedule &amp; Location</CardTitle>
                </CardHeader>
                <CardContent className="mt-3 space-y-3 p-0">
                  <div className="flex items-start gap-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted">
                      <Calendar className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted">Scheduled</p>
                      <p className="text-sm text-ink">{formatSchedule(gig.scheduledDate)}</p>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-start gap-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted">
                      <MapPin className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted">Address</p>
                      <p className="text-sm text-ink">{gig.address || "—"}</p>
                    </div>
                  </div>
                  {gig.location && <GigLocationMap location={gig.location} />}
                </CardContent>
              </Card>

              {gig.cancellation && (
                <Card className="border-(--danger-tint) bg-(--danger-tint)/40 p-5">
                  <CardHeader className="p-0">
                    <CardTitle className="text-sm text-(--danger-text)">Cancellation</CardTitle>
                    <CardDescription className="text-(--danger-text)/80">
                      Why this gig was cancelled or has a pending cancellation request
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mt-3 space-y-3 p-0">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted">
                          {gig.cancellation.cancelledAt ? "Cancelled" : "Cancellation requested"}
                        </p>
                        <p className="text-ink">
                          {formatSchedule(gig.cancellation.cancelledAt ?? gig.cancellation.cancellationRequestedAt)}
                        </p>
                      </div>
                      {gig.cancellation.cancelledByAdmin && (
                        <div>
                          <p className="text-xs text-muted">Cancelled by</p>
                          <p className="text-ink">{gig.cancellation.cancelledByAdminName || "Admin"}</p>
                        </div>
                      )}
                      {gig.cancellation.ticketId && (
                        <div>
                          <p className="text-xs text-muted">Ticket ID</p>
                          <p className="text-ink">{gig.cancellation.ticketId}</p>
                        </div>
                      )}
                    </div>

                    {gig.cancellation.reasons.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          {gig.cancellation.reasons.map((r, i) => (
                            <div key={i} className="rounded-lg border border-hairline bg-card px-3 py-2 text-sm">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium text-ink capitalize">
                                  Requested by {r.requestedBy || "unknown"}
                                </span>
                                {r.approved !== null && (
                                  <Badge
                                    variant="secondary"
                                    className={
                                      r.approved
                                        ? "bg-(--success-tint) text-(--success-text)"
                                        : "bg-(--danger-tint) text-(--danger-text)"
                                    }
                                  >
                                    {r.approved ? "Approved" : "Denied"}
                                  </Badge>
                                )}
                              </div>
                              {r.reason && <p className="mt-1 text-muted">{r.reason}</p>}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          <AlertDialog
            open={confirmApplicant !== null}
            onOpenChange={(open) => {
              if (!open && selectingId === null) setConfirmApplicant(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Select {confirmApplicant?.workerName}?</AlertDialogTitle>
                <AlertDialogDescription>
                  They&apos;ll be assigned this gig and notified to get started.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={selectingId !== null}>Cancel</AlertDialogCancel>
                <Button
                  disabled={selectingId !== null}
                  onClick={confirmSelectApplicant}
                  className="bg-(--success-start) text-white hover:bg-(--success-end)"
                >
                  {selectingId !== null ? "Selecting…" : "Select"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <CashPaymentDialog
            gig={gig}
            worker={paymentTarget}
            onOpenChange={(open) => {
              if (!open) setPaymentTarget(null);
            }}
          />

          <ViewPaymentCodeDialog
            workerName={viewCodeTarget?.workerName ?? null}
            paymentCode={viewCodeTarget?.paymentCode ?? null}
            onOpenChange={(open) => {
              if (!open) setViewCodeTarget(null);
            }}
          />
        </>
      )}
    </JoshDiv>
  );
}
