"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { loadGoogleMapsLibrary, loadGoogleMarkerLibrary } from "@/lib/google-maps";

interface GigLocationMapProps {
  location: { lat: number; lng: number };
}

// Read-only — unlike the gig-posting picker (LocationMapPicker.tsx), there's
// nothing to drag or search here, so this uses a real Marker pinned to the
// exact coordinate rather than the picker's "fixed at screen-center" CSS pin,
// which would drift away from the actual location as soon as the map is
// panned for a closer look.
export default function GigLocationMap({ location }: GigLocationMapProps) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadGoogleMapsLibrary(), loadGoogleMarkerLibrary()])
      .then(([{ Map }, { Marker }]) => {
        if (cancelled || !mapDivRef.current) return;
        const map = new Map(mapDivRef.current, {
          center: location,
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
        });
        new Marker({ map, position: location });
        setReady(true);
      })
      .catch((err) => {
        console.error("Failed to load Google Maps:", err);
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
    // `location` is fixed for the lifetime of this read-only view — no need
    // to re-init the map if it somehow changed identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative h-48 w-full overflow-hidden rounded-lg border border-input">
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
  );
}
