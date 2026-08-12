import { workerProgressExample } from "@/lib/content";

const stepLabels = ["On My Way", "I'm Here", "On the Job", "All Done", "Getting Paid", "Wrapped Up"];

type ProgressData = typeof workerProgressExample;

export default function WorkerProgressScreen({
  data = workerProgressExample,
}: {
  data?: ProgressData;
}) {
  const ex = data;
  return (
    <>
      <div
        className="relative px-5 pb-7 pt-6 text-white"
        style={{
          background: "linear-gradient(135deg, var(--worker-start), var(--worker-end))",
          borderRadius: "0 0 26px 26px",
        }}
      >
        <div className="flex items-center gap-2 text-white/80">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-xs font-medium">Active Gig</span>
        </div>
        <p className="mt-3 text-lg font-bold">{ex.gigTitle}</p>
        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          {stepLabels[ex.stepIndex]}
        </span>
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
              <rect x="24" y="90" width="52" height="38" rx="3" fill="var(--hairline)" opacity="0.6" />
              <rect x="210" y="16" width="50" height="30" rx="3" fill="var(--hairline)" opacity="0.6" />
              <rect x="120" y="95" width="42" height="24" rx="3" fill="var(--hairline)" opacity="0.5" />
              <line x1="0" y1="48" x2="300" y2="44" stroke="var(--paper)" strokeWidth="9" />
              <line x1="0" y1="112" x2="300" y2="108" stroke="var(--paper)" strokeWidth="8" />
              <line x1="110" y1="0" x2="104" y2="150" stroke="var(--paper)" strokeWidth="8" />
              <path
                d="M55 60 C 100 100, 150 40, 230 75"
                fill="none"
                stroke="var(--worker-start)"
                strokeWidth="3"
                strokeDasharray="6 6"
              />
              <circle cx="55" cy="60" r="6" fill="var(--worker-start)" />
              <circle cx="230" cy="75" r="6" fill="var(--danger-start)" />
            </svg>
            <span
              className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-semibold text-white"
              style={{ background: "var(--success-start)" }}
            >
              LIVE
            </span>
            <div className="absolute bottom-2 left-2 flex items-center gap-2 rounded-lg bg-paper/90 px-2 py-1 text-[10px] font-medium text-ink shadow-sm">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--worker-start)" }} />
                You
              </span>
              <span className="flex items-center gap-1 text-muted">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--danger-start)" }} />
                Gig · {ex.distance}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-hairline bg-paper p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-ink">{ex.hostName}</span>
            <div className="flex items-center gap-2">
              <span
                className="rounded-full px-2 py-0.5 font-[var(--font-mono)] text-[10px] font-semibold"
                style={{ background: "var(--success-tint)", color: "var(--success-text)" }}
              >
                {ex.elapsed}
              </span>
            </div>
          </div>
          <div className="flex items-center">
            {stepLabels.map((label, i) => (
              <div key={label} className="flex flex-1 items-center last:flex-none">
                <span
                  className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                  style={
                    i <= ex.stepIndex
                      ? { background: "var(--worker-start)", color: "#fff" }
                      : { border: "1.5px solid var(--hairline)", color: "var(--muted)" }
                  }
                >
                  {i + 1}
                </span>
                {i < stepLabels.length - 1 && (
                  <span
                    className="mx-1 h-[2px] flex-1"
                    style={{ background: i < ex.stepIndex ? "var(--worker-start)" : "var(--hairline)" }}
                  />
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs font-semibold text-ink">{ex.stepTitle}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">{ex.stepBody}</p>
        </div>

        <button
          className="w-full rounded-full py-2.5 text-xs font-semibold text-white"
          style={{ background: "var(--success-start)" }}
        >
          Gig Complete
        </button>

        <div>
          <button
            className="w-full rounded-full border py-2 text-xs font-semibold"
            style={{ borderColor: "var(--danger-start)", color: "var(--danger-text)" }}
          >
            Cancel Application
          </button>
          <p className="mt-1.5 text-center text-[10px] text-muted">
            Cancelling after being selected may affect your worker rating
          </p>
        </div>
      </div>
    </>
  );
}
