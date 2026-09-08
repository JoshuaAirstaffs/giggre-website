"use client";

import { useMemo, useState } from "react";
import { Search, SearchX, Send, Wrench, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppSelector } from "@/store/hooks";
import {
  STATUS_BADGE_CLASSES,
  requestStatusForSkill,
  statusLabel,
  type SkillCatalogItem,
  type SkillRequest,
} from "@/lib/toolchest";

interface BrowseSkillsTabProps {
  catalog: SkillCatalogItem[];
  loading: boolean;
  requests: SkillRequest[];
  onApply: (skill: SkillCatalogItem) => void;
}

export default function BrowseSkillsTab({ catalog, loading, requests, onApply }: BrowseSkillsTabProps) {
  const skillsXP = useAppSelector((root) => root.user.profile?.skillsXP);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const unawarded = useMemo(() => {
    const skillsXPKeysLower = new Set(Object.keys(skillsXP ?? {}).map((k) => k.toLowerCase().trim()));
    return catalog.filter((s) => !skillsXPKeysLower.has(s.name.toLowerCase().trim()));
  }, [catalog, skillsXP]);

  const categories = useMemo(
    () => [...new Set(unawarded.map((s) => s.category).filter(Boolean))].sort(),
    [unawarded]
  );

  const query = search.toLowerCase().trim();
  const results = unawarded.filter((s) => {
    const matchesSearch = !query || s.name.toLowerCase().includes(query);
    const matchesCategory = !category || s.category === category;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search skills…"
          className="pl-8"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Clear search"
            className="absolute top-1/2 right-2.5 -translate-y-1/2"
          >
            <X className="size-3.5 text-muted" />
          </button>
        )}
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="xs"
            variant={category === null ? "default" : "secondary"}
            className={category === null ? "bg-(--worker-end) text-white hover:bg-(--worker-end)/90" : ""}
            onClick={() => setCategory(null)}
          >
            All
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              size="xs"
              variant={category === cat ? "default" : "secondary"}
              className={category === cat ? "bg-(--worker-end) text-white hover:bg-(--worker-end)/90" : ""}
              onClick={() => setCategory((c) => (c === cat ? null : cat))}
            >
              {cat}
            </Button>
          ))}
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
          Available Skills {results.length > 0 && `· ${results.length}`}
        </p>

        {loading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-hairline bg-secondary/40 py-16 text-center">
            {query || category ? <SearchX className="size-9 text-muted" /> : <Wrench className="size-9 text-muted" />}
            <p className="text-sm font-semibold text-ink">
              {query || category
                ? "No skills match your search."
                : unawarded.length === 0
                  ? "You have all available skills!"
                  : "No skills available yet."}
            </p>
            <p className="text-xs text-muted">
              {query || category ? "Try a different search or category." : "Check back later as admin adds skills."}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {results.map((skill) => {
              const reqStatus = requestStatusForSkill(requests, skill.name);
              const hasActiveRequest = reqStatus !== "" && reqStatus !== "rejected";
              return (
                <div key={skill.skillDocId} className="flex items-center gap-3 rounded-xl border border-hairline p-3.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-(--quick-tint) text-(--quick-text)">
                    <Wrench className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{skill.name}</p>
                    {(skill.category || skill.description) && (
                      <p className="truncate text-xs text-muted">
                        {[skill.category, skill.description].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  {hasActiveRequest ? (
                    <Badge variant="secondary" className={STATUS_BADGE_CLASSES[reqStatus]}>
                      {statusLabel(reqStatus)}
                    </Badge>
                  ) : (
                    <Button size="xs" variant="outline" onClick={() => onApply(skill)}>
                      <Send className="size-3" />
                      Request
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
