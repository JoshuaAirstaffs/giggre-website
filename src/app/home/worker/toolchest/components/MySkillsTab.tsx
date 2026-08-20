"use client";

import { Wrench, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAppSelector } from "@/store/hooks";
import type { SkillRequest } from "@/lib/toolchest";

export default function MySkillsTab({ requests }: { requests: SkillRequest[] }) {
  const profile = useAppSelector((root) => root.user.profile);
  const skillsXP = profile?.skillsXP ?? {};

  const skillsXPKeysLower = new Set(Object.keys(skillsXP).map((k) => k.toLowerCase().trim()));
  const approvedPending = [
    ...new Set(
      requests
        .filter((r) => r.status === "approved" && !skillsXPKeysLower.has(r.skillName.toLowerCase().trim()))
        .map((r) => r.skillName)
        .filter(Boolean)
    ),
  ];

  const entries = Object.entries(skillsXP);
  const hasAny = entries.length > 0 || approvedPending.length > 0;

  if (!hasAny) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-hairline bg-secondary/40 py-16 text-center">
        <Award className="size-9 text-muted" />
        <p className="text-sm font-semibold text-ink">No skills awarded yet.</p>
        <p className="text-xs text-muted">Complete gigs to earn skills from admin.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {entries.map(([name, level]) => (
        <div
          key={name}
          className="flex items-center gap-3 rounded-xl border border-(--quick-start)/35 px-4 py-3"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-(--quick-tint) text-(--quick-text)">
            <Wrench className="size-4" />
          </div>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{name}</p>
          <Badge variant="secondary" className="bg-(--quick-tint) text-(--quick-text)">
            Lvl {level}
          </Badge>
        </div>
      ))}
      {approvedPending.map((name) => (
        <div
          key={name}
          className="flex items-center gap-3 rounded-xl border border-(--quick-start)/35 px-4 py-3"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-(--quick-tint) text-(--quick-text)">
            <Wrench className="size-4" />
          </div>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{name}</p>
          <Badge variant="secondary" className="bg-(--success-tint) text-(--success-text)">
            Approved
          </Badge>
        </div>
      ))}
    </div>
  );
}
