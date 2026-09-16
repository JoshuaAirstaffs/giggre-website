"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { countryCodeFromCoordinates } from "@/lib/browse-gigs";
import { currencyCodeForCountry, reverseGeocode, type GigLocation } from "@/lib/post-gig";
import { useAppSelector } from "@/store/hooks";

export interface CommonGigFieldsState {
  title: string;
  description: string;
  budget: string;
  workerSlots: string;
  // Matches giggre_app's own schema exactly (post_*_gig_screen.dart's
  // _pickDate/_pickTime, combined into a single `scheduledDate` — the app
  // has no end-date/end-time concept at all, confirmed by grepping the
  // whole app for one). Kept as separate date/time inputs, each
  // independently clearable, combined into one DateTime at submit time.
  scheduledDate: string;
  scheduledTime: string;
  address: string;
  location: GigLocation | null;
  // Derived from `location` (see setLocation below) — drives both the
  // budget field's currency prefix and the cross-country check.
  countryCode: string | null;
}

const emptyCommonFields: CommonGigFieldsState = {
  title: "",
  description: "",
  budget: "",
  workerSlots: "1",
  scheduledDate: "",
  scheduledTime: "",
  address: "",
  location: null,
  countryCode: null,
};

export function useCommonGigFields() {
  const profile = useAppSelector((root) => root.user.profile);
  const [fields, setFields] = useState<CommonGigFieldsState>(emptyCommonFields);
  const [locating, setLocating] = useState(false);
  // The host's own current location — separate from `fields.location` (the
  // picked gig location) — used only for the cross-country check below.
  // Mirrors the worker browse page's `myLocation`: seed from the saved
  // profile location, then refresh with a live GPS fix if granted.
  const [hostLocation, setHostLocation] = useState<GigLocation | null>(
    profile?.location ? { lat: profile.location.latitude, lng: profile.location.longitude } : null
  );
  const [hostCountryCode, setHostCountryCode] = useState<string | null>(null);
  // Guards against an earlier drag's reverse-geocode resolving after a later
  // one and clobbering the address with a stale result.
  const geocodeRequestId = useRef(0);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setHostLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }, []);

  // Resolves the host's own country once (from whichever hostLocation is
  // known — profile-seeded, then refined by the GPS fix above), so the
  // cross-country check in validateCommon doesn't need its own network
  // round trip at submit time.
  useEffect(() => {
    if (!hostLocation) return;
    let cancelled = false;
    countryCodeFromCoordinates(hostLocation.lat, hostLocation.lng).then((code) => {
      if (!cancelled) setHostCountryCode(code);
    });
    return () => {
      cancelled = true;
    };
  }, [hostLocation]);

  function setField<K extends keyof CommonGigFieldsState>(key: K, value: CommonGigFieldsState[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  // Used both by the "use current location" button and the map picker
  // (drag-to-pan and search) — sets the pin immediately, then fills in the
  // address text and currency-driving country code once reverse-geocoded.
  function setLocation(location: GigLocation) {
    setFields((f) => ({ ...f, location }));
    const requestId = ++geocodeRequestId.current;
    reverseGeocode(location.lat, location.lng).then(({ address, countryCode }) => {
      if (requestId !== geocodeRequestId.current) return;
      setFields((f) => ({ ...f, countryCode, ...(address ? { address } : {}) }));
    });
  }

  function captureLocation() {
    if (!navigator.geolocation) {
      toast.error("Your browser doesn't support location access.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        toast.error("Couldn't get your location. Please allow location access and try again.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  function reset() {
    setFields(emptyCommonFields);
  }

  // Combines the separate date/time inputs into one Date, same as the app's
  // submit-time logic — a date with no time defaults to 8:00 AM
  // (post_open_gig_screen.dart line ~303: `TimeOfDay(hour: 8, minute: 0)`).
  function getScheduledDate(): Date | null {
    if (!fields.scheduledDate) return null;
    const [year, month, day] = fields.scheduledDate.split("-").map(Number);
    let hour = 8;
    let minute = 0;
    if (fields.scheduledTime) {
      [hour, minute] = fields.scheduledTime.split(":").map(Number);
    }
    return new Date(year, month - 1, day, hour, minute);
  }

  // Shared across Quick/Open/Offered — each caller still checks its own
  // extra fields (skill, worker, etc.) before submitting.
  function validateCommon(): string | null {
    if (!fields.title.trim()) return "Please enter a title.";
    if (!fields.description.trim()) return "Please enter a description.";
    const budget = Number(fields.budget);
    if (!fields.budget.trim() || Number.isNaN(budget) || budget <= 0) {
      return "Please enter a valid budget.";
    }
    const workerSlots = Number(fields.workerSlots);
    if (!fields.workerSlots.trim() || Number.isNaN(workerSlots) || workerSlots < 1) {
      return "Worker slots must be at least 1.";
    }
    if (!fields.location) return "Please set the gig location.";
    if (!fields.address.trim()) return "Please enter an address.";
    // Mirrors the app's own validation exactly (post_*_gig_screen.dart): only
    // the date is required — time defaults to 8:00 AM if left unset.
    if (!fields.scheduledDate) return "Schedule is required. Please pick a date and time.";
    const scheduled = getScheduledDate();
    if (!scheduled) return "Schedule is required. Please pick a date and time.";
    if (scheduled.getTime() < Date.now()) {
      return "That time has already passed. Please choose a time in the future.";
    }

    // Mirrors the app's "Outside Your Country" check (post_*_gig_screen.dart,
    // via lib/core/utils/country_check.dart) — a host can only post a gig in
    // their own country. Same fail-open behavior as there and as the
    // worker-side equivalent in browse/page.tsx's passPreflightChecks: if
    // either country is unknown, the check is skipped rather than blocking
    // the post. Both sides are already cached (hostCountryCode above,
    // fields.countryCode from setLocation) — no fetch needed here.
    if (hostCountryCode && fields.countryCode && hostCountryCode !== fields.countryCode) {
      return "This gig's location is in a different country than yours. Choose a location closer to you.";
    }
    return null;
  }

  const currencyCode = currencyCodeForCountry(fields.countryCode);

  return {
    fields,
    setField,
    setLocation,
    locating,
    captureLocation,
    reset,
    validateCommon,
    getScheduledDate,
    currencyCode,
  };
}
