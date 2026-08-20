import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { verifySession } from "@/lib/dal";

export const metadata: Metadata = {
  title: "Continue as — Giggre",
};

export default async function SelectRolePage() {
  await verifySession();

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-6 py-20">
      <div className="w-full max-w-2xl">
        <h1 className="text-center font-[var(--font-display)] text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          How do you want to continue?
        </h1>
        <p className="mt-3 text-center text-muted">
          You can switch anytime — this just sets up your view for now.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <Link href="/home/worker" className="group block">
            <Card className="h-full transition-transform group-hover:-translate-y-0.5 group-hover:shadow-md">
              <CardHeader>
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-full"
                  style={{ background: "var(--worker-tint)", color: "var(--worker-text)" }}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
                    <path d="M4 20c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
                    <path d="M17 8v4M19 10h-4" strokeLinecap="round" />
                  </svg>
                </span>
                <CardTitle className="mt-3 text-lg">Sign in as a worker</CardTitle>
                <CardDescription>Browse nearby gigs and get matched, paid the same day.</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          </Link>

          <Link href="/home/host" className="group block">
            <Card className="h-full transition-transform group-hover:-translate-y-0.5 group-hover:shadow-md">
              <CardHeader>
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-full"
                  style={{ background: "var(--host-tint)", color: "var(--host-text)" }}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 10.5 12 4l8 6.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M6 9.5V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <CardTitle className="mt-3 text-lg">Sign in as a host</CardTitle>
                <CardDescription>Post a gig and get help from someone nearby, fast.</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          </Link>
        </div>
      </div>
    </main>
  );
}
