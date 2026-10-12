"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { loadGoogleMapsLibrary, loadGoogleMarkerLibrary } from "@/lib/google-maps";

interface LatLng {
  lat: number;
  lng: number;
}

export interface TrackedWorker {
  workerId: string;
  workerName: string;
  location: LatLng;
  photoUrl?: string;
}

interface WorkerTrackingMapProps {
  workers: TrackedWorker[];
  destination: LatLng;
}

interface RouteInfo {
  etaSeconds: number;
  distanceMeters: number;
}

// Google's encoded-polyline algorithm, precision 5 — the format OSRM returns
// for geometries=polyline, same as gig_progress_tracker.dart's _fetchRoute.
function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

const AVATAR_SIZE = 40;

function avatarIconFromDataUrl(dataUrl: string): google.maps.Icon {
  return {
    url: dataUrl,
    scaledSize: new google.maps.Size(AVATAR_SIZE, AVATAR_SIZE),
    anchor: new google.maps.Point(AVATAR_SIZE / 2, AVATAR_SIZE / 2),
  };
}

// Solid-color circle + initial — the marker's icon the moment it's created,
// and what it stays as if there's no photoUrl or the photo fails to load.
function buildInitialsAvatarDataUrl(name: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const radius = AVATAR_SIZE / 2 - 2;
  ctx.beginPath();
  ctx.arc(AVATAR_SIZE / 2, AVATAR_SIZE / 2, radius, 0, Math.PI * 2);
  ctx.fillStyle = "#2B6FB5";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#fff";
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name.trim().charAt(0).toUpperCase() || "?", AVATAR_SIZE / 2, AVATAR_SIZE / 2 + 1);
  return canvas.toDataURL();
}

// Circular crop of the worker's photo, same white ring as the initials
// version — resolves null (caller keeps the initials fallback) if the image
// can't be loaded, e.g. a bad URL or a host that blocks canvas access via
// CORS, rather than leaving a broken marker icon.
function buildPhotoAvatarDataUrl(photoUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = AVATAR_SIZE;
        canvas.height = AVATAR_SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        const radius = AVATAR_SIZE / 2 - 2;
        ctx.save();
        ctx.beginPath();
        ctx.arc(AVATAR_SIZE / 2, AVATAR_SIZE / 2, radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
        ctx.restore();
        ctx.beginPath();
        ctx.arc(AVATAR_SIZE / 2, AVATAR_SIZE / 2, radius, 0, Math.PI * 2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
        resolve(canvas.toDataURL());
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = photoUrl;
  });
}

function formatEta(seconds: number) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function formatDistance(meters: number) {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

// One map, showing exactly one worker at a time — a chip row above the map
// (only shown when there's more than one currently-navigating worker) picks
// which one. Worker markers only ever make sense here because the worker's
// device writes `workerLocation` solely while status is 'navigating'
// (working_ui.dart) — the caller is expected to only pass workers currently
// in that status.
export default function WorkerTrackingMap({ workers, destination }: WorkerTrackingMapProps) {
  const [selectedId, setSelectedId] = useState<string | null>(() => workers[0]?.workerId ?? null);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const destMarkerRef = useRef<google.maps.Marker | null>(null);
  const workerMarkerRef = useRef<google.maps.Marker | null>(null);
  // Which worker `workerMarkerRef` currently depicts — lets the effect below
  // tell "same worker, just moved" (reuse the marker + icon) apart from
  // "a different worker got selected" (rebuild the icon for the new one).
  const workerMarkerIdRef = useRef<string | null>(null);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);

  // A cheap, stable key so effects below only re-run when the set of
  // navigating workers (or their positions) actually changes — not on every
  // parent re-render, which would otherwise hand down a fresh array/objects
  // each time.
  const workersKey = workers.map((w) => `${w.workerId}:${w.location.lat}:${w.location.lng}`).join("|");

  // Keep the selection valid as the navigating list changes — e.g. the
  // selected worker arrives (drops off the list), so fall back to whoever's
  // first; pick up the first worker once someone starts navigating after
  // there was nobody to track.
  useEffect(() => {
    // Both branches below react to the parent's (Firestore-driven)
    // navigating-worker list changing, not to local state.
    if (workers.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedId(null);
      return;
    }
    if (!workers.some((w) => w.workerId === selectedId)) {
      setSelectedId(workers[0].workerId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workersKey]);

  const selectedWorker = workers.find((w) => w.workerId === selectedId) ?? null;

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadGoogleMapsLibrary(), loadGoogleMarkerLibrary()])
      .then(([{ Map }, { Marker }]) => {
        if (cancelled || !mapDivRef.current) return;
        const map = new Map(mapDivRef.current, {
          center: destination,
          zoom: 13,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
        });
        destMarkerRef.current = new Marker({
          map,
          position: destination,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#EF4444",
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
          },
        });
        mapRef.current = map;
        setReady(true);
      })
      .catch((err) => {
        console.error("Failed to load Google Maps:", err);
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
      workerMarkerRef.current?.setMap(null);
      polylineRef.current?.setMap(null);
      destMarkerRef.current?.setMap(null);
    };
    // Map + destination marker are created once per mount — the destination
    // itself doesn't change for a given gig.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show/move the marker for whichever worker is currently selected.
  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;
    loadGoogleMarkerLibrary().then(({ Marker }) => {
      if (cancelled || !mapRef.current) return;
      if (!selectedWorker) {
        workerMarkerRef.current?.setMap(null);
        workerMarkerRef.current = null;
        workerMarkerIdRef.current = null;
        return;
      }

      const isNewWorker = workerMarkerIdRef.current !== selectedWorker.workerId;
      if (workerMarkerRef.current && !isNewWorker) {
        workerMarkerRef.current.setPosition(selectedWorker.location);
      } else {
        workerMarkerRef.current?.setMap(null);
        workerMarkerRef.current = new Marker({
          map: mapRef.current,
          position: selectedWorker.location,
          title: selectedWorker.workerName,
          icon: avatarIconFromDataUrl(buildInitialsAvatarDataUrl(selectedWorker.workerName)),
        });
        workerMarkerIdRef.current = selectedWorker.workerId;

        if (selectedWorker.photoUrl) {
          const workerId = selectedWorker.workerId;
          buildPhotoAvatarDataUrl(selectedWorker.photoUrl).then((photoDataUrl) => {
            // Bail if this worker's marker was swapped out (selection
            // changed, or the marker was torn down) while the photo loaded.
            if (cancelled || !photoDataUrl || workerMarkerIdRef.current !== workerId) return;
            workerMarkerRef.current?.setIcon(avatarIconFromDataUrl(photoDataUrl));
          });
        }
      }

      const bounds = new google.maps.LatLngBounds();
      bounds.extend(destination);
      bounds.extend(selectedWorker.location);
      mapRef.current.fitBounds(bounds, 48);
    });
    return () => {
      cancelled = true;
    };
    // Depending on the selected worker's own id/lat/lng (and destination's)
    // rather than the objects themselves — the parent hands down a fresh
    // `workers` array (and thus new location objects) on every render. `ready`
    // is included so this retries once the map finishes loading — on mount,
    // this effect can otherwise run (and bail via the mapRef.current guard)
    // before the async map-init effect above has actually set mapRef.current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorker?.workerId, selectedWorker?.location.lat, selectedWorker?.location.lng, destination.lat, destination.lng, ready]);

  // Fetch the road route for the selected worker only.
  useEffect(() => {
    if (!selectedWorker) {
      polylineRef.current?.setMap(null);
      polylineRef.current = null;
      // Reacting to the selection clearing, not to local state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRouteInfo(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${selectedWorker.location.lng},${selectedWorker.location.lat};${destination.lng},${destination.lat}?overview=full&geometries=polyline`;
        const res = await fetch(url);
        const json = await res.json();
        const route = json?.routes?.[0];
        if (!route || cancelled || !mapRef.current) return;
        setRouteInfo({ etaSeconds: route.duration, distanceMeters: route.distance });
        const path = decodePolyline(route.geometry);
        const { Polyline } = await loadGoogleMapsLibrary();
        if (cancelled) return;
        polylineRef.current?.setMap(null);
        polylineRef.current = new Polyline({
          map: mapRef.current,
          path,
          strokeColor: "#2B6FB5",
          strokeWeight: 4,
        });
      } catch (err) {
        console.error("Failed to fetch worker route:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorker?.workerId, selectedWorker?.location.lat, selectedWorker?.location.lng, destination.lat, destination.lng, ready]);

  return (
    <div className="space-y-2">
      {workers.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {workers.map((w) => (
            <button
              key={w.workerId}
              type="button"
              onClick={() => setSelectedId(w.workerId)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                w.workerId === selectedId
                  ? "border-worker bg-worker text-white"
                  : "border-hairline text-muted hover:bg-accent"
              }`}
            >
              {w.workerName}
            </button>
          ))}
        </div>
      )}

      <div className="relative h-56 w-full overflow-hidden rounded-lg border border-input">
        <div ref={mapDivRef} className="h-full w-full" />

        {!ready && !loadError && (
          <div className="absolute inset-0 flex items-center justify-center bg-secondary">
            <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {loadError && (
          <div className="absolute inset-0 flex items-center justify-center bg-secondary px-4 text-center text-sm text-destructive">
            Couldn&apos;t load the map.
          </div>
        )}
      </div>

      {routeInfo && selectedWorker && (
        <p className="text-xs text-muted">
          {selectedWorker.workerName}: {formatEta(routeInfo.etaSeconds)} away · {formatDistance(routeInfo.distanceMeters)}
        </p>
      )}
    </div>
  );
}
