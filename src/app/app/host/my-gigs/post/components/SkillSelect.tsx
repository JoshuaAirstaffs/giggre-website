"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";

const OTHER = "__other__";

/** True when `skill` isn't one of the library skills (typed under "Other"). */
export const isCustomSkill = (skill: string, skills: string[]) =>
  !!skill.trim() && !skills.some((s) => s.toLowerCase() === skill.trim().toLowerCase());

/**
 * "Required skill" for Open / Offered gigs: the skills library plus
 * "Other (not listed)", which opens a box to type the skill — same as the
 * app's skill picker.
 */
export function SkillSelect({ value, onChange, skills }: {
  value: string;
  onChange: (skill: string) => void;
  skills: string[];
}) {
  // "Other" stays open once picked, even while the box is still empty.
  const [otherOpen, setOtherOpen] = useState(false);
  const custom = otherOpen || isCustomSkill(value, skills);

  return (
    <div className="space-y-1.5">
      <Label>
        Required skill <span className="text-destructive">*</span>
      </Label>
      <Select
        value={custom ? OTHER : value}
        onValueChange={(v) => {
          if (v === OTHER) {
            setOtherOpen(true);
            if (!isCustomSkill(value, skills)) onChange("");
          } else {
            setOtherOpen(false);
            onChange(v ?? "");
          }
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a skill">
            {custom ? "Other (not listed)" : value || "Select a skill"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {skills.map((skill) => (
            <SelectItem key={skill} value={skill}>
              {skill}
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem value={OTHER}>Other (not listed)</SelectItem>
        </SelectContent>
      </Select>
      {custom && (
        <Input
          autoFocus
          maxLength={40}
          placeholder="Type the skill, e.g. Aircon cleaning"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\s+/g, " ").replace(/^\s/, ""))}
          onBlur={() => {
            // Same as a library skill if it matches one (any capitalisation).
            const match = skills.find((s) => s.toLowerCase() === value.trim().toLowerCase());
            if (match) {
              setOtherOpen(false);
              onChange(match);
            } else {
              onChange(value.trim());
            }
          }}
        />
      )}
    </div>
  );
}
