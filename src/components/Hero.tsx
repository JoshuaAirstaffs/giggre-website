"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Mode, modeCopy } from "@/lib/content";
import ModeToggle from "./ModeToggle";
import RadarSignature from "./RadarSignature";

export default function Hero({
  mode,
  setMode,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
}) {
  const data = modeCopy[mode];

  return (
    <section id="top" className="relative overflow-hidden px-6 pt-14 pb-20 sm:pt-20">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full blur-3xl"
        animate={{
          background: `radial-gradient(circle, ${data.accentStart}22, transparent 70%)`,
        }}
        transition={{ duration: 0.6 }}
      />

      <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-2">
        <div>
          <ModeToggle mode={mode} onChange={setMode} className="mb-8" />

          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35 }}
            >
              <h1 className="font-[var(--font-display)] text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl">
                {data.headline}
              </h1>
              <p className="mt-5 max-w-md text-base leading-relaxed text-muted">
                {data.sub}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <motion.a
              href="#download"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="rounded-full px-6 py-3 text-sm font-medium text-white shadow-sm"
              style={{
                background: `linear-gradient(135deg, ${data.accentStart}, ${data.accentEnd})`,
              }}
            >
              {data.cta}
            </motion.a>
            <a
              href="#how-it-works"
              className="rounded-full border border-hairline px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-paper"
            >
              See how it works
            </a>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          <RadarSignature mode={mode} />
        </motion.div>
      </div>
    </section>
  );
}
