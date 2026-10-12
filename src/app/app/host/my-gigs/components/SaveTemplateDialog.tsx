"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveGigTemplate } from "@/lib/gig-templates";
import type { HostGigDetail } from "@/lib/host-gigs";
import type { ExperienceLevel } from "@/lib/post-gig";
import { useAppSelector } from "@/store/hooks";

// Shared by both entry points ("Save as Template" in the My Gigs table row,
// and on the gig detail page) — the caller is responsible for having a full
// HostGigDetail in hand (the My Gigs table's own rows are the lightweight
// HostGig type, missing description/skill/experience/workDurationHours, so
// that caller fetches the full detail on click via fetchHostGigDetail
// before opening this).
interface SaveTemplateDialogProps {
  gig: HostGigDetail | null;
  onOpenChange: (open: boolean) => void;
}

export default function SaveTemplateDialog({ gig, onOpenChange }: SaveTemplateDialogProps) {
  const authUid = useAppSelector((root) => root.user.authUser?.uid);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const open = gig !== null;

  useEffect(() => {
    // Pre-filled with the gig title, matching TemplateNameDialog in the
    // Flutter app exactly — not reacting to anything else about `gig`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (gig) setName(gig.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gig?.id]);

  async function handleSave() {
    if (!gig || !authUid || !name.trim()) return;
    setSaving(true);
    try {
      // skillRequired is a single field for BOTH open and offered templates
      // (see gig-templates.ts) — open gigs store it as a `requiredSkills`
      // array on the gig doc itself, so only the first (only) entry carries
      // over.
      const skillRequired =
        gig.gigType === "open" ? gig.requiredSkills?.[0] : gig.gigType === "offered" ? gig.skillRequired : undefined;

      const result = await saveGigTemplate({
        hostId: authUid,
        name: name.trim(),
        gigType: gig.gigType,
        title: gig.title,
        description: gig.description,
        budget: gig.ratePerSlot,
        currencyCode: gig.currencyCode,
        skillRequired,
        experienceLevel: gig.experienceLevel as ExperienceLevel | undefined,
        payType: gig.payType === "hourly" ? "hourly" : "flat",
        hourlyRate: gig.payType === "hourly" ? gig.hourlyRate : null,
        workDurationHours: gig.workDurationHours,
        workerSlots: gig.workerSlots,
      });
      if (result.ok) {
        toast.success("Template saved.");
        onOpenChange(false);
      } else {
        toast.error(result.reason);
      }
    } catch (err) {
      console.error("Failed to save template:", err);
      toast.error("Couldn't save this template. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !saving) onOpenChange(false);
      }}
    >
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Save as Template</DialogTitle>
          <DialogDescription>
            Reusable setup only — schedule, location, and any assigned worker are never saved.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="template-name">Template name</Label>
          <Input id="template-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={saving || !name.trim()} onClick={handleSave}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
