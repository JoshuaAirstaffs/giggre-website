"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Heart, Mail, MessageCircle, ShieldCheck, Star, UserRound, UserSearch } from "lucide-react";
import TitlePage from "@/components/TitlePage";
import JoshDiv from "@/components/DivAnimation";
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppSelector } from "@/store/hooks";
import { fetchFavoriteWorkers, removeFavoriteWorker, type WorkerLookupResult } from "@/lib/post-gig";
import { fetchWorkerHistoryWithHost, type WorkerHistoryEntry } from "@/lib/host-gigs";
import { capitalize } from "@/lib/gig-format";
import { maskEmail } from "@/lib/utils";

// A host can only add a worker to favorites from the mobile app today (the
// "Favorite worker" toggle on a completed gig's detail sheet) — this page is
// the web-side view of that same `favoriteWorkerIds` list, with removal
// being the one write the website supports (see removeFavoriteWorker).
export default function HostFavoritesPage() {
  const router = useRouter();
  const uid = useAppSelector((root) => root.user.authUser?.uid);
  const [workers, setWorkers] = useState<WorkerLookupResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [profileWorker, setProfileWorker] = useState<WorkerLookupResult | null>(null);
  const [history, setHistory] = useState<{ applied: WorkerHistoryEntry[]; completed: WorkerHistoryEntry[] } | null>(
    null
  );
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!uid || !profileWorker) return;
    let cancelled = false;
    (async () => {
      setHistoryLoading(true);
      setHistory(null);
      try {
        const result = await fetchWorkerHistoryWithHost(uid, profileWorker.uid);
        if (!cancelled) setHistory(result);
      } catch (err) {
        console.error("Failed to load worker history:", err);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, profileWorker]);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const fetched = await fetchFavoriteWorkers(uid);
        if (!cancelled) setWorkers(fetched);
      } catch (err) {
        console.error("Failed to load favorite workers:", err);
        if (!cancelled) setError("Couldn't load your favorite workers. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const handleQuickOffer = (workerId: string) => {
    router.push(`/app/host/my-gigs/post?tab=offered&workerId=${workerId}`);
  };

  // Opens straight into a direct conversation with this worker — see the
  // ?peer= handling in ChatPage.tsx. No chat_rooms doc is created here; that
  // still only happens lazily on the first message actually sent.
  const handleMessage = (workerId: string) => {
    router.push(`/app/host/chat?peer=${workerId}`);
  };

  const handleRemove = async (workerId: string) => {
    if (!uid) return;
    setRemovingId(workerId);
    try {
      await removeFavoriteWorker(uid, workerId);
      setWorkers((prev) => prev.filter((w) => w.uid !== workerId));
    } catch (err) {
      console.error("Failed to remove favorite worker:", err);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <JoshDiv>
      <TitlePage title="Favorites" description="Workers you've favorited for quick rehiring" />

      <div className="mt-6">
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : workers.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 p-10 text-center">
            <Heart className="size-8 text-muted" />
            <p className="text-sm font-medium text-ink">No favorite workers yet</p>
            <p className="max-w-sm text-sm text-muted">
              Favorite a worker from a completed gig in the Giggre mobile app to have them show up here for quick
              rehiring.
            </p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {workers.map((worker) => (
              <Card key={worker.uid} className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="size-12">
                    <AvatarImage src={worker.photoUrl || undefined} alt={worker.name} />
                    <AvatarFallback className="bg-(--host-end) text-white">
                      {worker.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                    {worker.isOnline && <AvatarBadge className="bg-(--success-start)" />}
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{worker.name}</p>
                    <div className="flex items-center gap-1 text-xs text-muted">
                      <Star className="size-3 fill-amber-400 text-amber-400" />
                      {worker.ratingCount > 0 ? (
                        <span>
                          {worker.ratingAsWorker.toFixed(1)} ({worker.ratingCount})
                        </span>
                      ) : (
                        <span>No ratings yet</span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Message ${worker.name}`}
                      onClick={() => handleMessage(worker.uid)}
                    >
                      <MessageCircle className="size-4 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`View ${worker.name}'s profile`}
                      onClick={() => setProfileWorker(worker)}
                    >
                      <UserRound className="size-4 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${worker.name} from favorites`}
                      disabled={removingId === worker.uid}
                      onClick={() => handleRemove(worker.uid)}
                    >
                      <Heart className="size-4 fill-(--danger-start) text-(--danger-start)" />
                    </Button>
                  </div>
                </div>
                {worker.skills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {worker.skills.slice(0, 3).map((skill) => (
                      <Badge key={skill} variant="secondary" className="text-xs font-normal">
                        {skill}
                      </Badge>
                    ))}
                    {worker.skills.length > 3 && (
                      <Badge variant="secondary" className="text-xs font-normal">
                        +{worker.skills.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 w-full gap-1.5"
                  onClick={() => handleQuickOffer(worker.uid)}
                >
                  <UserSearch className="size-3.5" />
                  Quick Offer
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Sheet open={profileWorker !== null} onOpenChange={(open) => !open && setProfileWorker(null)}>
        <SheetContent>
          {profileWorker && (
            <>
              <SheetHeader>
                <SheetTitle>Worker Profile</SheetTitle>
                <SheetDescription>{profileWorker.userId}</SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-4">
                <div className="flex items-center gap-3">
                  <Avatar className="size-16">
                    <AvatarImage src={profileWorker.photoUrl || undefined} alt={profileWorker.name} />
                    <AvatarFallback className="bg-(--host-end) text-lg text-white">
                      {profileWorker.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                    {profileWorker.isOnline && <AvatarBadge className="bg-(--success-start)" />}
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-base font-semibold text-ink">{profileWorker.name}</p>
                      {profileWorker.isVerified && (
                        <Badge className="gap-1 bg-(--success-tint) text-(--success-text)">
                          <ShieldCheck className="size-3" />
                          Verified
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted">{profileWorker.isOnline ? "Online" : "Offline"}</p>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Rating</span>
                    {profileWorker.ratingCount > 0 ? (
                      <span className="flex items-center gap-1 font-medium text-ink">
                        <Star className="size-3.5 fill-amber-400 text-amber-400" />
                        {profileWorker.ratingAsWorker.toFixed(1)} ({profileWorker.ratingCount})
                      </span>
                    ) : (
                      <span className="text-muted">No ratings yet</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Total gigs done</span>
                    <span className="flex items-center gap-1 font-medium text-ink">
                      <Briefcase className="size-3.5" />
                      {profileWorker.completedGigs}
                    </span>
                  </div>
                  {profileWorker.email && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted">Email</span>
                      <span className="flex min-w-0 items-center gap-1.5 truncate font-medium text-ink">
                        <Mail className="size-3.5 shrink-0" />
                        <span className="truncate">{maskEmail(profileWorker.email)}</span>
                      </span>
                    </div>
                  )}
                </div>

                {profileWorker.skills.length > 0 && (
                  <>
                    <Separator className="my-4" />
                    <p className="mb-2 text-sm font-medium text-muted">Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {profileWorker.skills.map((skill) => (
                        <Badge key={skill} variant="secondary" className="text-xs font-normal">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </>
                )}

                <Separator className="my-4" />
                <p className="mb-2 text-sm font-medium text-muted">Recent gigs with you</p>
                {historyLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className="mb-1.5 text-xs text-muted">Applied</p>
                      {history?.applied.length ? (
                        <div className="space-y-1.5">
                          {history.applied.map((entry, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between gap-2 rounded-lg border border-hairline px-2.5 py-1.5 text-xs"
                            >
                              <span className="truncate text-ink">{entry.title}</span>
                              <span className="shrink-0 text-muted">{capitalize(entry.status.replace(/_/g, " "))}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted">No applications yet.</p>
                      )}
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs text-muted">Completed</p>
                      {history?.completed.length ? (
                        <div className="space-y-1.5">
                          {history.completed.map((entry, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between gap-2 rounded-lg border border-hairline px-2.5 py-1.5 text-xs"
                            >
                              <span className="truncate text-ink">{entry.title}</span>
                              <span className="shrink-0 text-muted">{entry.at.toLocaleDateString()}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted">No completed gigs yet.</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-6 flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 gap-1.5"
                    onClick={() => {
                      handleMessage(profileWorker.uid);
                      setProfileWorker(null);
                    }}
                  >
                    <MessageCircle className="size-3.5" />
                    Message
                  </Button>
                  <Button
                    className="flex-1 gap-1.5"
                    onClick={() => {
                      handleQuickOffer(profileWorker.uid);
                      setProfileWorker(null);
                    }}
                  >
                    <UserSearch className="size-3.5" />
                    Quick Offer
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </JoshDiv>
  );
}
