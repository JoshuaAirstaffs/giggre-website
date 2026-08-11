"use client";

import { motion } from "framer-motion";

export default function DownloadCTA() {
  return (
    <section id="download" className="px-6 py-20">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl px-8 py-16 text-center sm:px-16"
        style={{
          background:
            "linear-gradient(135deg, var(--worker-start) 0%, var(--worker-start) 48%, var(--host-start) 52%, var(--host-start) 100%)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.25), transparent 40%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.18), transparent 45%)",
          }}
        />
        <h2 className="relative font-[var(--font-display)] text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Gigs are already moving near you.
        </h2>
        <p className="relative mx-auto mt-4 max-w-md text-white/85">
          Download Giggre and see what&apos;s nearby right now.
        </p>
        <div className="relative mt-8 flex flex-wrap items-center justify-center gap-4">
          <a
            href="#"
            className="flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-[#10151F] shadow-sm transition-transform hover:scale-[1.03]"
          >
            Get it on Google Play
          </a>
          <span className="rounded-full border border-white/40 px-6 py-3 text-sm font-medium text-white/70">
            App Store — coming soon
          </span>
        </div>
      </motion.div>
    </section>
  );
}
