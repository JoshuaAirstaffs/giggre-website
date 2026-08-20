"use client";

import { Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppSelector } from "@/store/hooks";

// Mirrors giggre_app/lib/features/gig_worker/presentation/widgets/toolchest_sheet.dart's
// _SkillChip — `skillsXP` (skill name -> level) is the source of truth once a
// worker has any; `skills` (a plain name list, level implied as 1) is the
// fallback for accounts that predate skillsXP or have none awarded yet.
export default function SkillsCard() {
  const profile = useAppSelector((root) => root.user.profile);

  const fromXP = Object.entries(profile?.skillsXP ?? {});
  const entries = fromXP.length > 0 ? fromXP : (profile?.skills ?? []).map((name) => [name, 1] as const);

  return (
    <Card className="py-6 px-8">
      <CardHeader className="p-0">
        <CardTitle className="text-sm font-medium text-muted">Skills</CardTitle>
      </CardHeader>
      <CardContent className="mt-2 p-0">
        {entries.length === 0 ? (
          <p className="text-sm text-muted">No skills yet. Request a skill from admin to get started.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {entries.map(([name, level]) => (
              <div
                key={name}
                className="flex items-center gap-2 rounded-full border border-worker/35 bg-worker-tint py-1.5 pr-1.5 pl-2.5"
              >
                <Wrench className="size-3.5 text-worker" />
                <span className="text-sm font-medium text-ink">{name}</span>
                <span className="rounded-full bg-worker/12 px-2 py-0.5 text-xs font-bold text-worker">
                  Lvl {level}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
