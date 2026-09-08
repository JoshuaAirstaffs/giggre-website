import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RegisterForm from "@/components/RegisterForm";

export const metadata: Metadata = {
  title: "Sign up — Giggre",
  description: "Create your Giggre account.",
};

export default function RegisterPage() {
  return (
    <>
      <Header />
      <main className="flex-1 px-6 py-20">
        <div className="mx-auto max-w-md">
          <h1 className="font-[var(--font-display)] text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Create your account.
          </h1>
          <p className="mt-3 text-muted">Join Giggre to post gigs or start earning nearby.</p>

          <RegisterForm />
        </div>
      </main>
      <Footer />
    </>
  );
}
