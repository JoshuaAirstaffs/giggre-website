import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

// Shared across every Google Maps consumer on the site (the gig-posting
// picker, the read-only gig-detail map, etc.) — each library is loaded and
// cached once regardless of how many map instances end up on a page.
let optionsSet = false;
function ensureOptionsSet() {
  if (!optionsSet) {
    setOptions({ key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "", v: "weekly" });
    optionsSet = true;
  }
}

let mapsLibraryPromise: Promise<google.maps.MapsLibrary> | null = null;
export function loadGoogleMapsLibrary(): Promise<google.maps.MapsLibrary> {
  ensureOptionsSet();
  if (!mapsLibraryPromise) mapsLibraryPromise = importLibrary("maps");
  return mapsLibraryPromise;
}

let placesLibraryPromise: Promise<google.maps.PlacesLibrary> | null = null;
export function loadGooglePlacesLibrary(): Promise<google.maps.PlacesLibrary> {
  ensureOptionsSet();
  if (!placesLibraryPromise) placesLibraryPromise = importLibrary("places");
  return placesLibraryPromise;
}

let markerLibraryPromise: Promise<google.maps.MarkerLibrary> | null = null;
export function loadGoogleMarkerLibrary(): Promise<google.maps.MarkerLibrary> {
  ensureOptionsSet();
  if (!markerLibraryPromise) markerLibraryPromise = importLibrary("marker");
  return markerLibraryPromise;
}
