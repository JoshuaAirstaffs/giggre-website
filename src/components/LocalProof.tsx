"use client";

import { motion } from "framer-motion";

const points = [
  {
    title: "Verified locals",
    body: "Every worker signs up with a valid ID and an area-linked profile, so you know who's coming.",
    accentTint: "var(--worker-tint)",
    accentText: "var(--worker-text)",
    accentStart: "var(--worker-start)",
    accentEnd: "var(--worker-end)",
    icon: (
      <>
        <path d="M12 3 4 6v6c0 4.5 3.4 7.7 8 9 4.6-1.3 8-4.5 8-9V6l-8-3Z" strokeLinejoin="round" />
        <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  {
    title: "Minutes, not days",
    body: "Gigs are matched by distance first. Most posts get an offer within minutes, not a job-board scroll.",
    accentTint: "var(--quick-tint)",
    accentText: "var(--quick-text)",
    accentStart: "var(--quick-start)",
    accentEnd: "var(--quick-end)",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  {
    title: "Fair local pricing",
    body: "Prices are set by people who actually live there, so rates track what a gig is worth in your area.",
    accentTint: "var(--offered-tint)",
    accentText: "var(--offered-text)",
    accentStart: "var(--offered-start)",
    accentEnd: "var(--offered-end)",
    icon: (
      <path
        d="M20.6 12.6 12.9 20.3a1.5 1.5 0 0 1-2.1 0L3.7 13.2a1.5 1.5 0 0 1-.4-1V4.7A1.7 1.7 0 0 1 5 3h7.5c.4 0 .8.2 1 .4l7.1 7.1a1.5 1.5 0 0 1 0 2.1Z M7.5 8a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
];

export default function LocalProof() {
  return (
    <section id="local" className="px-6 py-20">
      <div className="mx-auto max-w-6xl rounded-3xl border border-hairline bg-paper p-8 sm:p-12">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="font-[var(--font-mono)] text-xs uppercase tracking-wide text-muted">
              Why hyperlocal
            </p>
            <h2 className="mt-3 font-[var(--font-display)] text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Built for your block, in every town across the country.
            </h2>
            <p className="mt-4 text-muted">
              Giggre works hyperlocal because trust only works at a scale where people already
              recognize each other. Wherever you are, we match gigs area by
              area, not city-wide.
            </p>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-1">
            {points.map((p, i) => (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                whileHover={{ y: -3 }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className="group relative overflow-hidden rounded-xl border border-hairline p-5 transition-shadow hover:shadow-md"
              >
                <span
                  className="absolute inset-y-0 left-0 w-1 origin-top scale-y-0 transition-transform duration-300 group-hover:scale-y-100"
                  style={{
                    background: `linear-gradient(180deg, ${p.accentStart}, ${p.accentEnd})`,
                  }}
                />
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{ background: p.accentTint, color: p.accentText }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      {p.icon}
                    </svg>
                  </span>
                  <div>
                    <p className="font-medium text-ink">{p.title}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{p.body}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
