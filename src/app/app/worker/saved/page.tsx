"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bookmark, MapIcon, X } from "lucide-react";
import TitlePage from "@/components/TitlePage";
import JoshDiv from "@/components/DivAnimation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppSelector } from "@/store/hooks";
import { GIG_TYPE_BADGE_CLASSES } from "@/lib/earnings";
import { capitalize, formatSchedule, salary } from "@/lib/gig-format";
import {
  fetchSavedGigs,
  subscribeSavedGigEntries,
  toggleSavedGig,
  type SavedGig,
  type SavedGigEntry,
} from "@/lib/browse-gigs";

// Mirrors saved_screen.dart's Saved tab — a live listener on the bookmark
// ids (subscribeSavedGigEntries) drives a one-shot hydrate of the full gig
// docs (fetchSavedGigs) each time that id set changes, same hybrid the
// Flutter screen uses. Bookmarks are toggled from the Browse page; this
// page is read-only aside from removing one.
export default function SavedGigsPage() {
  const uid = useAppSelector((root) => root.user.authUser?.uid);
  const [entries, setEntries] = useState<SavedGigEntry[]>([]);
  const [entriesLoaded, setEntriesLoaded] = useState(false);
  const [savedGigs, setSavedGigs] = useState<SavedGig[]>([]);
  const [gigsLoading, setGigsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

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

  const loading = !entriesLoaded || gigsLoading;

  async function handleRemove(saved: SavedGig) {
    if (!uid || removingId) return;
    setRemovingId(saved.id);
    try {
      await toggleSavedGig(uid, saved.id, saved.gigType, true);
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
            <Card key={saved.id}>
              <CardContent className="flex items-start gap-4 p-4">
                <div className="min-w-0 flex-1">
                  {saved.gig ? (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-1 font-medium text-ink">{saved.gig.title}</p>
                        <span className="shrink-0 font-semibold text-ink">
                          {salary(saved.gig.currencyCode, saved.gig.budget)}/day
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted">{saved.gig.hostName}</p>
                      <div className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                        <MapIcon className="size-3.5 shrink-0" />
                        <span className="truncate">{saved.gig.address}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted">{formatSchedule(saved.gig.scheduledDate)}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="secondary" className={GIG_TYPE_BADGE_CLASSES[saved.gigType]}>
                          {capitalize(saved.gigType)}
                        </Badge>
                        <span className="text-xs text-muted">{capitalize(saved.gig.status)}</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted italic">This gig is no longer available.</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove bookmark"
                  disabled={removingId === saved.id}
                  onClick={() => handleRemove(saved)}
                >
                  <X className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </JoshDiv>
  );
}
