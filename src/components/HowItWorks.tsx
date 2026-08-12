"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Mode, gigTypes } from "@/lib/content";

const typeIcons = {
  quick: (
    <path d="M11 2 3 13h6l-1 9 9-13h-6l0-7Z" strokeLinecap="round" strokeLinejoin="round" />
  ),
  open: (
    <>
      <circle cx="12" cy="12" r="9" strokeLinecap="round" />
      <path d="M12 7v5l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  offered: (
    <path d="M4 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  ),
} as const;

function GigFlowCard({
  gigType,
  mode,
  index,
}: {
  gigType: (typeof gigTypes)[number];
  mode: Mode;
  index: number;
}) {
  const steps = gigType.steps[mode];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className="rounded-2xl border p-6 sm:p-7"
      style={{ borderColor: gigType.accentStart, background: gigType.accentTint }}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ background: gigType.accentStart, color: "#fff" }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            {typeIcons[gigType.key]}
          </svg>
        </span>
        <div>
          <p className="font-medium text-ink">{gigType.title}</p>
          <p className="font-[var(--font-mono)] text-[11px] uppercase tracking-wide" style={{ color: gigType.accentText }}>
            {gigType.tag}
          </p>
        </div>
      </div>

      <ol className="mt-5 space-y-4">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full font-[var(--font-mono)] text-[11px] font-medium text-white"
              style={{ background: gigType.accentStart }}
            >
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-medium text-ink">{step.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </motion.div>
  );
}

export default function HowItWorks({ mode }: { mode: Mode }) {
  return (
    <section id="how-it-works" className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-10 max-w-xl"
        >
          <h2 className="font-[var(--font-display)] text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            How it works for{" "}
            <span style={{ color: mode === "worker" ? "var(--worker-start)" : "var(--host-start)" }}>
              {mode === "worker" ? "workers" : "hosts"}
            </span>
          </h2>
          <p className="mt-3 text-muted">
            The path from open app to money changing hands is short — here&apos;s how each of the
            three gig types plays out.
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="grid gap-6 md:grid-cols-3"
          >
            {gigTypes.map((gigType, i) => (
              <GigFlowCard key={gigType.key} gigType={gigType} mode={mode} index={i} />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
