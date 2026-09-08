"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, signInWithPopup, type UserCredential } from "firebase/auth";
import { toast } from "sonner";
import { auth, appleProvider, googleProvider } from "@/lib/firebase";
import PasswordInput from "@/components/PasswordInput";

async function establishSession(idToken: string) {
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) throw new Error("Could not establish session.");
}

function authErrorMessage(err: unknown): string | null {
  const code = (err as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return null;
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "Incorrect email or password.";
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "We couldn't find an account with that email.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a bit and try again.";
    case "auth/network-request-failed":
      return "Network error — check your connection and try again.";
    case "auth/account-exists-with-different-credential":
      return "This email is already registered with a different sign-in method.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSignIn(signIn: () => Promise<UserCredential>) {
    setLoading(true);
    setError(null);
    try {
      const credential = await signIn();
      const idToken = await credential.user.getIdToken();
      await establishSession(idToken);
      toast.success("Logged in successfully");
      router.push("/select-role");
      router.refresh();
    } catch (err) {
      const message = authErrorMessage(err);
      if (message) {
        setError(message);
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    runSignIn(() => signInWithEmailAndPassword(auth, email, password));
  }

  function handleGoogle() {
    if (loading) return;
    runSignIn(() => signInWithPopup(auth, googleProvider));
  }

  function handleApple() {
    if (loading) return;
    runSignIn(() => signInWithPopup(auth, appleProvider));
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      <button
        type="button"
        onClick={handleGoogle}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-full border border-hairline px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-mist disabled:cursor-not-allowed disabled:opacity-40"
      >
        <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.5 5.5 29.6 3.5 24 3.5 12.7 3.5 3.5 12.7 3.5 24S12.7 44.5 24 44.5 44.5 35.3 44.5 24c0-1.2-.1-2.4-.3-3.5Z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.5 6.5 29.6 4.5 24 4.5c-8 0-14.9 4.6-18.3 11.3Z" transform="translate(0 -1)" />
          <path fill="#4CAF50" d="M24 44.5c5.5 0 10.4-1.9 13.9-5.1l-6.4-5.4c-1.9 1.3-4.5 2-7.5 2-5.2 0-9.6-3.1-11.3-7.5l-6.6 5.1c3.4 6.7 10.3 10.9 17.9 10.9Z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.4-2.4 4.4-4.4 5.8l6.4 5.4c3.7-3.4 6.2-8.5 6.2-14.7 0-1.2-.1-2.4-.3-3.5Z" />
        </svg>
        {loading ? "Signing in…" : "Continue with Google"}
      </button>

      <button
        type="button"
        onClick={handleApple}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-full border border-hairline px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-mist disabled:cursor-not-allowed disabled:opacity-40"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.673-.546 9.632 1.539 12.786 1.023 1.542 2.238 3.271 3.834 3.211 1.529-.065 2.126-.989 3.997-.989 1.864 0 2.396.989 4.024.955 1.653-.024 2.7-1.52 3.717-3.07 1.17-1.77 1.653-3.485 1.68-3.573-.037-.014-3.222-1.24-3.255-4.914-.027-3.077 2.514-4.549 2.628-4.615-1.436-2.101-3.66-2.336-4.442-2.372-1.936-.153-3.564 1.107-4.797 1.107zm3.9-3.895c.837-.973 1.4-2.327 1.247-3.677-1.206.049-2.657.804-3.522 1.772-.776.848-1.437 2.222-1.256 3.535 1.315.101 2.673-.657 3.531-1.63z" />
        </svg>
        {loading ? "Signing in…" : "Continue with Apple"}
      </button>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--hairline)]" aria-hidden />
        <span className="text-xs text-muted">or</span>
        <span className="h-px flex-1 bg-[var(--hairline)]" aria-hidden />
      </div>

      <div>
        <label htmlFor="email" className="text-sm font-medium text-ink">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-2 w-full rounded-xl border border-hairline bg-paper px-4 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-ink"
        />
      </div>

      <div>
        <label htmlFor="password" className="text-sm font-medium text-ink">
          Password
        </label>
        <PasswordInput
          id="password"
          value={password}
          onChange={setPassword}
          placeholder="Your password"
          className="mt-2 w-full rounded-xl border border-hairline bg-paper px-4 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-ink"
        />
      </div>

      {error && (
        <p className="text-sm" style={{ color: "var(--danger-text)" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? "Signing in…" : "Log in"}
      </button>

      <p className="text-center text-sm text-muted">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-ink hover:underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}
