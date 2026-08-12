import { gigTrackingExample } from "@/lib/content";

const stepLabels = [
  "Worker's on the Way",
  "Worker Arrived",
  "On the Job",
  "All Done",
  "Awaiting Payout",
  "Wrapped Up",
];

type TrackingData = typeof gigTrackingExample;

export default function GigTrackingScreen({ data = gigTrackingExample }: { data?: TrackingData }) {
  const ex = data;
  return (
    <>
      <div
        className="relative px-5 pb-7 pt-6 text-white"
        style={{
          background: "linear-gradient(135deg, var(--host-start), var(--host-end))",
          borderRadius: "0 0 26px 26px",
        }}
      >
        <div className="flex items-center gap-2 text-white/80">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-xs font-medium">Gig in Progress</span>
        </div>
        <p className="mt-3 text-md font-bold">{ex.gigTitle}</p>
       
      </div>

      <div className="relative -mt-4 space-y-3 px-4 pb-5">
        <div className="overflow-hidden rounded-2xl border border-hairline shadow-sm">
          <div className="relative h-32 overflow-hidden">
            <svg
              viewBox="0 0 300 150"
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full"
              aria-hidden
            >
              <rect width="300" height="150" fill="var(--mist)" />
              <rect x="20" y="18" width="50" height="30" rx="3" fill="var(--hairline)" opacity="0.6" />
              <rect x="220" y="90" width="55" height="40" rx="3" fill="var(--hairline)" opacity="0.6" />
              <rect x="130" y="20" width="45" height="26" rx="3" fill="var(--hairline)" opacity="0.5" />
              <line x1="0" y1="45" x2="300" y2="42" stroke="var(--paper)" strokeWidth="9" />
              <line x1="0" y1="112" x2="300" y2="106" stroke="var(--paper)" strokeWidth="8" />
              <line x1="100" y1="0" x2="94" y2="150" stroke="var(--paper)" strokeWidth="8" />
              <path
                d="M60 100 C 110 60, 160 110, 220 55"
                fill="none"
                stroke="var(--host-start)"
                strokeWidth="3"
                strokeDasharray="6 6"
              />
              <circle cx="60" cy="100" r="6" fill="var(--success-start)" />
              <circle cx="220" cy="55" r="6" fill="var(--host-start)" />
            </svg>
            <span
              className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-semibold text-white"
              style={{ background: "var(--success-start)" }}
            >
              LIVE
            </span>
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-lg bg-paper/90 px-2 py-1 text-[10px] font-medium text-ink shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--success-start)" }} />
              {ex.workerName}
              <span className="text-muted">· {ex.distance}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-hairline bg-paper p-4 shadow-sm">
           <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[8px] font-medium">
          <span className="h-1 w-1 rounded-full bg-white" />
          On the way
        </span>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-ink">{ex.workerName}</span>
            <div className="flex items-center gap-2">
              <button
                className="flex h-6 w-6 items-center justify-center rounded-full"
                style={{ background: "var(--host-tint)", color: "var(--host-text)" }}
              >
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2">
                  <path
                    d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                className="flex h-6 w-6 items-center justify-center rounded-full"
                style={{ background: "var(--host-tint)", color: "var(--host-text)" }}
              >
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2">
                  <path
                    d="M21 11.5a8.4 8.4 0 0 1-1.2 4.4L21 20l-4.3-1.1a8.5 8.5 0 1 1 4.3-7.4Z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex items-center">
            {stepLabels.map((label, i) => (
              <div key={label} className="flex flex-1 items-center last:flex-none">
                <span
                  className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                  style={
                    i <= ex.stepIndex
                      ? { background: "var(--host-start)", color: "#fff" }
                      : { border: "1.5px solid var(--hairline)", color: "var(--muted)" }
                  }
                >
                  {i + 1}
                </span>
                {i < stepLabels.length - 1 && (
                  <span
                    className="mx-1 h-[2px] flex-1"
                    style={{ background: i < ex.stepIndex ? "var(--host-start)" : "var(--hairline)" }}
                  />
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs font-semibold text-ink">{ex.stepTitle}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">{ex.stepBody}</p>
        </div>

        <div>
          <button
            className="w-full rounded-full border py-2 text-xs font-semibold"
            style={{ borderColor: "var(--danger-start)", color: "var(--danger-text)" }}
          >
            Cancel gig
          </button>
          <p className="mt-1.5 text-center text-[10px] text-muted">
            Cancelling now notifies {ex.workerName} · frequent cancellations affect your host
            rating
          </p>
        </div>
      </div>
    </>
  );
}
