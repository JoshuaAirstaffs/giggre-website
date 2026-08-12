import { gigCompleteExample } from "@/lib/content";
import GigTrackingScreen from "./GigTrackingScreen";

export default function GigCompleteDialog() {
  return (
    <div className="relative min-h-full">
      <GigTrackingScreen data={gigCompleteExample} />

      <div className="absolute inset-0 flex items-center justify-center bg-black/50 p-5">
        <div className="w-full rounded-2xl bg-paper p-5 text-center shadow-xl">
          <span
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: "var(--success-tint)", color: "var(--success-text)" }}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <p className="mt-3 text-base font-bold text-ink">Gig Complete!</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Payment confirmed — nice work getting this one done!
          </p>

          <p className="mt-4 text-xs font-medium text-ink">
            Rate {gigCompleteExample.workerName}
          </p>
          <div className="mt-1.5 flex justify-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <svg
                key={i}
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="var(--host-start)"
                stroke="var(--host-start)"
                strokeWidth="1"
              >
                <path d="M12 2.5 15 9l7 1-5 4.9 1.2 7-6.2-3.4L5.8 22 7 15 2 10.1l7-1z" />
              </svg>
            ))}
          </div>

          <button
            className="mt-4 w-full rounded-full py-2 text-xs font-semibold text-white"
            style={{ background: "var(--host-start)" }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
