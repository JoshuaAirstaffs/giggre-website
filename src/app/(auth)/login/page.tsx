import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoginForm from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Log in — Giggre",
  description: "Log in to your Giggre account.",
};

export default function LoginPage() {
  return (
    <>
      <Header />
      <main className="flex-1 px-6 py-20">
        <div className="mx-auto max-w-md">
          <h1 className="font-[var(--font-display)] text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Welcome back.
          </h1>
          <p className="mt-3 text-muted">Log in with the same account you use on the app.</p>

          <LoginForm />
        </div>
      </main>
      <Footer />
    </>
  );
}
