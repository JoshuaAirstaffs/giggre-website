"use client";

import { CalendarDays, Paperclip, Plus, Send, ShieldQuestion, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import { STATUS_BADGE_CLASSES, statusLabel, type SkillRequest } from "@/lib/toolchest";

interface RequestsTabProps {
  requests: SkillRequest[];
  loading: boolean;
  onNewRequest: () => void;
}

function MetaTag({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted">
      <Icon className="size-3" />
      {children}
    </span>
  );
}

export default function RequestsTab({ requests, loading, onNewRequest }: RequestsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">My Skill Requests</p>
        <Button size="sm" onClick={onNewRequest} className="bg-worker text-white hover:bg-(--worker-end)">
          <Plus className="size-3.5" />
          New Skill Request
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-hairline bg-secondary/40 py-16 text-center">
          <Send className="size-9 text-muted" />
          <p className="text-sm font-semibold text-ink">No requests yet.</p>
          <p className="text-xs text-muted">Tap “New Skill Request” to submit one.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {requests.map((req) => (
            <div key={req.id} className="rounded-xl border border-hairline p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{req.skillName}</p>
                <Badge variant="secondary" className={STATUS_BADGE_CLASSES[req.status]}>
                  {statusLabel(req.status)}
                </Badge>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                {req.skillCategory && <MetaTag icon={ShieldQuestion}>{req.skillCategory}</MetaTag>}
                {req.experienceLevel && <MetaTag icon={TrendingUp}>{req.experienceLevel}</MetaTag>}
                {req.proofCount > 0 && (
                  <MetaTag icon={Paperclip}>
                    {req.proofCount} file{req.proofCount === 1 ? "" : "s"}
                  </MetaTag>
                )}
                {req.createdAt && <MetaTag icon={CalendarDays}>{formatDate(req.createdAt)}</MetaTag>}
              </div>
              {req.adminRemarks && (
                <div className="mt-2.5 rounded-lg bg-secondary/60 p-2.5 text-xs leading-relaxed text-muted">
                  {req.adminRemarks}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
