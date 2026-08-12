"use client";

import { useState } from "react";
import Link from "next/link";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const topics = ["General question", "Bug report", "Partnership", "Press", "Other"];

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState(topics[0]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);
    try {
      await addDoc(collection(db, "contact_messages"), {
        name: name.trim(),
        email: email.trim(),
        topic,
        message: message.trim(),
        submittedAt: serverTimestamp(),
        source: "web",
      });
      setSent(true);
    } catch {
      setError("Something went wrong sending your message. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-8 rounded-2xl border border-hairline bg-paper p-6 text-sm text-muted">
        <p className="font-[var(--font-display)] text-lg font-semibold text-ink">
          Message sent.
        </p>
        <p className="mt-2">
          Thanks for reaching out — we read every message and usually reply within a couple of
          business days.
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

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="text-sm font-medium text-ink">
            Name
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="mt-2 w-full rounded-xl border border-hairline bg-paper px-4 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-ink"
          />
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
      </div>

      <div>
        <label htmlFor="topic" className="text-sm font-medium text-ink">
          What&apos;s this about?
        </label>
        <select
          id="topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="mt-2 w-full rounded-xl border border-hairline bg-paper px-4 py-3 text-sm text-ink outline-none focus:border-ink"
        >
          {topics.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="message" className="text-sm font-medium text-ink">
          Message
        </label>
        <textarea
          id="message"
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="How can we help?"
          className="mt-2 w-full rounded-xl border border-hairline bg-paper px-4 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-ink"
        />
      </div>

      {error && <p className="text-sm" style={{ color: "var(--danger-text)" }}>{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
