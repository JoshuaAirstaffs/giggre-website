"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Mode, gigTypes, modeCopy } from "@/lib/content";
import PhoneFrame from "./PhoneFrame";

const statusColors: Record<string, { dot: string; tint: string; text: string }> = {
  gold: { dot: "var(--host-start)", tint: "var(--host-tint)", text: "var(--host-text)" },
  green: {
    dot: "var(--success-start)",
    tint: "var(--success-tint)",
    text: "var(--success-text)",
  },
  gray: { dot: "var(--muted)", tint: "var(--hairline)", text: "var(--muted)" },
};

function Avatar({ name, accentStart, accentEnd }: { name: string; accentStart: string; accentEnd: string }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("");
  return (
    <div
      className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-white ring-2 ring-white/40"
      style={{ background: `linear-gradient(135deg, ${accentStart}, ${accentEnd})` }}
    >
      {initials}
    </div>
  );
}

function WorkerScreen({ mode }: { mode: "worker" }) {
  const data = modeCopy[mode];
  const { dashboard } = data;

  return (
    <>
      <div
        className="relative px-5 pb-10 pt-6 text-white"
        style={{
          background: `linear-gradient(135deg, ${data.accentStart}, ${data.accentEnd})`,
          borderRadius: "0 0 26px 26px",
        }}
      >
        <div className="flex items-center justify-between text-white/80">
          <span className="text-xs font-medium">{dashboard.headerTitle}</span>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8a6 6 0 1 0-12 0c0 4-2 5-2 5h16s-2-1-2-5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4v6h6M20 20v-6h-6" strokeLinecap="round" strokeLinejoin="round" />
                <path
                  d="M4.6 15a8 8 0 0 0 14 3.4M19.4 9A8 8 0 0 0 5.4 5.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Avatar name={dashboard.name} accentStart="#ffffff33" accentEnd="#ffffff11" />
          <p className="text-lg font-bold">{dashboard.name}</p>
        </div>
      </div>

      <div className="relative -mt-6 space-y-3 px-4">
        <div className="rounded-2xl border border-hairline bg-paper p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: "var(--success-start)" }}
              />
              <span className="text-xs font-medium text-ink">{dashboard.status}</span>
            </div>
            <span
              className="h-5 w-9 rounded-full p-0.5"
              style={{ background: "var(--success-start)" }}
            >
              <span className="ml-auto block h-4 w-4 rounded-full bg-white" />
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-hairline bg-paper p-4 shadow-sm">
          <p className="text-xs text-muted">{dashboard.earningsLabel}</p>
          <p className="mt-1 font-[var(--font-display)] text-2xl font-bold text-ink">
            {dashboard.earnings}
          </p>
          <p className="mt-0.5 text-xs text-muted">{dashboard.earningsSub}</p>
        </div>

        <div className="space-y-2">
          {dashboard.gigs.map((gig) => {
            const type = gigTypes.find((g) => g.key === gig.type)!;
            return (
              <div
                key={gig.title}
                className="rounded-xl border border-hairline bg-paper p-3 shadow-sm"
              >
                <div className=" flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-xs font-medium text-ink">{gig.title}</p>
                  <span
                    className="inline-flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[8px] font-medium"
                    style={{ background: type.accentTint, color: type.accentText }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: type.accentStart }}
                    />
                    {type.title}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <p className="text-xs text-muted">{gig.host}</p>
                  <p
                    className="font-[var(--font-display)] text-sm font-bold"
                    style={{ color: "var(--worker-start)" }}
                  >
                    {gig.pay}
                  </p>
                </div>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-muted">
                  <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2">
                    <path
                      d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="12" cy="9.5" r="2" />
                  </svg>
                  {gig.meta}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function HostScreen({ mode }: { mode: "host" }) {
  const data = modeCopy[mode];
  const { dashboard } = data;

  return (
    <>
      <div
        className="relative px-5 pb-10 pt-6 text-white"
        style={{
          background: `linear-gradient(135deg, ${data.accentStart}, ${data.accentEnd})`,
          borderRadius: "0 0 26px 26px",
        }}
      >
        <div className="flex items-center justify-between text-white/80">
          <span className="text-xs font-medium">{dashboard.headerTitle}</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8a6 6 0 1 0-12 0c0 4-2 5-2 5h16s-2-1-2-5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Avatar name={dashboard.name} accentStart="#ffffff33" accentEnd="#ffffff11" />
          <div>
            <p className="text-lg font-bold">{dashboard.name}</p>
            <p className="text-xs text-white/75">{dashboard.headerSubtitle}</p>
          </div>
        </div>
      </div>

      <div className="relative -mt-6 space-y-3 px-4">
        <div className="flex items-center justify-between rounded-2xl border border-hairline bg-paper p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: "var(--success-start)" }}
            />
            <span className="text-xs font-medium text-ink">{dashboard.status}</span>
          </div>
          <span
            className="rounded-full border px-2.5 py-1 text-[11px] font-medium"
            style={{ borderColor: data.accentStart, color: data.accentText }}
          >
            View
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-hairline shadow-sm">
          <p className="bg-paper px-3 pt-2.5 text-[11px] font-medium text-muted">
            Workers near you
          </p>
          <div className="relative h-28 overflow-hidden">
            <svg
              viewBox="0 0 300 140"
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full"
              aria-hidden
            >
              <rect width="300" height="140" fill="var(--mist)" />
              <rect x="38" y="8" width="46" height="22" rx="4" fill="var(--success-tint)" />
              <rect x="150" y="82" width="58" height="32" rx="3" fill="var(--hairline)" opacity="0.7" />
              <rect x="232" y="14" width="42" height="36" rx="3" fill="var(--hairline)" opacity="0.7" />
              <rect x="14" y="72" width="52" height="46" rx="3" fill="var(--hairline)" opacity="0.5" />
              <rect x="150" y="10" width="40" height="24" rx="3" fill="var(--hairline)" opacity="0.5" />
              <line x1="0" y1="40" x2="300" y2="38" stroke="var(--paper)" strokeWidth="10" />
              <line x1="0" y1="104" x2="300" y2="98" stroke="var(--paper)" strokeWidth="9" />
              <line x1="96" y1="0" x2="90" y2="140" stroke="var(--paper)" strokeWidth="9" />
              <line x1="216" y1="0" x2="222" y2="140" stroke="var(--paper)" strokeWidth="8" />
            </svg>
            {dashboard.nearbyWorkers.map((worker) => (
              <span
                key={worker.name}
                className="absolute flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-semibold text-white ring-2 ring-paper"
                style={{ left: worker.left, top: worker.top, background: "var(--worker-start)" }}
              >
                <span
                  className="absolute inset-0 animate-ping rounded-full"
                  style={{ background: "var(--worker-start)", opacity: 0.5 }}
                />
                <span className="relative">
                  {worker.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")}
                </span>
              </span>
            ))}
          </div>
        </div>

        <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted">Your gigs</p>

        <div className="space-y-2">
          {dashboard.gigs.map((gig) => {
            const status = statusColors[gig.statusColor];
            return (
              <div
                key={gig.title}
                className="rounded-xl border border-hairline bg-paper p-3 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-ink">{gig.title}</p>
                  <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: status.text }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.dot }} />
                    {gig.statusLabel}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted">{gig.meta}</p>
                {/* <div className="mt-1.5 flex items-center justify-between">
                  <p className="text-[11px] text-muted">{gig.sub}</p>
                  {"applicants" in gig ? (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{ background: "var(--host-tint)", color: "var(--host-text)" }}
                    >
                      {gig.applicants} interested
                    </span>
                  ) : null}
                </div> */}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

export default function DashboardMockup({ mode }: { mode: Mode }) {
  return (
    <PhoneFrame>
      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.35 }}
          className="pb-5"
        >
          {mode === "worker" ? <WorkerScreen mode="worker" /> : <HostScreen mode="host" />}
        </motion.div>
      </AnimatePresence>
    </PhoneFrame>
  );
}
