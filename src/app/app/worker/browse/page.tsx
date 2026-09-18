'use client'

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatDate, maskEmail } from "@/lib/utils";
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
    BadgeCheck,
    Ban,
    Bookmark,
    Briefcase,
    Building2,
    Calendar,
    CalendarDays,
    Check,
    FileText,
    Flag,
    Loader2,
    Mail,
    MapIcon,
    Search,
    Send,
    Star,
    Tag,
    Users,
    Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { useAppSelector } from "@/store/hooks";
import { GIG_TYPE_BADGE_CLASSES } from "@/lib/earnings";
import { capitalize, formatPostedAge, formatSchedule, initialsOf, salary } from "@/lib/gig-format";
import { REPORT_REASONS, submitReport } from "@/lib/reports";
import {
    acceptOfferedGig,
    applyToOpenGig,
    blockUser,
    countryCodeFromCoordinates,
    declineOfferedGig,
    fetchHostByUid,
    fetchSkillNames,
    haversineKm,
    subscribeBlockedUserIds,
    subscribeOfferedGigs,
    subscribeOpenGigs,
    subscribeSavedGigEntries,
    toggleSavedGig,
    withdrawApplication,
    workerHasActiveGig,
    workerHasPendingCancellation,
    type Gig,
    type HostLookupResult,
} from "@/lib/browse-gigs";

// Mirrors giggre_app's gigs-near-you feed — see src/lib/browse-gigs.ts for the
// Firestore query/filter/action logic this page is built on.

type SkillFilter = "all" | "mySkills" | "specific";
const FAR_GIG_THRESHOLD_KM = 50;
const RADIUS_OPTIONS: (number | null)[] = [null, 1, 5, 10, 50, 100];

// Either "report this host" (from the host profile drawer) or "report this
// gig posting" (from the gig detail panel) — same reason list/dialog for
// both, just different Firestore contentType/id, mirroring ReportService's
// single shared sheet in the mobile app.
interface ReportTarget {
    contentType: "user" | "gig";
    contentId: string;
    contentSnapshot: string;
    reportedUserId: string;
    reportedUserName: string;
    reportedUserEmail?: string;
    gigId?: string;
}

function timeAgo(date: Date | null) {
    if (!date) return null;
    const seconds = Math.max(0, (Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function matchesSkill(a: string, b: string) {
    return a.toLowerCase().trim() === b.toLowerCase().trim();
}

function AvatarHost({ hostname }: { hostname?: string }) {
    return (<Avatar className="h-20 w-20 rounded-2xl after:rounded-2xl">
        <AvatarFallback className="rounded-2xl bg-worker-tint text-2xl font-semibold text-(--worker-text)">{initialsOf(hostname)}</AvatarFallback>
    </Avatar>)
}

function Skills({ skills }: { skills: string[] | [] }) {
    if (skills.length === 0) return null;
    return (
        <div className="flex flex-wrap gap-1.5">
            {skills.map((skill) => (
                <Badge key={skill} variant="secondary">{skill}</Badge>
            ))}
        </div>
    )
}

function SectionLabel({ icon: Icon, children }: { icon: ComponentType<{ className?: string }>; children: ReactNode }) {
    return (
        <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
            <Icon className="size-3.5" />
            {children}
        </div>
    )
}

const Browse = () => {
    const uid = useAppSelector((root) => root.user.authUser?.uid);
    const profile = useAppSelector((root) => root.user.profile);
    const workerName = profile?.name || "Worker";
    const workerSkills = useMemo(() => Object.keys(profile?.skillsXP ?? {}), [profile?.skillsXP]);
    const isVerified = profile?.isVerified === "verified";

    const [openGigs, setOpenGigs] = useState<Gig[]>([]);
    const [offeredGigs, setOfferedGigs] = useState<Gig[]>([]);
    const [openLoaded, setOpenLoaded] = useState(false);
    const [offeredLoaded, setOfferedLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const loading = !(openLoaded && offeredLoaded);

    const [searchTerm, setSearchTerm] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [pendingActionId, setPendingActionId] = useState<string | null>(null);

    const [skillFilter, setSkillFilter] = useState<SkillFilter>("mySkills");
    const [specificSkill, setSpecificSkill] = useState<string | null>(null);
    const [allSkillNames, setAllSkillNames] = useState<string[]>([]);
    const [radiusKm, setRadiusKm] = useState<number | null>(10);
    const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);

    const [viewingHostId, setViewingHostId] = useState<string | null>(null);
    const [hostProfile, setHostProfile] = useState<HostLookupResult | null>(null);
    const [hostProfileLoading, setHostProfileLoading] = useState(false);
    const [blockedHostIds, setBlockedHostIds] = useState<Set<string>>(new Set());
    const [blocking, setBlocking] = useState(false);

    const [savedGigIds, setSavedGigIds] = useState<Set<string>>(new Set());

    const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
    const [reportReason, setReportReason] = useState<string | null>(null);
    const [reportDetails, setReportDetails] = useState("");
    const [reportSubmitting, setReportSubmitting] = useState(false);
    const [reportSubmitted, setReportSubmitted] = useState(false);

    const user = useAppSelector((root) => root.user)
    console.log(user)

    useEffect(() => {
        if (!uid) return;
        const unsubOpen = subscribeOpenGigs(
            uid,
            (gigs) => { setOpenGigs(gigs); setOpenLoaded(true); },
            (err) => { console.error("Failed to load open gigs:", err); setError("Couldn't load gigs. Please try again."); setOpenLoaded(true); }
        );
        const unsubOffered = subscribeOfferedGigs(
            uid,
            (gigs) => { setOfferedGigs(gigs); setOfferedLoaded(true); },
            (err) => { console.error("Failed to load offered gigs:", err); setOfferedLoaded(true); }
        );
        return () => { unsubOpen(); unsubOffered(); };
    }, [uid]);

    // Mirrors the mobile feed's blocked-host filter — a live subscription so a
    // block made from this drawer hides that host's gigs immediately.
    useEffect(() => {
        if (!uid) return;
        return subscribeBlockedUserIds(uid, (ids) => setBlockedHostIds(new Set(ids)));
    }, [uid]);

    useEffect(() => {
        if (!uid) return;
        return subscribeSavedGigEntries(
            uid,
            (entries) => setSavedGigIds(new Set(entries.map((e) => e.id))),
            (err) => console.error("Failed to load saved gigs:", err)
        );
    }, [uid]);

    useEffect(() => {
        fetchSkillNames().then(setAllSkillNames).catch(() => {});
    }, []);

    useEffect(() => {
        if (!viewingHostId) return;
        let cancelled = false;
        (async () => {
            setHostProfileLoading(true);
            setHostProfile(null);
            try {
                const result = await fetchHostByUid(viewingHostId);
                if (!cancelled) setHostProfile(result);
            } catch (err) {
                console.error("Failed to load host profile:", err);
            } finally {
                if (!cancelled) setHostProfileLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [viewingHostId]);

    // Cached location first (from the user doc), then refine with a fresh
    // browser fix — mirrors the app's "quick fix, then high-accuracy fix" flow.
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

    const allGigs = useMemo(
        () => [...openGigs, ...offeredGigs].filter((g) => !blockedHostIds.has(g.hostId)),
        [openGigs, offeredGigs, blockedHostIds]
    );

    const skillFiltered = useMemo(() => {
        if (skillFilter === "all") return allGigs;
        if (skillFilter === "specific") {
            if (!specificSkill) return allGigs;
            return allGigs.filter((g) => g.requiredSkills.some((s) => matchesSkill(s, specificSkill)));
        }
        return allGigs.filter(
            (g) => g.requiredSkills.length === 0 || g.requiredSkills.some((s) => workerSkills.some((ws) => matchesSkill(ws, s)))
        );
    }, [allGigs, skillFilter, specificSkill, workerSkills]);

    const radiusFiltered = useMemo(() => {
        if (radiusKm == null || !myLocation) return skillFiltered;
        return skillFiltered.filter((g) => g.location && haversineKm(myLocation, g.location) <= radiusKm);
    }, [skillFiltered, radiusKm, myLocation]);

    const filteredGigs = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return radiusFiltered;
        return radiusFiltered.filter((gig) => gig.title.toLowerCase().includes(term) || gig.hostName.toLowerCase().includes(term));
    }, [radiusFiltered, searchTerm]);

    useEffect(() => {
        // Defaults the detail pane to the first result whenever filters/search
        // change the list out from under the current selection.
        if ((!selectedId || !filteredGigs.some((g) => g.id === selectedId)) && filteredGigs.length > 0) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSelectedId(filteredGigs[0].id);
        }
    }, [filteredGigs, selectedId]);

    const selectedGig = filteredGigs.find((gig) => gig.id === selectedId) ?? null;

    function hasApplied(gig: Gig) {
        return !!uid && gig.applicants.some((a) => a.workerId === uid);
    }

    function missingSkills(gig: Gig) {
        if (gig.gigType !== "open" || gig.requiredSkills.length === 0) return [];
        return gig.requiredSkills.filter((s) => !workerSkills.some((ws) => matchesSkill(ws, s)));
    }

    // Shared guards before an apply/accept write — mirrors _applyToOpenGig /
    // _acceptOfferedGig's checks in the app (verification, in-progress gig,
    // pending cancellation, cross-country, far-distance confirmation).
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

    async function handleBlock() {
        if (!uid || !hostProfile || blocking) return;
        setBlocking(true);
        try {
            await blockUser(uid, hostProfile.uid);
            toast.success(`${hostProfile.name} has been blocked`);
            setViewingHostId(null);
        } catch (err) {
            console.error("Failed to block host:", err);
            toast.error("Couldn't block this user. Please try again.");
        } finally {
            setBlocking(false);
        }
    }

    async function handleToggleSaved(gig: Gig) {
        if (!uid) return;
        const isSaved = savedGigIds.has(gig.id);
        try {
            await toggleSavedGig(uid, gig.id, gig.gigType, isSaved);
        } catch (err) {
            console.error("Failed to update saved gig:", err);
            toast.error(isSaved ? "Couldn't remove this bookmark." : "Couldn't save this gig.");
        }
    }

    function closeReportDialog(open: boolean) {
        if (!open) {
            setReportTarget(null);
            setReportReason(null);
            setReportDetails("");
            setReportSubmitted(false);
        }
    }

    async function handleSubmitReport() {
        if (!uid || !reportTarget || !reportReason || reportSubmitting) return;
        setReportSubmitting(true);
        try {
            await submitReport({
                contentType: reportTarget.contentType,
                contentId: reportTarget.contentId,
                contentSnapshot: reportTarget.contentSnapshot,
                surface: "gig_detail",
                gigId: reportTarget.gigId,
                reporterId: uid,
                reportedUserId: reportTarget.reportedUserId,
                reportedUserName: reportTarget.reportedUserName,
                reportedUserEmail: reportTarget.reportedUserEmail,
                reason: reportReason,
                details: reportDetails.trim(),
            });
            setReportSubmitted(true);
        } catch (err) {
            console.error("Failed to submit report:", err);
            toast.error("Couldn't submit this report. Please try again.");
        } finally {
            setReportSubmitting(false);
        }
    }

    return (
        <>
        <div className="flex h-[calc(100dvh-var(--header-height))] flex-col overflow-hidden p-4">
            <div className="grid min-h-0 flex-1 grid-cols-5 gap-4">
                <div className="col-span-3 flex min-h-0 flex-col">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
                            <Input
                                placeholder="Search Gigs"
                                className="pl-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Button className="bg-worker text-white hover:bg-(--worker-end)">Search</Button>
                    </div>

                    <div className="mt-3 flex flex-wrap items-end gap-3">
                        <div className="flex flex-col gap-1">
                            <Label className="text-xs text-muted">Skills</Label>
                            <Select value={skillFilter} onValueChange={(v) => setSkillFilter((v ?? "mySkills") as SkillFilter)}>
                                <SelectTrigger size="sm">
                                    <SelectValue>
                                        {skillFilter === "all" ? "All gigs" : skillFilter === "mySkills" ? "My skills" : specificSkill ?? "Specific skill"}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All gigs</SelectItem>
                                    <SelectItem value="mySkills">My skills</SelectItem>
                                    <SelectItem value="specific">Specific skill</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {skillFilter === "specific" && (
                            <div className="flex flex-col gap-1">
                                <Label className="text-xs text-muted">Which skill</Label>
                                <Select value={specificSkill ?? undefined} onValueChange={(v) => setSpecificSkill(v)}>
                                    <SelectTrigger size="sm">
                                        <SelectValue>{specificSkill ?? "Choose a skill"}</SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {allSkillNames.map((name) => (
                                            <SelectItem key={name} value={name}>{name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div className="flex flex-col gap-1">
                            <Label className="text-xs text-muted">Radius</Label>
                            <Select
                                value={radiusKm === null ? "none" : String(radiusKm)}
                                onValueChange={(v) => setRadiusKm(v === "none" || v === null ? null : Number(v))}
                            >
                                <SelectTrigger size="sm">
                                    <SelectValue>{radiusKm === null ? "No limit" : `${radiusKm} km`}</SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {RADIUS_OPTIONS.map((r) => (
                                        <SelectItem key={r ?? "none"} value={r === null ? "none" : String(r)}>
                                            {r === null ? "No limit" : `${r} km`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <p className="mt-2 text-sm text-muted">
                        {loading ? "Loading gigs…" : `${filteredGigs.length} gig${filteredGigs.length === 1 ? "" : "s"}`}
                    </p>

                    <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                        {loading && (
                            <>
                                <Skeleton className="h-32 w-full rounded-lg" />
                                <Skeleton className="h-32 w-full rounded-lg" />
                                <Skeleton className="h-32 w-full rounded-lg" />
                            </>
                        )}

                        {!loading && error && (
                            <p className="rounded-lg border border-hairline bg-sidebar p-6 text-sm text-destructive">{error}</p>
                        )}

                        {!loading && !error && filteredGigs.length === 0 && (
                            <p className="rounded-lg border border-dashed border-hairline p-6 text-sm text-muted">No gigs match your filters.</p>
                        )}

                        {!loading && !error && filteredGigs.map((gig) => (
                            <div
                                key={gig.id}
                                onClick={() => setSelectedId(gig.id)}
                                className={cn(
                                    "flex gap-4 rounded-lg border p-5 shadow-sm transition-all cursor-pointer hover:shadow-md",
                                    gig.id === selectedId ? "border-worker bg-worker-tint" : "border-hairline bg-sidebar hover:bg-mist"
                                )}
                            >
                                <AvatarHost hostname={gig.hostName} />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="line-clamp-1 font-display text-lg font-semibold text-ink">{gig.title}</div>
                                        <div className="flex shrink-0 items-center gap-1">
                                            <span className="font-semibold text-ink">{salary(gig.currencyCode, gig.budget)}/day</span>
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                aria-label={savedGigIds.has(gig.id) ? "Remove bookmark" : "Save gig"}
                                                className="text-muted hover:text-worker"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleToggleSaved(gig);
                                                }}
                                            >
                                                <Bookmark className={cn("size-4", savedGigIds.has(gig.id) && "fill-worker text-worker")} />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                                        <MapIcon className="size-3.5 shrink-0" />
                                        <span className="truncate">{gig.address}</span>
                                        {myLocation && gig.location && (
                                            <span className="shrink-0">· {haversineKm(myLocation, gig.location).toFixed(1)} km</span>
                                        )}
                                    </div>
                                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                                        <Badge variant="secondary" className={GIG_TYPE_BADGE_CLASSES[gig.gigType]}>
                                            {capitalize(gig.gigType)}
                                        </Badge>
                                        {formatPostedAge(gig.createdAt)} • {capitalize(gig.experienceLevel)}
                                        <span className="flex items-center gap-1 font-medium text-(--success-text)">
                                            • <Users className="size-3" />
                                            {Math.max(0, gig.workerSlots - gig.filledSlotCount)}/{gig.workerSlots} slot{gig.workerSlots === 1 ? "" : "s"}
                                        </span>
                                        {gig.gigType === "open" && hasApplied(gig) && (
                                            <span className="font-medium text-(--success-text)">• Applied</span>
                                        )}
                                    </p>
                                    {gig.requiredSkills.length > 0 && (
                                        <div className="mt-3">
                                            <Skills skills={gig.requiredSkills} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="col-span-2 col-start-4 h-full">
                    {selectedGig ? (
                        <div className="flex h-full flex-col overflow-y-auto rounded-lg border border-hairline bg-sidebar p-6 shadow-sm">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-4">
                                    <AvatarHost hostname={selectedGig.hostName} />
                                    <div className="min-w-0">
                                        <div className="font-display text-xl font-semibold text-ink">{selectedGig.title}</div>
                                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted">
                                            <button
                                                type="button"
                                                onClick={() => setViewingHostId(selectedGig.hostId)}
                                                className="font-medium hover:cursor-pointer text-ink underline-offset-2 hover:underline"
                                            >
                                                {selectedGig.hostName}
                                            </button>
                                            <span aria-hidden>•</span>
                                            <span>
                                                {selectedGig.gigType === "open" && selectedGig.applicantCount > 0
                                                    ? `Posted ${timeAgo(selectedGig.createdAt)} · ${selectedGig.applicantCount} applicant${selectedGig.applicantCount === 1 ? "" : "s"} so far`
                                                    : `Posted ${timeAgo(selectedGig.createdAt)}`}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label={savedGigIds.has(selectedGig.id) ? "Remove bookmark" : "Save gig"}
                                        className="text-muted hover:text-worker"
                                        onClick={() => handleToggleSaved(selectedGig)}
                                    >
                                        <Bookmark className={cn("size-4", savedGigIds.has(selectedGig.id) && "fill-worker text-worker")} />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label="Report this gig"
                                        className="text-orange-500 hover:bg-orange-50 hover:text-orange-600"
                                        onClick={() =>
                                            setReportTarget({
                                                contentType: "gig",
                                                contentId: selectedGig.id,
                                                contentSnapshot: selectedGig.title,
                                                reportedUserId: selectedGig.hostId,
                                                reportedUserName: selectedGig.hostName,
                                                gigId: selectedGig.id,
                                            })
                                        }
                                    >
                                        <Flag className="size-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="mt-6 space-y-5">
                                <div>
                                    <SectionLabel icon={Briefcase}>Experience Level</SectionLabel>
                                    <p className="mt-1 text-sm text-ink">{capitalize(selectedGig.experienceLevel)}</p>
                                </div>

                                <Separator />

                                <div>
                                    <SectionLabel icon={Wallet}>Salary</SectionLabel>
                                    <p className="mt-1 text-sm font-medium text-ink">{salary(selectedGig.currencyCode, selectedGig.budget)}/day</p>
                                </div>

                                <Separator />

                                <div>
                                    <SectionLabel icon={Calendar}>Schedule</SectionLabel>
                                    <p className="mt-1 text-sm text-ink">{formatSchedule(selectedGig.scheduledDate)}</p>
                                </div>

                                <Separator />

                                <div>
                                    <SectionLabel icon={Users}>Workers Needed</SectionLabel>
                                    <p className="mt-1 text-sm font-medium text-(--success-text)">
                                        {Math.max(0, selectedGig.workerSlots - selectedGig.filledSlotCount)} of {selectedGig.workerSlots} spots open
                                    </p>
                                    {selectedGig.workerSlots > 1 && (
                                        <p className="text-xs text-muted">Each worker is paid independently</p>
                                    )}
                                </div>

                                <Separator />

                                <div>
                                    <SectionLabel icon={MapIcon}>Address</SectionLabel>
                                    <p className="mt-1 text-sm text-ink">{selectedGig.address}</p>
                                    {selectedGig.location && (
                                        <a
                                            href={`https://www.google.com/maps?q=${selectedGig.location.lat},${selectedGig.location.lng}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-1 inline-block text-sm text-worker hover:underline"
                                        >
                                            See on map
                                        </a>
                                    )}
                                </div>

                                {selectedGig.requiredSkills.length > 0 && (
                                    <>
                                        <Separator />
                                        <div>
                                            <SectionLabel icon={Tag}>Required Skill</SectionLabel>
                                            <div className="mt-2">
                                                <Skills skills={selectedGig.requiredSkills} />
                                            </div>
                                            {missingSkills(selectedGig).length > 0 && (
                                                <p className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                                                    Missing {missingSkills(selectedGig).length === 1 ? "skill" : "skills"}: {missingSkills(selectedGig).join(", ")}
                                                </p>
                                            )}
                                        </div>
                                    </>
                                )}

                                {selectedGig.description && (
                                    <>
                                        <Separator />
                                        <div>
                                            <SectionLabel icon={FileText}>Gig Description</SectionLabel>
                                            <p className="mt-1 text-sm leading-relaxed text-ink">{selectedGig.description}</p>
                                        </div>
                                    </>
                                )}
                            </div>

                            {selectedGig.gigType === "open" ? (
                                hasApplied(selectedGig) ? (
                                    <Button
                                        variant="outline"
                                        className="mt-6 w-full border-destructive/40 text-destructive hover:bg-destructive/10"
                                        disabled={pendingActionId === selectedGig.id}
                                        onClick={() => handlePass(selectedGig)}
                                    >
                                        Pass
                                    </Button>
                                ) : (
                                    <Button
                                        className="mt-6 w-full bg-worker text-white hover:bg-(--worker-end)"
                                        disabled={missingSkills(selectedGig).length > 0 || pendingActionId === selectedGig.id}
                                        onClick={() => handleApply(selectedGig)}
                                    >
                                        Take Gig
                                    </Button>
                                )
                            ) : (
                                <div className="mt-6 flex gap-2">
                                    <Button
                                        variant="outline"
                                        className="flex-1"
                                        disabled={pendingActionId === selectedGig.id}
                                        onClick={() => handleDecline(selectedGig)}
                                    >
                                        Decline
                                    </Button>
                                    <Button
                                        className="flex-1 bg-worker text-white hover:bg-(--worker-end)"
                                        disabled={pendingActionId === selectedGig.id}
                                        onClick={() => handleAccept(selectedGig)}
                                    >
                                        <Send className="size-4" />
                                        I&apos;m In
                                    </Button>
                                </div>
                            )}
                            {selectedGig.gigType === "open" && !hasApplied(selectedGig) && (
                                <p className="mt-2 text-center text-xs text-muted">You can pass anytime before you&apos;re selected</p>
                            )}
                        </div>
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-hairline text-center text-sm text-muted">
                            <Briefcase className="size-6" />
                            Select a gig to see details
                        </div>
                    )}
                </div>
            </div>
        </div>

        <Sheet open={viewingHostId !== null} onOpenChange={(open) => !open && setViewingHostId(null)}>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>Host Profile</SheetTitle>
                    {hostProfile && <SheetDescription>{hostProfile.userId}</SheetDescription>}
                </SheetHeader>
                <div className="px-4 pb-4">
                    {hostProfileLoading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : hostProfile ? (
                        <>
                            <div className="flex items-center gap-3">
                                <Avatar className="size-16">
                                    <AvatarImage src={hostProfile.photoUrl || undefined} alt={hostProfile.name} />
                                    <AvatarFallback className="bg-worker-tint text-lg font-semibold text-(--worker-text)">
                                        {initialsOf(hostProfile.name)}
                                    </AvatarFallback>
                                    {hostProfile.isOnline && <AvatarBadge className="bg-(--success-start)" />}
                                </Avatar>
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <p className="truncate text-base font-semibold text-ink">{hostProfile.name}</p>
                                        {hostProfile.isVerified && <BadgeCheck className="size-4 fill-blue-500 text-white" />}
                                    </div>
                                </div>
                            </div>

                            <Separator className="my-4" />

                            <div className="space-y-3 text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-muted">Rating</span>
                                    {hostProfile.ratingCount > 0 ? (
                                        <span className="flex items-center gap-1 font-medium text-ink">
                                            <Star className="size-3.5 fill-amber-400 text-amber-400" />
                                            {hostProfile.ratingAsHost.toFixed(1)} ({hostProfile.ratingCount})
                                        </span>
                                    ) : (
                                        <span className="text-muted">No ratings yet</span>
                                    )}
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted">Posted gigs completed</span>
                                    <span className="flex items-center gap-1 font-medium text-ink">
                                        <Briefcase className="size-3.5" />
                                        {hostProfile.completedGigCount}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted">Member since</span>
                                    <span className="flex items-center gap-1 font-medium text-ink">
                                        <CalendarDays className="size-3.5" />
                                        {hostProfile.memberSince ? formatDate(hostProfile.memberSince) : "Unknown"}
                                    </span>
                                </div>
                                {hostProfile.company && (
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-muted">Company</span>
                                        <span className="flex min-w-0 items-center gap-1.5 truncate font-medium text-ink">
                                            <Building2 className="size-3.5 shrink-0" />
                                            <span className="truncate">{hostProfile.company}</span>
                                        </span>
                                    </div>
                                )}
                                {hostProfile.email && (
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-muted">Email</span>
                                        <span className="flex min-w-0 items-center gap-1.5 truncate font-medium text-ink">
                                            <Mail className="size-3.5 shrink-0" />
                                            <span className="truncate">{maskEmail(hostProfile.email)}</span>
                                        </span>
                                    </div>
                                )}
                            </div>

                            {hostProfile.bio && (
                                <>
                                    <Separator className="my-4" />
                                    <p className="mb-2 text-sm font-medium text-muted">About</p>
                                    <p className="text-sm whitespace-pre-line text-ink">{hostProfile.bio}</p>
                                </>
                            )}
                        </>
                    ) : (
                        <p className="text-sm text-destructive">Couldn&apos;t load this host&apos;s profile.</p>
                    )}
                </div>

                {hostProfile && hostProfile.uid !== uid && (
                    <SheetFooter className="flex-row justify-start gap-1 border-t border-hairline pt-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-orange-500 hover:bg-orange-50 hover:text-orange-600"
                            onClick={() =>
                                setReportTarget({
                                    contentType: "user",
                                    contentId: hostProfile.uid,
                                    contentSnapshot: hostProfile.bio,
                                    reportedUserId: hostProfile.uid,
                                    reportedUserName: hostProfile.name,
                                    reportedUserEmail: hostProfile.email,
                                })
                            }
                        >
                            <Flag className="size-4" />
                            Report
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={blocking}
                            className="gap-1.5 text-red-500 hover:bg-red-50 hover:text-red-600"
                            onClick={handleBlock}
                        >
                            {blocking ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}
                            Block
                        </Button>
                    </SheetFooter>
                )}
            </SheetContent>
        </Sheet>

        <Dialog open={reportTarget !== null} onOpenChange={closeReportDialog}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {reportTarget?.contentType === "gig" ? `Report "${reportTarget.contentSnapshot}"` : `Report ${reportTarget?.reportedUserName}`}
                    </DialogTitle>
                    <DialogDescription>Tell us what&apos;s wrong. Reports are confidential.</DialogDescription>
                </DialogHeader>

                {reportSubmitted ? (
                    <p className="text-sm text-ink">Report received. Our team will review and resolve this within 24 hours.</p>
                ) : (
                    <>
                        <div className="space-y-1.5">
                            {REPORT_REASONS.map((reason) => (
                                <button
                                    key={reason}
                                    type="button"
                                    onClick={() => setReportReason(reason)}
                                    className={cn(
                                        "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                                        reportReason === reason ? "border-worker bg-worker-tint text-ink" : "border-hairline hover:bg-mist"
                                    )}
                                >
                                    {reason}
                                    {reportReason === reason && <Check className="size-4 text-(--worker-text)" />}
                                </button>
                            ))}
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="report-details">Additional details (optional)</Label>
                            <Textarea
                                id="report-details"
                                value={reportDetails}
                                onChange={(e) => setReportDetails(e.target.value)}
                                rows={3}
                                placeholder="Add any extra context…"
                            />
                        </div>
                    </>
                )}

                <DialogFooter>
                    {reportSubmitted ? (
                        <Button onClick={() => closeReportDialog(false)}>Done</Button>
                    ) : (
                        <>
                            <Button variant="outline" onClick={() => closeReportDialog(false)} disabled={reportSubmitting}>
                                Cancel
                            </Button>
                            <Button
                                disabled={!reportReason || reportSubmitting}
                                onClick={handleSubmitReport}
                                className="bg-worker text-white hover:bg-(--worker-end)"
                            >
                                {reportSubmitting ? "Submitting…" : "Submit report"}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    )
}

export default Browse
