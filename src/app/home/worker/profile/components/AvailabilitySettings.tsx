"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useAppSelector } from "@/store/hooks";
import { useUpdateProfile } from "@/store/useUpdateProfile";
import type { UserProfile } from "@/store/userSlice";

// Mirrors giggre_app's worker dashboard toggles (AvailabilityCard /
// WorkPreferencesCard in dashboard_summary_card.dart, wired up in
// gig_worker_screen.dart's _setToggle/_toggleQuickGigs):
// - availableForGigs: worker can be matched to gigs at all.
// - seekingQuickGigs: opts into the Quick Gig auto-matching pool; turning it
//   on force-enables availableForGigs (one-way dependency in the app).
// - autoAccept: skips the manual accept/decline window for Quick Gig
//   dispatches — functionally inert unless seekingQuickGigs is also on.
// All three are gated behind verification there too (`_guarded()`).
interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  saving: boolean;
  onCheckedChange: (next: boolean) => void;
}

function ToggleRow({ label, description, checked, disabled, saving, onCheckedChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-muted">{description}</p>
      </div>
      <Switch checked={checked} disabled={disabled || saving} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export default function AvailabilitySettings() {
  const profile = useAppSelector((root) => root.user.profile);
  const updateProfile = useUpdateProfile();
  const [saving, setSaving] = useState<string | null>(null);

  const isVerified = profile?.isVerified === "verified";
  const availableForGigs = profile?.availableForGigs ?? false;
  const seekingQuickGigs = profile?.seekingQuickGigs ?? false;
  const autoAccept = profile?.autoAccept ?? false;

  async function save(key: string, label: string, next: boolean, updates: Partial<UserProfile>) {
    setSaving(key);
    try {
      await updateProfile(updates);
      toast.success(`${label} turned ${next ? "on" : "off"}`);
    } catch (err) {
      console.error(`Failed to update ${key}:`, err);
      toast.error("Couldn't update setting. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  function handleAvailableChange(next: boolean) {
    // Available for gigs is a prerequisite for Quick Gigs — turning it off
    // takes Quick Gigs with it so the toggles never show a contradictory state.
    save(
      "availableForGigs",
      "Available for gigs",
      next,
      next ? { availableForGigs: true } : { availableForGigs: false, seekingQuickGigs: false }
    );
  }

  function handleQuickGigsChange(next: boolean) {
    save(
      "seekingQuickGigs",
      "Quick Gigs",
      next,
      next ? { seekingQuickGigs: true, availableForGigs: true } : { seekingQuickGigs: false }
    );
  }

  function handleAutoAcceptChange(next: boolean) {
    save("autoAccept", "Auto Accept", next, { autoAccept: next });
  }

  return (
    <div>
      <p className="text-sm font-medium text-muted">Availability</p>
      {!isVerified && (
        <p className="mt-1 text-xs text-muted">Verify your account to change availability settings.</p>
      )}
      <div className="mt-2 divide-y divide-hairline">
        <ToggleRow
          label="Available for gigs"
          description="Turn on to be eligible for gig matching."
          checked={availableForGigs}
          disabled={!isVerified}
          saving={saving === "availableForGigs"}
          onCheckedChange={handleAvailableChange}
        />
        <ToggleRow
          label="Quick Gigs"
          description="Get auto-matched to nearby Quick Gigs."
          checked={seekingQuickGigs}
          disabled={!isVerified}
          saving={saving === "seekingQuickGigs"}
          onCheckedChange={handleQuickGigsChange}
        />
        <ToggleRow
          label="Auto Accept"
          description="Skip the review window and auto-accept Quick Gig offers."
          checked={autoAccept}
          disabled={!isVerified}
          saving={saving === "autoAccept"}
          onCheckedChange={handleAutoAcceptChange}
        />
      </div>
    </div>
  );
}
