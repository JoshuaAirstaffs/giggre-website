"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, query, where, type GeoPoint } from "firebase/firestore";
import { Navigation, Star } from "lucide-react";
import { db } from "@/lib/firebase";
import { haversineKm } from "@/lib/browse-gigs";
import { ratingAverage, type RatingAggregate } from "@/lib/ratings";
import { useAppSelector } from "@/store/hooks";
import { useDistanceUnits } from "@/hooks/use-distance-units";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Host dashboard "workers online" — same as the app's dashboard card + map
// (gig_host_screen.dart): online workers available for gigs, within 10 of
// the region's unit (10 mi US / 10 km elsewhere). If nobody is that close,
// the nearest online workers are shown instead.

const RANGE = 10; // in the shown unit
const NEAREST_COUNT = 10;

interface OnlineWorker {
  uid: string;
  name: string;
  photoUrl: string;
  skill: string;
  rating: number | null;
  ratingCount: number;
  location: { lat: number; lng: number };
}

export default function WorkersOnlineCard() {
  const uid = useAppSelector((root) => root.user.authUser?.uid);
  const profile = useAppSelector((root) => root.user.profile) as { location?: GeoPoint } | null | undefined;
  const units = useDistanceUnits();
  const [workers, setWorkers] = useState<OnlineWorker[] | null>(null);
  const [freshLocation, setFreshLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [open, setOpen] = useState(false);

  // Host location: the profile's last known spot, refined by the browser.
  const myLocation = freshLocation
    ?? (profile?.location ? { lat: profile.location.latitude, lng: profile.location.longitude } : null);
  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setFreshLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 300_000 },
    );
  }, []);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      query(collection(db, "users"), where("isOnline", "==", true)),
      (snap) => setWorkers(
        snap.docs
          .filter((d) => d.id !== uid && d.data().availableForGigs === true && d.data().location)
          .map((d) => {
            const x = d.data();
            const loc = x.location as GeoPoint;
            const skills = (x.skills as string[] | undefined) ?? [];
            const agg = x.ratingWorker as RatingAggregate | undefined;
            return {
              uid: d.id,
              name: (x.name as string) || "Worker",
              photoUrl: (x.photoUrl as string) ?? "",
              skill: skills[0] ?? "General",
              rating: ratingAverage(agg),
              ratingCount: agg?.count ?? 0,
              location: { lat: loc.latitude, lng: loc.longitude },
            };
          }),
      ),
      (err) => {
        console.warn("[WorkersOnlineCard] online workers:", err.code ?? err);
        setWorkers([]);
      },
    );
  }, [uid]);

  // In range, or the nearest ones when nobody is.
  const { list, nearestKm, inRange } = useMemo(() => {
    const all = workers ?? [];
    if (!myLocation) return { list: all.map((w) => ({ w, km: null as number | null })), nearestKm: null, inRange: all.length };
    const withKm = all
      .map((w) => ({ w, km: haversineKm(myLocation, w.location) as number | null }))
      .sort((a, b) => (a.km ?? 0) - (b.km ?? 0));
    const rangeKm = units.toKm(RANGE);
    const near = withKm.filter((x) => (x.km ?? 0) <= rangeKm);
    if (near.length || !withKm.length) return { list: near, nearestKm: null, inRange: near.length };
    return { list: withKm.slice(0, NEAREST_COUNT), nearestKm: withKm[0].km, inRange: 0 };
  }, [workers, myLocation, units]);

  const rangeText = `${RANGE} ${units.unit}`;
  const headline = workers == null
    ? "Looking for online workers…"
    : nearestKm != null
      ? `No workers within ${rangeText} · nearest ${units.format(nearestKm * 1000)}`
      : myLocation
        ? `${inRange} ${inRange === 1 ? "worker" : "workers"} online within ${rangeText}`
        : `${inRange} ${inRange === 1 ? "worker" : "workers"} online`;

  return (
    <>
      <Card className="flex flex-row items-center gap-3 p-4">
        <span className="size-2.5 shrink-0 rounded-full bg-(--success-start)" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{headline}</p>
          <p className="truncate text-xs text-muted">
            {nearestKm != null ? "View the nearest online workers" : "Ready to receive quick gig offers"}
          </p>
        </div>
        <Button size="sm" variant="outline" disabled={!workers || list.length === 0} onClick={() => setOpen(true)}>
          View
        </Button>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{nearestKm != null ? "Nearest online workers" : "Workers online near you"}</DialogTitle>
            <DialogDescription>
              {nearestKm != null
                ? `Nobody is online within ${rangeText} — these are the closest available workers.`
                : myLocation
                  ? `Available workers within ${rangeText} of you.`
                  : "Allow location to see who's closest."}
            </DialogDescription>
          </DialogHeader>
          {nearestKm != null && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-400/60 bg-amber-50 p-3 text-sm text-ink dark:bg-amber-500/10">
              <Navigation className="mt-0.5 size-4 shrink-0 text-amber-500" />
              <span>No workers within {rangeText}. The nearest is <b>{units.format(nearestKm * 1000)}</b> away.</span>
            </div>
          )}
          <div className="-mx-1 max-h-[55vh] space-y-2 overflow-y-auto px-1">
            {list.map(({ w, km }) => (
              <div key={w.uid} className="flex items-center gap-3 rounded-lg border border-hairline p-3">
                <Avatar className="size-10">
                  {w.photoUrl && <AvatarImage src={w.photoUrl} alt={w.name} />}
                  <AvatarFallback>{w.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{w.name}</p>
                  <p className="flex items-center gap-1.5 truncate text-xs text-muted">
                    {w.skill}
                    {w.rating != null && (
                      <span className="flex items-center gap-0.5">
                        · <Star className="size-3 fill-amber-400 text-amber-400" />
                        {w.rating.toFixed(1)} ({w.ratingCount})
                      </span>
                    )}
                  </p>
                </div>
                {km != null && <span className="shrink-0 text-xs font-medium text-ink">{units.format(km * 1000)}</span>}
              </div>
            ))}
          </div>
          <Button variant="outline" className="w-full" render={<Link href="/app/host/my-gigs/post" />} nativeButton={false}>
            Post a gig
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
