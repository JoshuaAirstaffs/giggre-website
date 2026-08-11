import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DeleteAccountForm from "@/components/DeleteAccountForm";

export const metadata: Metadata = {
  title: "Delete your account — Giggre",
  description: "Request account deletion from Giggre — reviewed and completed within 30 days.",
};

export default function DeleteAccountPage() {
  return (
    <>
      <Header />
      <main className="flex-1 px-6 py-20">
        <div className="mx-auto max-w-lg">
          <span
            className="inline-flex rounded-full px-2.5 py-1 font-[var(--font-mono)] text-xs"
            style={{ background: "var(--danger-tint)", color: "var(--danger-text)" }}
          >
            We&apos;ll miss you
          </span>

          <h1 className="mt-4 font-[var(--font-display)] text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Sorry to see you go.
          </h1>
          <p className="mt-3 text-muted">
            Deleting your account isn&apos;t instant — here&apos;s exactly what happens once you
            submit a request below.
          </p>

          <ul className="mt-6 space-y-3 rounded-2xl border border-hairline bg-paper p-5 text-sm text-muted">
            <li className="flex gap-2">
              <span aria-hidden style={{ color: "var(--danger-text)" }}>—</span>
              Your request goes to our team for review, then gets scheduled for deletion 30 days
              after it&apos;s approved.
            </li>
            <li className="flex gap-2">
              <span aria-hidden style={{ color: "var(--danger-text)" }}>—</span>
              You won&apos;t be able to use the app while a request is pending — logging back in
              only shows you a screen to cancel the deletion, nothing else, until you do.
            </li>
            <li className="flex gap-2">
              <span aria-hidden style={{ color: "var(--danger-text)" }}>—</span>
              Once the 30 days are up, your profile and account details are permanently erased
              and can&apos;t be restored.
            </li>
            <li className="flex gap-2">
              <span aria-hidden style={{ color: "var(--danger-text)" }}>—</span>
              Completed gigs stay on other people&apos;s history, but your name on them is
              replaced with &quot;Deleted User&quot; / &quot;Deleted Worker.&quot;
            </li>
            <li className="flex gap-2">
              <span aria-hidden style={{ color: "var(--danger-text)" }}>—</span>
              Settle any gigs you still owe or are owed cash for beforehand — Giggre doesn&apos;t
              hold or transfer money on your behalf.
            </li>
          </ul>

          <p className="mt-6 text-sm text-muted">
            Changed your mind? Nothing happens until you submit below — feel free to just close
            this page.
          </p>

          <DeleteAccountForm />
        </div>
      </main>
      <Footer />
    </>
  );
}
