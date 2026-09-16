"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, LocateFixed, Maximize2, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { loadGoogleMapsLibrary as loadGoogleMaps, loadGooglePlacesLibrary as loadGooglePlaces } from "@/lib/google-maps";
import type { GigLocation } from "@/lib/post-gig";

interface MapCanvasProps {
  location: GigLocation | null;
  onLocationChange: (location: GigLocation) => void;
  locating: boolean;
  onUseCurrentLocation: () => void;
  heightClassName: string;
  expandButton?: React.ReactNode;
}

// The actual map + pin + search box + "use current location" control.
// Rendered twice by LocationMapPicker below — once as the small inline
// preview, once (bigger) inside the full-screen dialog — each is its own
// independent map/Autocomplete instance kept in sync through the shared
// `location` prop, same as any external location change already was.
function MapCanvas({
  location,
  onLocationChange,
  locating,
  onUseCurrentLocation,
  heightClassName,
  expandButton,
}: MapCanvasProps) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const skipNextIdleRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(({ Map }) => {
        if (cancelled || !mapDivRef.current) return;
        const map = new Map(mapDivRef.current, {
          center: location ?? { lat: 20, lng: 0 },
          zoom: location ? 16 : 2,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
        });
        // Google fires one "idle" right after creation/tile-load, unrelated
        // to any user action — skip it so mounting doesn't itself overwrite
        // an unset location with the fallback center.
        skipNextIdleRef.current = true;
        map.addListener("idle", () => {
          if (skipNextIdleRef.current) {
            skipNextIdleRef.current = false;
            return;
          }
          const center = map.getCenter();
          if (center) onLocationChange({ lat: center.lat(), lng: center.lng() });
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
    };
    // Map is created once per mount — location updates afterward pan the
    // existing instance instead (see the effect below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pans to `location` when it changes from outside this component (the
  // "Use current location" button, a search match, or a drag on the other
  // map instance) — but only then. `location` also changes right after this
  // very map reports its own idle event (a drag, or just a zoom-control
  // click, since zooming fires "idle" too), and reacting to that self-echo
  // by re-panning and force-zooming back to 16 is what made zooming out
  // require several clicks to "win" against the reset. Comparing against
  // the map's own current center tells the two cases apart: if it's already
  // sitting on `location`, there's nothing to do.
  useEffect(() => {
    if (!mapRef.current || !location) return;
    const current = mapRef.current.getCenter();
    const epsilon = 1e-7; // ~1cm of latitude — well below any real pan
    if (current && Math.abs(current.lat() - location.lat) < epsilon && Math.abs(current.lng() - location.lng) < epsilon) {
      return;
    }
    skipNextIdleRef.current = true;
    mapRef.current.panTo(location);
    if (mapRef.current.getZoom()! < 16) mapRef.current.setZoom(16);
  }, [location]);

  // Same search-with-suggestions experience as the host app's map picker
  // (post_quick_gig_screen.dart's _fetchSuggestions/_selectSuggestion) —
  // restricted to the Philippines there too. The app fetches suggestions
  // from the Places Autocomplete REST API directly, which it notes is
  // CORS-blocked on web; the JS Autocomplete widget used here is Google's
  // browser-native equivalent of that same feature.
  useEffect(() => {
    let cancelled = false;
    loadGooglePlaces()
      .then(({ Autocomplete }) => {
        if (cancelled || !searchInputRef.current) return;
        const autocomplete = new Autocomplete(searchInputRef.current, {
          fields: ["geometry", "formatted_address"],
          componentRestrictions: { country: "ph" },
        });
        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const loc = place.geometry?.location;
          if (loc) onLocationChange({ lat: loc.lat(), lng: loc.lng() });
        });
      })
      .catch((err) => console.error("Failed to load Places Autocomplete:", err));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input ref={searchInputRef} placeholder="Search for a place or address" className="pl-8" />
      </div>

      <div className={`relative w-full overflow-hidden rounded-lg border border-input ${heightClassName}`}>
        <div ref={mapDivRef} className="h-full w-full" />

        {!ready && !loadError && (
          <div className="absolute inset-0 flex items-center justify-center bg-secondary">
            <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {loadError && (
          <div className="absolute inset-0 flex items-center justify-center bg-secondary px-4 text-center text-sm text-destructive">
            Couldn&apos;t load the map. You can still set the address manually below.
          </div>
        )}

        {ready && (
          <MapPin className="pointer-events-none absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-full fill-red-500 text-red-500 drop-shadow-md" />
        )}

        <div className="absolute top-2 right-2 flex gap-2">
          {expandButton}
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="bg-background"
            onClick={onUseCurrentLocation}
            disabled={locating}
            aria-label="Use current location"
          >
            {locating ? <LoaderCircle className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface LocationMapPickerProps {
  location: GigLocation | null;
  onLocationChange: (location: GigLocation) => void;
  locating: boolean;
  onUseCurrentLocation: () => void;
}

export default function LocationMapPicker({
  location,
  onLocationChange,
  locating,
  onUseCurrentLocation,
}: LocationMapPickerProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-2">
      <MapCanvas
        location={location}
        onLocationChange={onLocationChange}
        locating={locating}
        onUseCurrentLocation={onUseCurrentLocation}
        heightClassName="h-64"
        expandButton={
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="bg-background"
            onClick={() => setExpanded(true)}
            aria-label="Expand map to full screen"
          >
            <Maximize2 className="size-4" />
          </Button>
        }
      />
      <p className="text-xs text-muted">Drag the map so the pin sits on the right spot.</p>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="flex h-[90vh] max-w-none w-[95vw] flex-col sm:max-w-none">
          <DialogHeader>
            <DialogTitle>Choose location</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1">
            <MapCanvas
              location={location}
              onLocationChange={onLocationChange}
              locating={locating}
              onUseCurrentLocation={onUseCurrentLocation}
              heightClassName="flex-1 min-h-0"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
