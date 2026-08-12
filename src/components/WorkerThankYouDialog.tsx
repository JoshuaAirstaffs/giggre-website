import { workerCompleteExample } from "@/lib/content";
import WorkerProgressScreen from "./WorkerProgressScreen";

export default function WorkerThankYouDialog() {
  return (
    <div className="relative min-h-full">
      <WorkerProgressScreen data={workerCompleteExample} />

      <div className="absolute inset-0 flex items-center justify-center bg-black/50 p-5">
        <div className="w-full rounded-2xl bg-paper p-5 text-center shadow-xl">
          <span
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: "var(--success-tint)", color: "var(--success-text)" }}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M12 2.5 15 9l7 1-5 4.9 1.2 7-6.2-3.4L5.8 22 7 15 2 10.1l7-1z" />
            </svg>
          </span>
          <p className="mt-3 text-base font-bold text-ink">Thank You!</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Payment received — great work getting this gig done!
          </p>

          <div className="mt-4 border-t border-hairline pt-4">
            <p className="text-xs font-semibold text-ink">Rate Your Host</p>
            <p className="mt-0.5 text-[11px] text-muted">
              How was {workerCompleteExample.hostName}?
            </p>
            <div className="mt-2 flex justify-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg
                  key={i}
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="var(--hairline)"
                  strokeWidth="1.5"
                >
                  <path d="M12 2.5 15 9l7 1-5 4.9 1.2 7-6.2-3.4L5.8 22 7 15 2 10.1l7-1z" />
                </svg>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-muted">Tap a star to rate</p>
          </div>

          <div className="mt-4 flex gap-2">
            <button className="flex-1 rounded-full border border-hairline py-2 text-xs font-semibold text-muted">
              Skip
            </button>
            <button
              className="flex-1 rounded-full py-2 text-xs font-semibold text-white opacity-40"
              style={{ background: "var(--worker-start)" }}
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
