import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ContactForm from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Contact — Giggre",
  description: "Get in touch with the Giggre team.",
};

export default function ContactPage() {
  return (
    <>
      <Header />
      <main className="flex-1 px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-[var(--font-mono)] text-xs"
            style={{ background: "var(--worker-tint)", color: "var(--worker-text)" }}
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16v12H4V6Z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 7l8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Get in touch
          </span>

          <h1 className="mt-4 font-[var(--font-display)] text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Questions, feedback, or just say hi.
          </h1>
          <p className="mt-3 text-muted">
            We&apos;re a small team and read every message ourselves. Fill out the form below or
            email us directly.
          </p>

          <div className="mt-8 flex items-center gap-3 rounded-2xl border border-hairline bg-paper p-5">
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
              Prefer email? Reach us directly at{" "}
              <a href="mailto:support@airstaffs.com" className="font-medium text-ink underline">
                support@airstaffs.com
              </a>
              .
            </p>
          </div>

          <ContactForm />
        </div>
      </main>
      <Footer />
    </>
  );
}
