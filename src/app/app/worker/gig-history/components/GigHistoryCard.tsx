import { CheckCircle2, Clock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GIG_TYPE_BADGE_CLASSES, type CompletedEntry } from "@/lib/earnings";
import { currencySymbol } from "@/lib/utils";

function formatDateTime(date: Date) {
  const datePart = date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${datePart}  ${timePart}`;
}

export default function GigHistoryCard({ entry }: { entry: CompletedEntry }) {
  const iconClasses = entry.gigTypeKey ? GIG_TYPE_BADGE_CLASSES[entry.gigTypeKey] : "bg-secondary text-foreground";
  const isMultiWorker = entry.workerSlots > 1;

  return (
    <div className="flex gap-3 rounded-2xl border border-hairline p-4">
      <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${iconClasses}`}>
        <CheckCircle2 className="size-5" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold text-ink">{entry.title}</p>
          <p className="shrink-0 text-sm font-bold text-(--success-text)">
            {currencySymbol(entry.currencyCode)}
            {entry.amount.toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className={iconClasses}>
            {entry.gigType}
          </Badge>
          {isMultiWorker && (
            <Badge variant="secondary" className="bg-(--success-tint) text-(--success-text)">
              1 of {entry.workerSlots} workers
            </Badge>
          )}
          {entry.hostName && <p className="truncate text-xs text-muted">by {entry.hostName}</p>}
        </div>
        {entry.address && (
          <div className="flex items-center gap-1 text-xs text-muted">
            <MapPin className="size-3 shrink-0" />
            <p className="truncate">{entry.address}</p>
          </div>
        )}
        <div className="flex items-center gap-1 text-xs text-muted">
          <Clock className="size-3 shrink-0" />
          <p>{formatDateTime(entry.completedAt)}</p>
        </div>
      </div>
    </div>
  );
}
