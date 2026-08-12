"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mode } from "@/lib/content";
import DashboardMockup from "./DashboardMockup";
import PhoneFrame from "./PhoneFrame";
import ApplyGigScreen from "./ApplyGigScreen";
import WorkerProgressScreen from "./WorkerProgressScreen";
import WorkerThankYouDialog from "./WorkerThankYouDialog";
import PostOpenGigScreen from "./PostOpenGigScreen";
import GigTrackingScreen from "./GigTrackingScreen";
import GigCompleteDialog from "./GigCompleteDialog";

type Slide = { label: string; node: React.ReactNode };

const workerSlides: Slide[] = [
  { label: "Your dashboard", node: <DashboardMockup mode="worker" /> },
  {
    label: "Applying to a Gig",
    node: (
      <PhoneFrame>
        <ApplyGigScreen />
      </PhoneFrame>
    ),
  },
  {
    label: "Tracking Your Progress",
    node: (
      <PhoneFrame>
        <WorkerProgressScreen />
      </PhoneFrame>
    ),
  },
  {
    label: "Gig Completed",
    node: (
      <PhoneFrame>
        <WorkerThankYouDialog />
      </PhoneFrame>
    ),
  },
];

const hostSlides: Slide[] = [
  { label: "Your dashboard", node: <DashboardMockup mode="host" /> },
  {
    label: "Posting a Gig",
    node: (
      <PhoneFrame>
        <PostOpenGigScreen />
      </PhoneFrame>
    ),
  },
  {
    label: "Tracking a Worker",
    node: (
      <PhoneFrame>
        <GigTrackingScreen />
      </PhoneFrame>
    ),
  },
  {
    label: "Gig Complete",
    node: (
      <PhoneFrame>
        <GigCompleteDialog />
      </PhoneFrame>
    ),
  },
];

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d={direction === "left" ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PhoneSlideCarousel({ slides, accentColor }: { slides: Slide[]; accentColor: string }) {
  const [index, setIndex] = useState(0);
  const goTo = (next: number) => setIndex((next + slides.length) % slides.length);

  return (
    <div className="sm:hidden">
      <p className="mb-3 text-center font-[var(--font-mono)] text-xs uppercase tracking-wide text-muted">
        {slides[index].label}
      </p>

      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {slides[index].node}
        </motion.div>
      </AnimatePresence>

      <div className="mt-5 flex items-center justify-center gap-5">
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          aria-label="Previous screen"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-muted transition-colors hover:text-ink"
        >
          <ArrowIcon direction="left" />
        </button>

        <div className="flex items-center gap-1.5">
          {slides.map((slide, i) => (
            <button
              key={slide.label}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to ${slide.label}`}
              className="h-1.5 w-1.5 rounded-full transition-colors"
              style={{ background: i === index ? accentColor : "var(--hairline)" }}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => goTo(index + 1)}
          aria-label="Next screen"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-muted transition-colors hover:text-ink"
        >
          <ArrowIcon direction="right" />
        </button>
      </div>
    </div>
  );
}

export default function AppPreview({ mode }: { mode: Mode }) {
  const slides = mode === "worker" ? workerSlides : hostSlides;
  const accentColor = mode === "worker" ? "var(--worker-start)" : "var(--host-start)";
  const gridCols = "sm:grid-cols-2 lg:grid-cols-4";

  return (
    <section id="app-preview" className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto mb-12 max-w-xl text-center"
        >
          <p className="font-[var(--font-mono)] text-xs uppercase tracking-wide text-muted">
            Straight from the app
          </p>
          <h2 className="mt-3 font-[var(--font-display)] text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Here&apos;s a preview of {mode === "worker" ? "earning" : "hosting"} on Giggre.
          </h2>
          <p className="mt-3 text-muted">
            A look at the {mode === "worker" ? "worker" : "host"} screens, gig cards and all —
            built to match the real app.
          </p>
        </motion.div>

        <PhoneSlideCarousel slides={slides} accentColor={accentColor} />

        <div className={`hidden gap-10 sm:grid ${gridCols}`}>
          {slides.map((slide, i) => (
            <motion.div
              key={slide.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <p className="mb-3 text-center font-[var(--font-mono)] text-xs uppercase tracking-wide text-muted">
                {slide.label}
              </p>
              {slide.node}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
