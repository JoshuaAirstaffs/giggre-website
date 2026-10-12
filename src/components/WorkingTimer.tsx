"use client";

import { useEffect, useState } from "react";
import { formatElapsed } from "@/lib/gig-format";

// Mirrors the green monospace pill shown next to the "Working" step title in
// ActiveGigProgressCard (active_gig_widgets.dart) — ticks locally every
// second, computed as now - workStartedAt (no durationSeconds involved;
// that's only written once, at task_complete). Used on both the worker's own
// applications page and the host's gig detail page.
export default function WorkingTimer({ startedAt }: { startedAt: Date }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="shrink-0 rounded-md bg-(--success-text)/10 px-2 py-1 font-mono text-xs font-bold text-(--success-text)">
      {formatElapsed(now - startedAt.getTime())}
    </span>
  );
}
