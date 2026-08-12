import { openGigPostExample as ex } from "@/lib/content";

function FieldLabel({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-1.5">
      <p className="text-xs font-semibold text-ink">{children}</p>
      {sub ? <p className="text-[10px] text-muted">{sub}</p> : null}
    </div>
  );
}

export default function PostOpenGigScreen() {
  return (
    <div className="px-4 pb-6 pt-4">
      <div className="mb-4 flex items-center gap-2">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
          <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full"
          style={{ background: "var(--worker-tint)", color: "var(--worker-text)" }}
        >
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2 4 6v6c0 4.5 3.4 7.7 8 9 4.6-1.3 8-4.5 8-9V6l-8-4Z" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="text-sm font-bold text-ink">Post Open Gig</span>
      </div>

      <div className="space-y-3">
        <div>
          <FieldLabel>Title</FieldLabel>
          <div
            className="rounded-xl border-[1.5px] bg-paper px-3 py-2 text-xs text-ink"
            style={{ borderColor: "var(--worker-start)" }}
          >
            {ex.title}
          </div>
        </div>

        <div>
          <FieldLabel>Description</FieldLabel>
          <div className="rounded-xl border border-hairline bg-paper px-3 py-2 text-[11px] leading-relaxed text-muted">
            {ex.description}
          </div>
        </div>

        <div>
          <FieldLabel sub="Select the skill required for this gig">Required Skills</FieldLabel>
          <span
            className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{ background: "var(--worker-tint)", color: "var(--worker-text)" }}
          >
            {ex.skill}
          </span>
        </div>

        <div>
          <FieldLabel>Experience Level</FieldLabel>
          <div className="flex items-center justify-between rounded-xl border border-hairline bg-paper px-3 py-2">
            <div>
              <p className="text-xs font-medium text-ink">{ex.experience}</p>
              <p className="text-[10px] text-muted">{ex.experienceSub}</p>
            </div>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Amount</FieldLabel>
            <p
              className="font-[var(--font-display)] text-lg font-bold"
              style={{ color: "var(--worker-start)" }}
            >
              {ex.amount}
            </p>
          </div>
          <div>
            <FieldLabel sub="Paid per worker">Workers Needed</FieldLabel>
            <div className="flex items-center gap-2">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-xs"
                style={{ background: "var(--worker-tint)", color: "var(--worker-text)" }}
              >
                −
              </span>
              <span className="text-xs font-medium text-ink">{ex.workers} worker</span>
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-xs"
                style={{ background: "var(--worker-tint)", color: "var(--worker-text)" }}
              >
                +
              </span>
            </div>
          </div>
        </div>

        <div>
          <FieldLabel>Schedule</FieldLabel>
          <div className="flex gap-2">
            <span
              className="flex-1 rounded-xl border-[1.5px] px-3 py-2 text-center text-[11px] font-medium"
              style={{ borderColor: "var(--worker-start)", color: "var(--worker-text)" }}
            >
              {ex.date}
            </span>
            <span
              className="flex-1 rounded-xl border-[1.5px] px-3 py-2 text-center text-[11px] font-medium"
              style={{ borderColor: "var(--worker-start)", color: "var(--worker-text)" }}
            >
              {ex.time}
            </span>
          </div>
        </div>

        <div>
          <FieldLabel>Location</FieldLabel>
          <div className="rounded-xl border border-hairline bg-paper px-3 py-2">
            <p className="text-[11px] font-medium text-ink">{ex.location}</p>
            <p className="text-[10px] text-muted">{ex.locationSub}</p>
          </div>
        </div>

        <button
          className="mt-2 w-full rounded-full py-2.5 text-xs font-semibold text-white"
          style={{ background: "var(--worker-start)" }}
        >
          Post Open Gig
        </button>
        <button className="w-full rounded-full border border-hairline py-2 text-xs font-semibold text-muted">
          Save as Template
        </button>
      </div>
    </div>
  );
}
