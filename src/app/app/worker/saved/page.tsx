"use client";

import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { toast } from "sonner";
import { Bookmark, Briefcase, Calendar, FileText, Hourglass, MapIcon, Send, Tag, Users, Wallet } from "lucide-react";
import TitlePage from "@/components/TitlePage";
import JoshDiv from "@/components/DivAnimation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import { GIG_TYPE_BADGE_CLASSES } from "@/lib/earnings";
import { capitalize, formatPostedAge, formatSchedule, formatWorkDuration, initialsOf, payLabel } from "@/lib/gig-format";
import {
  acceptOfferedGig,
  applyToOpenGig,
  countryCodeFromCoordinates,
  declineOfferedGig,
  fetchSavedGigs,
  haversineKm,
  subscribeSavedGigEntries,
  toggleSavedGig,
  withdrawApplication,
  workerHasActiveGig,
  workerHasPendingCancellation,
  type Gig,
  type SavedGig,
  type SavedGigEntry,
} from "@/lib/browse-gigs";

const FAR_GIG_THRESHOLD_KM = 50;

// Color-codes the raw Firestore status shown on each saved-gig card — green
// while still actionable, red once it's dead, neutral once it's done or
// moved into the mobile app's in-progress lifecycle (out of scope here).
const STATUS_BADGE_CLASSES: Record<string, string> = {
  open: "bg-(--success-tint) text-(--success-text)",
  partially_filled: "bg-(--success-tint) text-(--success-text)",
  offered: "bg-(--success-tint) text-(--success-text)",
  cancelled: "bg-destructive/10 text-destructive",
  declined: "bg-destructive/10 text-destructive",
  no_worker: "bg-destructive/10 text-destructive",
};

// A saved gig's status is whatever it was on the doc at fetch time, unlike
// Browse's live feed (which only ever subscribes to status "open"/"offered"
// docs to begin with) — so a bookmark can point at a gig that's since been
// filled, cancelled, declined, or otherwise closed out. Mirrors the
// stillAcceptingApplicants check inlined in applyToOpenGig, plus the
// status filter subscribeOfferedGigs applies at the query level.
function isGigActionable(gig: Gig): boolean {
  if (gig.gigType === "offered") return gig.status === "offered";
  return gig.workerSlots > 1
    ? (gig.status === "open" || gig.status === "partially_filled") && gig.filledSlotCount < gig.workerSlots
    : gig.status === "open";
}

// Mirrors the detail sections in the Browse page's gig panel — see
// src/app/app/worker/browse/page.tsx's SectionLabel/Skills for the pattern.
function SectionLabel({ icon: Icon, children }: { icon: ComponentType<{ className?: string }>; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
      <Icon className="size-3.5" />
      {children}
    </div>
  );
}

function Skills({ skills }: { skills: string[] }) {
  if (skills.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {skills.map((skill) => (
        <Badge key={skill} variant="secondary">{skill}</Badge>
      ))}
    </div>
  );
}

function matchesSkill(a: string, b: string) {
  return a.toLowerCase().trim() === b.toLowerCase().trim();
}

// Mirrors saved_screen.dart's Saved tab — a live listener on the bookmark
// ids (subscribeSavedGigEntries) drives a one-shot hydrate of the full gig
// docs (fetchSavedGigs) each time that id set changes, same hybrid the
// Flutter screen uses. Bookmarks are toggled from the Browse page; this
// page is read-only aside from removing one.
export default function SavedGigsPage() {
  const uid = useAppSelector((root) => root.user.authUser?.uid);
  const profile = useAppSelector((root) => root.user.profile);
  const workerName = profile?.name || "Worker";
  const workerSkills = useMemo(() => Object.keys(profile?.skillsXP ?? {}), [profile?.skillsXP]);
  const isVerified = profile?.isVerified === "verified";

  const [entries, setEntries] = useState<SavedGigEntry[]>([]);
  const [entriesLoaded, setEntriesLoaded] = useState(false);
  const [savedGigs, setSavedGigs] = useState<SavedGig[]>([]);
  const [gigsLoading, setGigsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!uid) return;
    return subscribeSavedGigEntries(
      uid,
      (fetched) => {
        setEntries(fetched);
        setEntriesLoaded(true);
      },
      (err) => {
        console.error("Failed to load saved gigs:", err);
        setError("Couldn't load your saved gigs. Please try again.");
        setEntriesLoaded(true);
      }
    );
  }, [uid]);

  useEffect(() => {
    if (!entriesLoaded) return;
    if (entries.length === 0) {
      // Clearing before (re)fetching, not reacting to this itself.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSavedGigs([]);
      return;
    }
    let cancelled = false;
    setGigsLoading(true);
    fetchSavedGigs(entries)
      .then((result) => {
        if (!cancelled) setSavedGigs(result);
      })
      .catch((err) => {
        console.error("Failed to load saved gigs:", err);
        if (!cancelled) setError("Couldn't load your saved gigs. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setGigsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entries, entriesLoaded]);

  // Cached location first (from the user doc), then refine with a fresh
  // browser fix — mirrors Browse's "quick fix, then high-accuracy fix" flow.
  useEffect(() => {
    // Syncing from the Redux-mirrored Firestore profile, not local state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (profile?.location) setMyLocation({ lat: profile.location.latitude, lng: profile.location.longitude });
  }, [profile?.location]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 15_000 }
    );
  }, []);

  const loading = !entriesLoaded || gigsLoading;
  const viewingSaved = savedGigs.find((s) => s.id === viewingId) ?? null;
  const viewingGig = viewingSaved?.gig ?? null;

  function hasApplied(gig: Gig) {
    return !!uid && gig.applicants.some((a) => a.workerId === uid);
  }

  function missingSkills(gig: Gig) {
    if (gig.gigType !== "open" || gig.requiredSkills.length === 0) return [];
    return gig.requiredSkills.filter((s) => !workerSkills.some((ws) => matchesSkill(ws, s)));
  }

  // Mirrors Browse's passPreflightChecks — same guards before an
  // apply/accept write (verification, in-progress gig, pending
  // cancellation, cross-country, far-distance confirmation).
  async function passPreflightChecks(gig: Gig): Promise<boolean> {
    if (!isVerified) {
      toast.error("Your account needs to be verified before you can continue. Please request verification from the admin.");
      return false;
    }
    if (!uid) return false;
    if (await workerHasPendingCancellation(uid)) {
      toast.warning("Your cancellation request hasn't been approved by the admin yet.");
      return false;
    }
    if (await workerHasActiveGig(uid)) {
      toast.warning("You need to finish your current gig before taking another one.");
      return false;
    }
    if (gig.location && myLocation) {
      const [myCountry, gigCountry] = await Promise.all([
        countryCodeFromCoordinates(myLocation.lat, myLocation.lng),
        countryCodeFromCoordinates(gig.location.lat, gig.location.lng),
      ]);
      if (myCountry && gigCountry && myCountry !== gigCountry) {
        toast.error("This gig is based in a different country than yours, so you can't take it from here.");
        return false;
      }
      const distKm = haversineKm(myLocation, gig.location);
      if (distKm >= FAR_GIG_THRESHOLD_KM) {
        const proceed = window.confirm(
          `This gig is about ${Math.round(distKm)} km from your current location. Make sure you're able to travel there before you take it. Continue?`
        );
        if (!proceed) return false;
      }
    }
    return true;
  }

  async function handleApply(gig: Gig) {
    if (!uid) return;
    setPendingActionId(gig.id);
    try {
      if (!(await passPreflightChecks(gig))) return;
      const result = await applyToOpenGig(gig.id, uid, workerName);
      if (result.ok) toast.success("Application submitted! Waiting for host selection.");
      else toast.warning(result.reason);
    } catch (err) {
      console.error("Failed to apply to gig:", err);
      toast.error("Couldn't submit your application. Please try again.");
    } finally {
      setPendingActionId(null);
    }
  }

  async function handlePass(gig: Gig) {
    if (!uid) return;
    if (!window.confirm("Pass? You can take it again later if this gig is still open.")) return;
    setPendingActionId(gig.id);
    try {
      const result = await withdrawApplication(gig.id, uid);
      if (result.ok) toast.success("Application withdrawn.");
      else toast.warning(result.reason);
    } catch (err) {
      console.error("Failed to withdraw application:", err);
      toast.error("Couldn't withdraw your application. Please try again.");
    } finally {
      setPendingActionId(null);
    }
  }

  async function handleAccept(gig: Gig) {
    setPendingActionId(gig.id);
    try {
      if (!(await passPreflightChecks(gig))) return;
      const result = await acceptOfferedGig(gig);
      if (result.ok) toast.success("Gig accepted!");
      else toast.warning(result.reason);
    } catch (err) {
      console.error("Failed to accept offered gig:", err);
      toast.error("Couldn't accept this gig. Please try again.");
    } finally {
      setPendingActionId(null);
    }
  }

  async function handleDecline(gig: Gig) {
    if (!window.confirm("Decline this offer?")) return;
    setPendingActionId(gig.id);
    try {
      const result = await declineOfferedGig(gig);
      if (result.ok) toast("Offer declined.");
      else toast.warning(result.reason);
    } catch (err) {
      console.error("Failed to decline offered gig:", err);
      toast.error("Couldn't decline this offer. Please try again.");
    } finally {
      setPendingActionId(null);
    }
  }

  async function handleRemove(saved: SavedGig) {
    if (!uid || removingId) return;
    setRemovingId(saved.id);
    try {
      await toggleSavedGig(uid, saved.id, saved.gigType, true);
      toast.success("Bookmark removed.");
    } catch (err) {
      console.error("Failed to remove bookmark:", err);
      toast.error("Couldn't remove this bookmark. Please try again.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <JoshDiv>
      <TitlePage title="Saved Gigs" description="Gigs you've bookmarked to come back to" />

      <div className="mt-6 space-y-3">
        {loading ? (
          <>
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : savedGigs.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 p-10 text-center">
            <Bookmark className="size-8 text-muted" />
            <p className="text-sm font-medium text-ink">No saved gigs</p>
            <p className="max-w-sm text-sm text-muted">
              Tap the bookmark icon on a gig in Browse to save it here.
            </p>
          </Card>
        ) : (
          savedGigs.map((saved) => (
            <Card
              key={saved.id}
              className={cn(
                "transition-all",
                saved.gig ? "cursor-pointer hover:border-worker/40 hover:shadow-md" : "opacity-70"
              )}
              onClick={() => saved.gig && setViewingId(saved.id)}
            >
              <CardContent className="flex items-start gap-4 p-5">
                {saved.gig ? (
                  <>
                    <Avatar className="size-14 shrink-0 rounded-xl after:rounded-xl">
                      <AvatarFallback className="rounded-xl bg-worker-tint text-lg font-semibold text-(--worker-text)">
                        {initialsOf(saved.gig.hostName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-1 font-display text-base font-semibold text-ink">{saved.gig.title}</p>
                        <span className="shrink-0 font-semibold text-ink">
                          {payLabel(saved.gig.currencyCode, saved.gig)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted">{saved.gig.hostName}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                        <span className="flex items-center gap-1.5 truncate">
                          <MapIcon className="size-3.5 shrink-0" />
                          <span className="truncate">{saved.gig.address}</span>
                        </span>
                        <span className="flex items-center gap-1.5 shrink-0">
                          <Calendar className="size-3.5" />
                          {formatSchedule(saved.gig.scheduledDate)}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className={GIG_TYPE_BADGE_CLASSES[saved.gigType]}>
                          {capitalize(saved.gigType)}
                        </Badge>
                        <Badge variant="secondary" className={STATUS_BADGE_CLASSES[saved.gig.status] ?? "bg-mist text-muted"}>
                          {capitalize(saved.gig.status)}
                        </Badge>
                        {saved.gig.gigType === "open" && hasApplied(saved.gig) && (
                          <span className="text-xs font-medium text-(--success-text)">Applied</span>
                        )}
                        {saved.savedAt && (
                          <span className="ml-auto shrink-0 text-xs text-muted">Saved {formatPostedAge(saved.savedAt)}</span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="flex-1 text-sm text-muted italic">This gig is no longer available.</p>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove bookmark"
                  disabled={removingId === saved.id}
                  className="text-worker hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(saved);
                  }}
                >
                  <Bookmark className="size-4 fill-current" />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Sheet open={viewingSaved !== null} onOpenChange={(open) => !open && setViewingId(null)}>
        <SheetContent>
          {viewingSaved && viewingGig && (
            <>
              <SheetHeader>
                <SheetTitle>{viewingGig.title}</SheetTitle>
                <SheetDescription>{viewingGig.hostName}</SheetDescription>
              </SheetHeader>

              <div className="space-y-5 px-4 pb-4">
                <div>
                  <SectionLabel icon={Briefcase}>Experience Level</SectionLabel>
                  <p className="mt-1 text-sm text-ink">{capitalize(viewingGig.experienceLevel)}</p>
                </div>

                <Separator />

                <div>
                  <SectionLabel icon={Wallet}>Salary</SectionLabel>
                  <p className="mt-1 text-sm font-medium text-ink">
                    {payLabel(viewingGig.currencyCode, viewingGig)}
                  </p>
                </div>

                <Separator />

                <div>
                  <SectionLabel icon={Calendar}>Schedule</SectionLabel>
                  <p className="mt-1 text-sm text-ink">{formatSchedule(viewingGig.scheduledDate)}</p>
                </div>

                {viewingGig.workDurationHours !== undefined && (
                  <>
                    <Separator />
                    <div>
                      <SectionLabel icon={Hourglass}>Work Duration</SectionLabel>
                      <p className="mt-1 text-sm text-ink">
                        {formatWorkDuration(viewingGig.workDurationHours)}{" "}
                        <span className="text-xs text-muted">estimate only, not a commitment</span>
                      </p>
                    </div>
                  </>
                )}

                <Separator />

                <div>
                  <SectionLabel icon={Users}>Workers Needed</SectionLabel>
                  <p className="mt-1 text-sm font-medium text-(--success-text)">
                    {Math.max(0, viewingGig.workerSlots - viewingGig.filledSlotCount)} of{" "}
                    {viewingGig.workerSlots} spots open
                  </p>
                  {viewingGig.workerSlots > 1 && (
                    <p className="text-xs text-muted">Each worker is paid independently</p>
                  )}
                </div>

                <Separator />

                <div>
                  <SectionLabel icon={MapIcon}>Address</SectionLabel>
                  <p className="mt-1 text-sm text-ink">{viewingGig.address}</p>
                  {viewingGig.location && (
                    <a
                      href={`https://www.google.com/maps?q=${viewingGig.location.lat},${viewingGig.location.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-sm text-worker hover:underline"
                    >
                      See on map
                    </a>
                  )}
                </div>

                {viewingGig.requiredSkills.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <SectionLabel icon={Tag}>Required Skill</SectionLabel>
                      <div className="mt-2">
                        <Skills skills={viewingGig.requiredSkills} />
                      </div>
                    </div>
                  </>
                )}

                {viewingGig.description && (
                  <>
                    <Separator />
                    <div>
                      <SectionLabel icon={FileText}>Gig Description</SectionLabel>
                      <p className="mt-1 text-sm leading-relaxed text-ink">{viewingGig.description}</p>
                    </div>
                  </>
                )}
              </div>

              <SheetFooter>
                {isGigActionable(viewingGig) ? (
                  viewingGig.gigType === "open" ? (
                    hasApplied(viewingGig) ? (
                      <Button
                        variant="outline"
                        className="w-full border-destructive/40 text-destructive hover:bg-destructive/10"
                        disabled={pendingActionId === viewingGig.id}
                        onClick={() => handlePass(viewingGig)}
                      >
                        Pass
                      </Button>
                    ) : (
                      <Button
                        className="w-full bg-worker text-white hover:bg-(--worker-end)"
                        disabled={missingSkills(viewingGig).length > 0 || pendingActionId === viewingGig.id}
                        onClick={() => handleApply(viewingGig)}
                      >
                        Take Gig
                      </Button>
                    )
                  ) : (
                    <div className="flex w-full gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        disabled={pendingActionId === viewingGig.id}
                        onClick={() => handleDecline(viewingGig)}
                      >
                        Decline
                      </Button>
                      <Button
                        className="flex-1 bg-worker text-white hover:bg-(--worker-end)"
                        disabled={pendingActionId === viewingGig.id}
                        onClick={() => handleAccept(viewingGig)}
                      >
                        <Send className="size-4" />
                        I&apos;m In
                      </Button>
                    </div>
                  )
                ) : (
                  <p className="w-full text-center text-xs text-muted">This gig is no longer accepting applicants.</p>
                )}
                <Button
                  variant="outline"
                  className="gap-1.5 text-destructive hover:bg-destructive/10"
                  disabled={removingId === viewingSaved.id}
                  onClick={() => {
                    handleRemove(viewingSaved);
                    setViewingId(null);
                  }}
                >
                  <Bookmark className="size-4 fill-current" />
                  Remove bookmark
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </JoshDiv>
  );
}
