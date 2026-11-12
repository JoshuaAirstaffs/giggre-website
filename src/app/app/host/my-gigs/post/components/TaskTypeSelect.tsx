"use client";

import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fitsSkill, loadGsinTaskTypes, type GsinTaskTypeOption } from "@/lib/gsin-task-types";

/**
 * GSIN task type for a new gig. Hidden until the admin has set up task types
 * (then required — `onAvailable(true)` tells the form). With `skill` (Open /
 * Offered gigs), task types linked to that skill come first as "Suggested",
 * and a single match is picked automatically (the host can still change it).
 */
export function TaskTypeSelect({ value, onChange, skill, onAvailable, disabled }: {
  value: string;
  onChange: (id: string) => void;
  skill?: string;
  onAvailable?: (available: boolean) => void;
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

  return (
    <div className="space-y-1.5">
      <Label>
        Task type <span className="text-destructive">*</span>
      </Label>
      <Select value={value} onValueChange={(v) => { autoPicked.current = ""; onChange(v ?? ""); }} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder}>{options.find((t) => t.id === value)?.name || placeholder}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {suggested.length > 0 && (
            <SelectGroup>
              <SelectLabel>Suggested for {skill?.trim()}</SelectLabel>
              {suggested.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name} <span className="text-muted text-xs">· {t.group}</span>
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          {Object.entries(groups).map(([group, items]) => (
            <SelectGroup key={group}>
              <SelectLabel>{group}</SelectLabel>
              {items.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      {disabled && <p className="text-xs text-muted">Can&apos;t be changed after posting.</p>}
    </div>
  );
}
