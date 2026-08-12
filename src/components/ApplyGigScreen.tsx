import { applyGigExample as ex } from "@/lib/content";

function InfoCell({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-paper px-3 py-2">
      <p className="text-[8px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-xs font-semibold" style={valueColor ? { color: valueColor } : { color: "var(--ink)" }}>
        {value}
      </p>
    </div>
  );
}

export default function ApplyGigScreen() {
  return (
    <div className="px-4 pb-6 pt-2">
      <div className="mb-3 flex justify-center">
        <span className="h-1 w-9 rounded-full bg-hairline" />
      </div>

      <div className="flex items-center gap-2">
        <p className="text-base font-bold text-ink">{ex.title}</p>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{ background: "var(--worker-tint)", color: "var(--worker-text)" }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--worker-start)" }} />
          {ex.status}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted">
        Posted {ex.postedAgo} · {ex.applicantsCount} applicants so far
      </p>

      <div className="mt-3 flex items-center gap-2">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ background: "linear-gradient(135deg, var(--worker-start), var(--worker-end))" }}
        >
          {ex.host[0]}
        </span>
        <div>
          <p className="text-xs font-medium text-ink">{ex.host}</p>
          <p className="text-[10px] text-muted">★ {ex.hostRating} host rating</p>
        </div>
      </div>

      <div className="my-3 h-px bg-hairline" />

      <div className="grid grid-cols-2 gap-2">
        <InfoCell label="Pay" value={`${ex.pay} / day`} valueColor="var(--worker-start)" />
        <InfoCell label="Schedule" value={ex.schedule} />
        <InfoCell label={`Location · ${ex.distance}`} value="San Francisco, California" />
        <InfoCell label="Experience" value={ex.experience} />
      </div>

      <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted">
        Skills needed
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {ex.skills.map((skill) => (
          <span
            key={skill.name}
            className="rounded-full px-2.5 py-1 text-[10px] font-medium"
            style={
              skill.have
                ? { background: "var(--success-tint)", color: "var(--success-text)" }
                : { background: "var(--hairline)", color: "var(--muted)" }
            }
          >
            {skill.name}
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl border border-hairline bg-paper px-3 py-2 text-[11px] text-muted">
        See this gig on the map
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <button
        className="mt-4 w-full rounded-full py-2.5 text-xs font-semibold text-white"
        style={{ background: "linear-gradient(135deg, var(--worker-start), var(--worker-end))" }}
      >
        Take Gig
      </button>
      <p className="mt-1.5 text-center text-[10px] text-muted">
        You can pass anytime before you&apos;re selected
      </p>
    </div>
  );
}
