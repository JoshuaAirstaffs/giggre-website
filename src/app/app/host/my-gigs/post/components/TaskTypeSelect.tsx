"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fitsSkill, loadGsinTaskTypes, type GsinTaskTypeOption } from "@/lib/gsin-task-types";

/**
 * GSIN task type for a new gig. Hidden until the admin has set up task types
 * (then required — `onAvailable(true)` tells the form). With `skill` (Open /
 * Offered gigs), task types linked to that skill come first as "Suggested",
 * and a single match is picked automatically (the host can still change it).
 */
/**
 * `value` for "Other": the host types a task type that isn't in the GSIN
 * Library. The gig saves it as `customTaskType` (no taskTypeId) and an admin
 * assigns a real one in All Gigs.
 */
export const OTHER_TASK_TYPE = "_other";

/** Tidied "Other" text, or an error message. */
export function checkCustomTaskType(text: string): { value: string } | { error: string } {
  const value = text.trim().replace(/\s+/g, " ");
  if (value.length < 2) return { error: "Type the task type (at least 2 characters)." };
  return { value: value.slice(0, 40) };
}

export function TaskTypeSelect({ value, onChange, skill, onAvailable, disabled, customValue = "", onCustomChange }: {
  value: string;
  onChange: (id: string) => void;
  skill?: string;
  onAvailable?: (available: boolean) => void;
  /** Typed task type when `value` is OTHER_TASK_TYPE. */
  customValue?: string;
  /** Offers "Other (not listed)" when set. */
  onCustomChange?: (text: string) => void;
  // Locked once a gig exists — firestore.rules blocks the entire update if
  // taskTypeId is among the changed keys (see commonGigUpdateFields in
  // post-gig.ts), since a Cloud Function derives GSIN codes from it once.
  disabled?: boolean;
}) {
  const [options, setOptions] = useState<GsinTaskTypeOption[] | null>(null);
  const autoPicked = useRef("");

  useEffect(() => {
    loadGsinTaskTypes().then((o) => {
      setOptions(o);
      onAvailable?.(o.length > 0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-pick when the skill points to exactly one task type — only over an
  // empty choice or our own earlier auto-pick, never the host's own pick.
  useEffect(() => {
    if (!options) return;
    if (value && value !== autoPicked.current) return;
    const matches = options.filter((o) => fitsSkill(o, skill));
    const next = matches.length === 1 ? matches[0].id : "";
    if (next === value) return;
    autoPicked.current = next;
    onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, skill]);

  if (!options || options.length === 0) return null;

  const suggested = options.filter((o) => fitsSkill(o, skill));
  const rest = options.filter((o) => !fitsSkill(o, skill));
  const groups = rest.reduce<Record<string, GsinTaskTypeOption[]>>((acc, t) => {
    (acc[t.group] ??= []).push(t);
    return acc;
  }, {});
  const placeholder = "Choose what kind of task this is";
  const isOther = value === OTHER_TASK_TYPE;
  const shown = isOther
    ? disabled && customValue.trim() ? `${customValue.trim()} (Other)` : "Other (not listed)"
    : options.find((t) => t.id === value)?.name || placeholder;

  return (
    <div className="space-y-1.5">
      <Label>
        Task type <span className="text-destructive">*</span>
      </Label>
      <Select value={value} onValueChange={(v) => { autoPicked.current = ""; onChange(v ?? ""); }} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder}>{shown}</SelectValue>
        </SelectTrigger>
        {/* Open as a normal dropdown under the field. The default
            (alignItemWithTrigger) slides the list so the picked item sits on
            the trigger, which squeezes it to a single visible row ("Baby
            Sitting") with only tiny scroll arrows to reach the rest. */}
        <SelectContent alignItemWithTrigger={false} className="max-h-80">
          {suggested.length > 0 && (
            <SelectGroup>
              <SelectLabel>Suggested for {skill?.trim()}</SelectLabel>
              {suggested.map((t) => (
                <SelectItem key={t.id} value={t.id} label={t.name}>
                  {t.name} <span className="text-muted-foreground text-xs">· {t.group}</span>
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          {Object.entries(groups).map(([group, items]) => (
            <SelectGroup key={group}>
              <SelectLabel>{group}</SelectLabel>
              {items.map((t) => (
                <SelectItem key={t.id} value={t.id} label={t.name}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
          {onCustomChange && (
            <SelectGroup>
              <SelectLabel>Not in the list?</SelectLabel>
              <SelectItem value={OTHER_TASK_TYPE} label="Other (not listed)">
                Other (not listed)
              </SelectItem>
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
      {isOther && !disabled && (
        <div className="space-y-1">
          <Input
            value={customValue}
            maxLength={40}
            placeholder="Type the task type, e.g. Pool cleaning"
            onChange={(e) => onCustomChange?.(e.target.value)}
          />
          <p className="text-xs text-muted">Giggre will review it and add it to the list.</p>
        </div>
      )}
      {disabled && <p className="text-xs text-muted">Can&apos;t be changed after posting.</p>}
    </div>
  );
}
