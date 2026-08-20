'use client'

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { collection, query, where, orderBy, limit, getDocs, Timestamp, GeoPoint } from 'firebase/firestore';
import { db } from '../../../../lib/firebase'
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { Briefcase, FileText, MapIcon, Search, Tag, Wallet } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useAppSelector } from "@/store/hooks";

interface OpenGig {
    id: string
    title?: string
    hostName?: string
    budget?: number
    schedule?: string
    distance?: string
    status?: string
    description?: string
    createdAt?: Timestamp
    requiredSkills?: string[]
    address?: string
    experienceLevel?: string
    currencyCode?: string
    location?: GeoPoint
}

function timeAgo(timestamp?: Timestamp) {
    if (!timestamp?.toDate) return null;
    const seconds = Math.max(0, (Date.now() - timestamp.toDate().getTime()) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function pluralize(value: number, unit: string) {
    return `${value} ${unit}${value === 1 ? "" : "s"} ago`;
}

function currencySymbol(currency?: string) {
    if (currency === 'USD') return '$'
    return '₱'
}

function salary(currency?: string, budget?: number) {
    if (budget === undefined) return "Rate not specified";
    return `${currencySymbol(currency)}${budget.toLocaleString()}`
}

function formatPostedAge(timestamp?: Timestamp) {
    if (!timestamp?.toDate) return null;
    const days = Math.floor(Math.max(0, (Date.now() - timestamp.toDate().getTime()) / 86_400_000));

    if (days < 1) return "Today";
    if (days < 7) return pluralize(days, "day");
    if (days < 30) return pluralize(Math.floor(days / 7), "week");
    if (days < 365) return pluralize(Math.floor(days / 30), "month");
    return pluralize(Math.floor(days / 365), "year");
}

function capitalize(word?: string) {
    if (!word) return "";
    return word.charAt(0).toUpperCase() + word.slice(1);
}

function initialsOf(name?: string) {
    if (!name) return "?";
    return name.trim().charAt(0).toUpperCase();
}

const Browse = () => {
    const [openGigs, setOpenGigs] = useState<OpenGig[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const user = useAppSelector((root) => root.user)
    console.log(user)

    const getOpenGigs = async () => {
        setLoading(true)
        setError(null)
        try {
            const q = query(
                collection(db, 'open_gigs'),
                where('status', '==', 'open'),
                orderBy('createdAt', 'desc'),
                limit(20),
            );
            const snap = await getDocs(q);
            setOpenGigs(snap.docs.map(d => ({ id: d.id, ...d.data() } as OpenGig)));
        } catch (err) {
            console.error("Failed to load open gigs:", err);
            setError("Couldn't load gigs. Please try again.");
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        getOpenGigs();
    }, [])

    const filteredGigs = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return openGigs;
        return openGigs.filter((gig) =>
            gig.title?.toLowerCase().includes(term) ||
            gig.hostName?.toLowerCase().includes(term)
        );
    }, [openGigs, searchTerm]);

    useEffect(() => {
        if (!selectedId && filteredGigs.length > 0) {
            setSelectedId(filteredGigs[0].id);
        }
    }, [filteredGigs, selectedId]);

    const selectedGig = filteredGigs.find((gig) => gig.id === selectedId) ?? null;

    const AvatarHost = ({ hostname }: { hostname?: string }) => {

        return (<Avatar className="h-20 w-20 rounded-2xl after:rounded-2xl">
            <AvatarFallback className="rounded-2xl bg-worker-tint text-2xl font-semibold text-(--worker-text)">{initialsOf(hostname)}</AvatarFallback>
        </Avatar>)
    }

    const Skills = ({ skills }: { skills: string[] | [] }) => {
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


    return (
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
                    <p className="mt-2 text-sm text-muted">
                        {loading ? "Loading open gigs…" : `${filteredGigs.length} open gig${filteredGigs.length === 1 ? "" : "s"}`}
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
                            <p className="rounded-lg border border-dashed border-hairline p-6 text-sm text-muted">No gigs match your search.</p>
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
                                        <span className="shrink-0 font-semibold text-ink">{salary(gig.currencyCode, gig.budget)}/day</span>
                                    </div>
                                    <div className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                                        <MapIcon className="size-3.5 shrink-0" />
                                        <span className="truncate">{gig.address}</span>
                                    </div>
                                    <p className="mt-1 text-xs text-muted">
                                        {formatPostedAge(gig.createdAt)} • {capitalize(gig.experienceLevel)}
                                    </p>
                                    {gig.requiredSkills && gig.requiredSkills.length > 0 && (
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
                            <div className="flex items-start gap-4">
                                <AvatarHost hostname={selectedGig.hostName} />
                                <div className="min-w-0">
                                    <div className="font-display text-xl font-semibold text-ink">{selectedGig.title}</div>
                                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted">
                                        <span>{selectedGig.hostName}</span>
                                        <span aria-hidden>•</span>
                                        <span>{formatPostedAge(selectedGig.createdAt)}</span>
                                    </div>
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
                                    <SectionLabel icon={MapIcon}>Address</SectionLabel>
                                    <p className="mt-1 text-sm text-ink">{selectedGig.address}</p>
                                    {selectedGig.location && (
                                        <a
                                            href={`https://www.google.com/maps?q=${selectedGig.location.latitude},${selectedGig.location.longitude}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-1 inline-block text-sm text-worker hover:underline"
                                        >
                                            See on map
                                        </a>
                                    )}
                                </div>

                                {selectedGig.requiredSkills && selectedGig.requiredSkills.length > 0 && (
                                    <>
                                        <Separator />
                                        <div>
                                            <SectionLabel icon={Tag}>Required Skills</SectionLabel>
                                            <div className="mt-2">
                                                <Skills skills={selectedGig.requiredSkills} />
                                            </div>
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

                            <Button className="mt-6 w-full bg-worker text-white hover:bg-(--worker-end)">Apply</Button>
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

    )
}

export default Browse
