"use client";

import { useState } from "react";
import Link from "next/link";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  limit,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  getDocs,
} from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";

const reasons = [
  "I no longer use the app",
  "Privacy concerns",
  "Found a better alternative",
  "Too many notifications",
  "Technical issues",
  "Other",
];

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type View = "form" | "pending" | "success" | "cancelled";

type PendingInfo = { requestId: string; uid: string; scheduledAt: Date };

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
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
    default:
      return "Something went wrong. Please try again.";
  }
}

export default function DeleteAccountForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("form");
  const [pendingInfo, setPendingInfo] = useState<PendingInfo | null>(null);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);

  async function afterAuth(user: User) {
    const existing = await getDocs(
      query(
        collection(db, "account_delete_requests"),
        where("userId", "==", user.uid),
        where("status", "in", ["pending_deletion", "approved"]),
        limit(1)
      )
    );

    if (!existing.empty) {
      const existingDoc = existing.docs[0];
      const data = existingDoc.data();
      setPendingInfo({
        requestId: existingDoc.id,
        uid: user.uid,
        scheduledAt: (data.deletionScheduledAt as Timestamp).toDate(),
      });
      setView("pending");
      return;
    }

    const now = new Date();
    const scheduled = new Date(now.getTime() + THIRTY_DAYS_MS);
    const finalReason = reason === "Other" ? otherReason.trim() : reason;

    await addDoc(collection(db, "account_delete_requests"), {
      userId: user.uid,
      email: user.email ?? email,
      requestedAt: serverTimestamp(),
      deletionScheduledAt: Timestamp.fromDate(scheduled),
      status: "pending_deletion",
      source: "web",
      ...(finalReason ? { reason: finalReason } : {}),
    });

    await updateDoc(doc(db, "users", user.uid), {
      pendingDeletion: true,
      scheduledDeleteAt: Timestamp.fromDate(scheduled),
    }).catch(() => {});

    setScheduledAt(scheduled);
    setView("success");
  }

  async function runAuthenticated(signIn: () => Promise<User>) {
    setLoading(true);
    setError(null);
    try {
      const user = await signIn();
      await afterAuth(user);
    } catch (err) {
      const message = authErrorMessage(err);
      if (message) setError(message);
    } finally {
      setLoading(false);
      signOut(auth).catch(() => {});
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmed || loading) return;
    runAuthenticated(async () => (await signInWithEmailAndPassword(auth, email, password)).user);
  }

  function handleGoogle() {
    if (!confirmed || loading) return;
    runAuthenticated(async () => (await signInWithPopup(auth, googleProvider)).user);
  }

  async function handleCancel() {
    if (!pendingInfo || loading) return;
    setLoading(true);
    setError(null);
    try {
      await updateDoc(doc(db, "account_delete_requests", pendingInfo.requestId), {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "users", pendingInfo.uid), {
        pendingDeletion: false,
        scheduledDeleteAt: null,
      }).catch(() => {});
      setView("cancelled");
    } catch {
      setError("Failed to cancel your deletion request. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (view === "success" && scheduledAt) {
    return (
      <div className="mt-8 rounded-2xl border border-hairline bg-paper p-6 text-sm text-muted">
        <p className="font-[var(--font-display)] text-lg font-semibold text-ink">
          Your deletion request is scheduled.
        </p>
        <p className="mt-2">
          Your account and data will be permanently erased on{" "}
          <span className="font-medium text-ink">{formatDate(scheduledAt)}</span>. You can cancel
          any time before then by signing in on this page again.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex rounded-full border border-hairline px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-mist"
        >
          Back home
        </Link>
      </div>
    );
  }

  if (view === "cancelled") {
    return (
      <div className="mt-8 rounded-2xl border border-hairline bg-paper p-6 text-sm text-muted">
        <p className="font-[var(--font-display)] text-lg font-semibold text-ink">
          Your deletion request has been cancelled.
        </p>
        <p className="mt-2">Your account is back to normal — nothing else changes.</p>
        <Link
          href="/"
          className="mt-5 inline-flex rounded-full border border-hairline px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-mist"
        >
          Back home
        </Link>
      </div>
    );
  }

  if (view === "pending" && pendingInfo) {
    return (
      <div className="mt-8 rounded-2xl border border-hairline bg-paper p-6 text-sm text-muted">
        <p className="font-[var(--font-display)] text-lg font-semibold text-ink">
          You already have a deletion request pending.
        </p>
        <p className="mt-2">
          Your account is scheduled to be permanently deleted on{" "}
          <span className="font-medium text-ink">{formatDate(pendingInfo.scheduledAt)}</span>.
          Changed your mind?
        </p>
        {error && <p className="mt-3 text-sm" style={{ color: "var(--danger-text)" }}>{error}</p>}
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Cancelling…" : "Cancel my deletion request"}
          </button>
          <Link
            href="/"
            className="rounded-full border border-hairline px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-mist"
          >
            Nevermind, take me home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="email" className="text-sm font-medium text-ink">
          Account email
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

        <div className="mt-3 flex items-center gap-3">
          <span className="h-px flex-1 bg-[var(--hairline)]" aria-hidden />
          <span className="text-xs text-muted">or</span>
          <span className="h-px flex-1 bg-[var(--hairline)]" aria-hidden />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={!confirmed || loading}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-hairline px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-mist disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.5 5.5 29.6 3.5 24 3.5 12.7 3.5 3.5 12.7 3.5 24S12.7 44.5 24 44.5 44.5 35.3 44.5 24c0-1.2-.1-2.4-.3-3.5Z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.5 6.5 29.6 4.5 24 4.5c-8 0-14.9 4.6-18.3 11.3Z" transform="translate(0 -1)" />
            <path fill="#4CAF50" d="M24 44.5c5.5 0 10.4-1.9 13.9-5.1l-6.4-5.4c-1.9 1.3-4.5 2-7.5 2-5.2 0-9.6-3.1-11.3-7.5l-6.6 5.1c3.4 6.7 10.3 10.9 17.9 10.9Z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.4-2.4 4.4-4.4 5.8l6.4 5.4c3.7-3.4 6.2-8.5 6.2-14.7 0-1.2-.1-2.4-.3-3.5Z" />
          </svg>
          {loading ? "Verifying…" : "Continue with Google"}
        </button>
        <p className="mt-1.5 text-xs text-muted">
          Signed up with Google? Use the button above — no need to fill in a password below.
        </p>
      </div>

      <div>
        <label htmlFor="password" className="text-sm font-medium text-ink">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Confirm it's you"
          className="mt-2 w-full rounded-xl border border-hairline bg-paper px-4 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-ink"
        />
        <p className="mt-1.5 text-xs text-muted">
          We ask for this to make sure it&apos;s really you asking, not someone else.
        </p>
      </div>

      <div>
        <label htmlFor="reason" className="text-sm font-medium text-ink">
          Why are you leaving?{" "}
          <span className="font-normal text-muted">(optional — helps us improve)</span>
        </label>
        <select
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-2 w-full rounded-xl border border-hairline bg-paper px-4 py-3 text-sm text-ink outline-none focus:border-ink"
        >
          <option value="">Prefer not to say</option>
          {reasons.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        {reason === "Other" && (
          <textarea
            value={otherReason}
            onChange={(e) => setOtherReason(e.target.value)}
            placeholder="Tell us more…"
            rows={3}
            className="mt-2 w-full rounded-xl border border-hairline bg-paper px-4 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-ink"
          />
        )}
      </div>

      <label className="flex items-start gap-3 text-sm text-muted">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-hairline"
        />
        I understand this request is permanent once the 30 days are up, and I still want to go.
      </label>

      {error && <p className="text-sm" style={{ color: "var(--danger-text)" }}>{error}</p>}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={!confirmed || loading}
          className="rounded-full px-6 py-3 text-sm font-medium text-white shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            background: "linear-gradient(135deg, var(--danger-start), var(--danger-end))",
          }}
        >
          {loading ? "Verifying…" : "Schedule my deletion"}
        </button>
        <Link
          href="/"
          className="rounded-full border border-hairline px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-mist"
        >
          Actually, take me home
        </Link>
      </div>
    </form>
  );
}
