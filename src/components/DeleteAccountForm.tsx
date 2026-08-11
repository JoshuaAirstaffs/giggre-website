"use client";

import { useState } from "react";
import Link from "next/link";

const reasons = [
  "I no longer use the app",
  "Privacy concerns",
  "Found a better alternative",
  "Too many notifications",
  "Technical issues",
  "Other",
];

export default function DeleteAccountForm() {
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <form className="mt-8 space-y-5" onSubmit={(e) => e.preventDefault()}>
      <div>
        <label htmlFor="email" className="text-sm font-medium text-ink">
          Account email
        </label>
        <input
          id="email"
          type="email"
          placeholder="you@example.com"
          className="mt-2 w-full rounded-xl border border-hairline bg-paper px-4 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-ink"
        />
      </div>

      <div>
        <label htmlFor="password" className="text-sm font-medium text-ink">
          Password
        </label>
        <input
          id="password"
          type="password"
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

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={!confirmed}
          className="rounded-full px-6 py-3 text-sm font-medium text-white shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            background: "linear-gradient(135deg, var(--danger-start), var(--danger-end))",
          }}
        >
          Schedule my deletion
        </button>
        <Link
          href="/"
          className="rounded-full border border-hairline px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-paper"
        >
          Actually, take me home
        </Link>
      </div>
    </form>
  );
}
