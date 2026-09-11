"use client";

import { LoaderCircle, LocateFixed, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { currencySymbol } from "@/lib/utils";
import type { CommonGigFieldsState } from "./useCommonGigFields";
import type { GigLocation } from "@/lib/post-gig";
import LocationMapPicker from "./LocationMapPicker";

function ClearableInput({
  id,
  type,
  value,
  onChange,
  clearLabel,
}: {
  id: string;
  type: "date" | "time";
  value: string;
  onChange: (value: string) => void;
  clearLabel: string;
}) {
  return (
    <div className="relative">
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={clearLabel}
          className="absolute top-1/2 right-2 -translate-y-1/2"
        >
          <X className="size-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

interface CommonGigDetailsProps {
  fields: CommonGigFieldsState;
  setField: <K extends keyof CommonGigFieldsState>(key: K, value: CommonGigFieldsState[K]) => void;
  currencyCode: string;
  // Slot for a field only one gig type needs, positioned right after the
  // Budget/Workers-needed row — e.g. OfferedGigForm's worker picker.
  afterBudget?: React.ReactNode;
  // Replaces the default editable "Workers needed" input — for Offered gigs
  // the slot count isn't a target the host types in, it's just how many
  // workers they've picked (see OfferedGigInput in post-gig.ts), so
  // OfferedGigForm passes a read-only count here instead.
  workerSlotsField?: React.ReactNode;
}

// Title/description/budget — the "what and how much" side of the form.
// Rendered in the left column; CommonGigFieldsSchedule (below) goes right.
export function CommonGigDetails({
  fields,
  setField,
  currencyCode,
  afterBudget,
  workerSlotsField,
}: CommonGigDetailsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="gig-title">
          Title <span className="text-destructive">*</span>
        </Label>
        <Input
          id="gig-title"
          value={fields.title}
          onChange={(e) => setField("title", e.target.value)}
          placeholder="e.g. Move a couch, Weekend yard work"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="gig-description">
          Description <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="gig-description"
          value={fields.description}
          onChange={(e) => setField("description", e.target.value)}
          placeholder="What does the job involve?"
          rows={3}
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="gig-budget">
            Budget per worker <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
              {currencySymbol(currencyCode)}
            </span>
            <Input
              id="gig-budget"
              type="number"
              min={0}
              className="pl-6"
              value={fields.budget}
              onChange={(e) => setField("budget", e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="gig-slots">
            Workers needed <span className="text-destructive">*</span>
          </Label>
          {workerSlotsField ?? (
            <Input
              id="gig-slots"
              type="number"
              min={1}
              value={fields.workerSlots}
              onChange={(e) => setField("workerSlots", e.target.value)}
            />
          )}
        </div>
      </div>

      {afterBudget}
    </div>
  );
}

interface CommonGigScheduleProps {
  fields: CommonGigFieldsState;
  setField: <K extends keyof CommonGigFieldsState>(key: K, value: CommonGigFieldsState[K]) => void;
  setLocation: (location: GigLocation) => void;
  locating: boolean;
  captureLocation: () => void;
}

// Schedule + location — the "when and where" side of the form. Rendered in
// the right column.
export function CommonGigSchedule({
  fields,
  setField,
  setLocation,
  locating,
  captureLocation,
}: CommonGigScheduleProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>
          Scheduled date &amp; time <span className="text-destructive">*</span>
        </Label>
        <div className="flex gap-3">
          <div className="flex-1 space-y-1">
            <Label htmlFor="gig-schedule-date" className="text-xs font-normal text-muted-foreground">
              Date
            </Label>
            <ClearableInput
              id="gig-schedule-date"
              type="date"
              value={fields.scheduledDate}
              onChange={(v) => setField("scheduledDate", v)}
              clearLabel="Clear date"
            />
          </div>
          <div className="flex-1 space-y-1">
            <Label htmlFor="gig-schedule-time" className="text-xs font-normal text-muted-foreground">
              Time
            </Label>
            <ClearableInput
              id="gig-schedule-time"
              type="time"
              value={fields.scheduledTime}
              onChange={(v) => setField("scheduledTime", v)}
              clearLabel="Clear time"
            />
          </div>
        </div>
        <p className="text-xs text-muted">A date without a time defaults to 8:00 AM.</p>
      </div>

      <div className="space-y-1.5">
        <Label>
          Location <span className="text-destructive">*</span>
        </Label>
        <LocationMapPicker
          location={fields.location}
          onLocationChange={setLocation}
          locating={locating}
          onUseCurrentLocation={captureLocation}
        />
        <div className="flex gap-2">
          <Input
            id="gig-address"
            className="flex-1 bg-input/50 text-muted-foreground"
            value={fields.address}
            readOnly
            placeholder="Street address"
          />
          <Button type="button" variant="outline" onClick={captureLocation} disabled={locating}>
            {locating ? <LoaderCircle className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
            Use current location
          </Button>
        </div>
        <p className="text-xs text-muted">Auto-filled from the map — drag the pin or search above to change it.</p>
      </div>
    </div>
  );
}
