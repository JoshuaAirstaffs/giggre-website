import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Apply — Giggre",
  description: "Apply to work gigs with Giggre.",
};

const openings = [
  {
    title: "Repair Technician",
    description:
      "No experience required — training will be provided. We are looking for hardworking individuals who are willing to learn and develop their skills as a Repair Technician.",
    formUrl: "https://forms.gle/rfpVNcadUSvxYcfaA",
  },
  {
    title: "Warehouse Helper",
    description:
      "No experience required — training will be provided. We are looking for hardworking individuals who are willing to learn and develop their skills as a Warehouse Helper.",
    formUrl: "https://forms.gle/mT5ffUUpYEG9gqgj8",
  },
];

export default function ApplyPage() {
  return (
    <>
      <Header />
      <main className="flex-1 px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-[var(--font-display)] text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Apply
          </h1>
          <p className="mt-3 text-muted">
            Open positions with Giggre. Pick a role below to get started.
          </p>

          <div className="mt-8 space-y-4">
            {openings.map((job) => (
              <div
                key={job.title}
                className="rounded-2xl border border-hairline bg-paper p-6"
              >
                <h2 className="text-lg font-semibold text-ink">{job.title}</h2>
                <p className="mt-2 text-sm text-muted">{job.description}</p>
                <a
                  href={job.formUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-transform hover:scale-[1.03] active:scale-[0.98]"
                >
                  Apply now
                </a>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
