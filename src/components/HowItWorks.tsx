"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mode, GigType, modeCopy, gigTypes } from "@/lib/content";

const tabIcons = {
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

type Step = { title: string; body: string };

function StepColumn({
  mode,
  active,
  steps,
}: {
  mode: Mode;
  active: boolean;
  steps: readonly Step[];
}) {
  const data = modeCopy[mode];
  return (
    <div
      className="rounded-2xl border p-6 transition-colors sm:p-8"
      style={{
        borderColor: active ? data.accentStart : "var(--hairline)",
        background: active ? data.accentTint : "var(--paper)",
      }}
    >
      <p
        className="font-[var(--font-mono)] text-xs uppercase tracking-wide"
        style={{ color: active ? data.accentText : "var(--muted)" }}
      >
        For {mode === "worker" ? "workers" : "hosts"}
      </p>
      <ol className="mt-5 space-y-6">
        {steps.map((step, i) => (
          <motion.li
            key={step.title}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08, duration: 0.35 }}
            className="flex gap-4"
          >
            <span
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full font-[var(--font-mono)] text-xs font-medium"
              style={{
                background: active ? data.accentStart : "var(--mist)",
                color: active ? "#fff" : "var(--muted)",
              }}
            >
              {i + 1}
            </span>
            <div>
              <p className="font-medium text-ink">{step.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
            </div>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

export default function HowItWorks({ mode }: { mode: Mode }) {
  const [gigType, setGigType] = useState<GigType>("quick");
  const active = gigTypes.find((g) => g.key === gigType)!;

  return (
    <section id="how-it-works" className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8 max-w-xl"
        >
          <h2 className="font-[var(--font-display)] text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            One app, two sides of the same block
          </h2>
          <p className="mt-3 text-muted">
            Whichever side you&apos;re on today, the path from open app to money changing hands
            is short — pick a gig type to see how it plays out.
          </p>
        </motion.div>

        <div
          role="tablist"
          aria-label="Choose a gig type"
          className="mb-10 inline-flex flex-wrap gap-2 rounded-full border border-hairline bg-paper p-1.5"
        >
          {gigTypes.map((g) => {
            const isActive = g.key === gigType;
            return (
              <button
                key={g.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setGigType(g.key)}
                className="relative z-10 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors"
                style={{ color: isActive ? "#fff" : "var(--muted)" }}
              >
                {isActive && (
                  <motion.span
                    layoutId="gig-type-pill"
                    className="absolute inset-0 -z-10 rounded-full"
                    style={{
                      background: `linear-gradient(135deg, ${modeCopy[mode].accentStart}, ${modeCopy[mode].accentEnd})`,
                    }}
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="relative"
                >
                  {tabIcons[g.key]}
                </svg>
                <span className="relative">{g.title}</span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={gigType}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="grid gap-6 md:grid-cols-2"
          >
            <StepColumn mode="worker" active={mode === "worker"} steps={active.steps.worker} />
            <StepColumn mode="host" active={mode === "host"} steps={active.steps.host} />
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
