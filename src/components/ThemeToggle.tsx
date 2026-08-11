"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export default function ThemeToggle() {
  const [state, setState] = useState<{ mounted: boolean; theme: Theme }>({
    mounted: false,
    theme: "light",
  });

  useEffect(() => {
    const attr = document.documentElement.getAttribute("data-theme");
    const resolved: Theme =
      attr === "light" || attr === "dark"
        ? attr
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    // Syncing from browser-only state (localStorage/matchMedia) on mount —
    // required once, to avoid a server/client hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ mounted: true, theme: resolved });
  }, []);

  const toggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    const next: Theme = state.theme === "dark" ? "light" : "dark";
    const rect = event.currentTarget.getBoundingClientRect();

    const applyTheme = () => {
      setState({ mounted: true, theme: next });
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
    };

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || typeof document.startViewTransition !== "function") {
      applyTheme();
      return;
    }

    document.documentElement.style.setProperty(
      "--theme-toggle-x",
      `${rect.left + rect.width / 2}px`
    );
    document.documentElement.style.setProperty(
      "--theme-toggle-y",
      `${rect.top + rect.height / 2}px`
    );
    document.startViewTransition(applyTheme);
  };

  if (!state.mounted) {
    return (
      <button
        type="button"
        aria-label="Toggle theme"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-muted"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={state.theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-muted transition-colors hover:text-ink"
    >
      {state.theme === "dark" ? (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4" strokeLinecap="round" />
          <path
            d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
          <path
            d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
