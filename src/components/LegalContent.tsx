"use client";

import { motion } from "framer-motion";
import type { ContentItem } from "@/lib/appContent";

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function LegalContent({
  badgeLabel,
  badgeIcon,
  heading,
  items,
  lastUpdated,
  contactBlurb,
}: {
  badgeLabel: string;
  badgeIcon: React.ReactNode;
  heading: string;
  items: ContentItem[];
  lastUpdated: Date | null;
  contactBlurb: string;
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-[var(--font-mono)] text-xs"
          style={{ background: "var(--worker-tint)", color: "var(--worker-text)" }}
        >
          {badgeIcon}
          {badgeLabel}
        </span>

        <h1 className="mt-4 font-[var(--font-display)] text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {heading}
        </h1>

        {lastUpdated && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1 text-xs text-muted">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Last updated {formatDate(lastUpdated)}
          </p>
        )}
      </motion.div>

      {items.length === 0 ? (
        <p className="mt-8 text-sm text-muted">
          We&apos;re still putting this page together — check back shortly.
        </p>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {items.map((item, i) => (
            <motion.section
              key={item.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: Math.min(i, 4) * 0.08 }}
              className="rounded-2xl border border-hairline bg-paper p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start gap-4">
                <span
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-[var(--font-mono)] text-xs font-semibold text-white"
                  style={{ background: "linear-gradient(135deg, var(--worker-start), var(--worker-end))" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h2 className="font-[var(--font-display)] text-lg font-semibold text-ink">
                    {item.title}
                  </h2>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">
                    {item.body}
                  </p>
                </div>
              </div>
            </motion.section>
          ))}
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mt-8 flex items-center gap-3 rounded-2xl border border-hairline bg-paper p-5"
      >
        <span
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
          style={{ background: "var(--worker-tint)", color: "var(--worker-text)" }}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16v12H4V6Z" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 7l8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <p className="text-sm text-muted">
          {contactBlurb}{" "}
          <a href="mailto:support@airstaffs.com" className="font-medium text-ink underline">
            support@airstaffs.com
          </a>
          .
        </p>
      </motion.div>
    </>
  );
}
