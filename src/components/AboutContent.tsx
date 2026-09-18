"use client";

import { motion } from "framer-motion";
import type { AboutGiggreContent } from "@/lib/aboutContent";

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// Same four sections as about_giggre.dart's _Card list (Our Mission, What is
// Giggre?, How It Works, Our Values), rendered as real HTML (dangerouslySetInnerHTML)
// since the content is admin-authored and already sanitized upstream — same
// trust level flutter_html's Html(data: ...) renders on mobile.
const SECTIONS: { key: keyof Pick<AboutGiggreContent, "mission" | "whatIsGiggre" | "howItWorks" | "values">; title: string; icon: React.ReactNode }[] = [
  {
    key: "mission",
    title: "Our Mission",
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.5.4.8 1 .8 1.6v.5h5.4v-.5c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "whatIsGiggre",
    title: "What is Giggre?",
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 16v-4M12 8h.01" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "howItWorks",
    title: "How It Works",
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 2.1 21 6l-4 3.9M3 12.5v-1a4 4 0 0 1 4-4h14M7 21.9 3 18l4-3.9M21 11.5v1a4 4 0 0 1-4 4H3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "values",
    title: "Our Values",
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 21s-7-4.35-9.5-8.8A5 5 0 0 1 12 6a5 5 0 0 1 9.5 6.2C19 16.65 12 21 12 21Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function AboutContent({ content }: { content: AboutGiggreContent }) {
  const sectionsWithBody = SECTIONS.filter((s) => content[s.key].trim());

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
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 16v-4M12 8h.01" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          About Giggre
        </span>

        <h1 className="mt-4 font-[var(--font-display)] text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Hyperlocal gigs, built for your neighborhood.
        </h1>

        {content.lastUpdated && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1 text-xs text-muted">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Last updated {formatDate(content.lastUpdated)}
          </p>
        )}
      </motion.div>

      {sectionsWithBody.length === 0 ? (
        <p className="mt-8 text-sm text-muted">
          We&apos;re still putting this page together — check back shortly.
        </p>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {sectionsWithBody.map((section, i) => (
            <motion.section
              key={section.key}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: Math.min(i, 4) * 0.08 }}
              className="rounded-2xl border border-hairline bg-paper p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start gap-4">
                <span
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ background: "var(--worker-tint)", color: "var(--worker-text)" }}
                >
                  {section.icon}
                </span>
                <div className="min-w-0">
                  <h2 className="font-[var(--font-display)] text-lg font-semibold text-ink">{section.title}</h2>
                  <div
                    // Matches the admin tool's own allowlist (sanitizeHtml in
                    // giggre-admin/lib/sanitize.ts): p/div/span/br/b/strong/
                    // i/em/ul/ol/li/a — no headings or blockquote to style.
                    className="mt-2 space-y-2 text-sm leading-relaxed text-muted [&_a]:text-ink [&_a]:underline [&_li]:ml-4 [&_ol]:list-decimal [&_ul]:list-disc"
                    dangerouslySetInnerHTML={{ __html: content[section.key] }}
                  />
                </div>
              </div>
            </motion.section>
          ))}
        </div>
      )}
    </>
  );
}
