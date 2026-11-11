import type { Metadata } from "next";
import Script from "next/script";
import localFont from "next/font/local";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import ReduxProvider from "@/store/ReduxProvider";

export const metadata: Metadata = {
  title: "Giggre — gigs on your block",
  description:
    "Giggre connects hosts who need a hand with workers nearby who can help — same block, same day.",
};

// Self-hosted from the .woff2 files in ./fonts (copied from the
// @fontsource/* packages — same weights the old next/font/google setup
// loaded) rather than next/font/google, which fetches font metadata from
// fonts.googleapis.com at build time: that request intermittently failed on
// Hostinger's build server (and even locally in this sandbox), breaking the
// whole build on a transient network hiccup unrelated to this code. Local
// fonts have no such dependency — the files are already in the repo. Each
// font's `variable` writes straight to the custom property globals.css's
// font tokens already expect, so no other file needs to change which name
// it references.
const spaceGrotesk = localFont({
  src: [
    { path: "./fonts/space-grotesk-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/space-grotesk-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/space-grotesk-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
});
const inter = localFont({
  src: [
    { path: "./fonts/inter-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/inter-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/inter-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-body",
  display: "swap",
});
const jetbrainsMono = localFont({
  src: [
    { path: "./fonts/jetbrains-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/jetbrains-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
});

const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") {
      document.documentElement.setAttribute("data-theme", stored);
    }
  } catch (e) {}
})();
`;

// One-time cleanup: an older version of this site registered a service worker
// that some returning visitors still have, which serves stale cached pages
// instead of fetching new deploys. This app doesn't use a service worker, so
// unregister any leftover ones and clear their caches.
const swCleanupScript = `
(function () {
  try {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        regs.forEach(function (reg) { reg.unregister(); });
      });
    }
    if ("caches" in window) {
      caches.keys().then(function (keys) {
        keys.forEach(function (key) { caches.delete(key); });
      });
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/* Saved light/dark theme before first paint. next/script instead of a
            raw <script>: React 19 warns about script tags in components. */}
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <Script id="sw-cleanup" strategy="afterInteractive">
          {swCleanupScript}
        </Script>
        <ReduxProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster position="top-center" />
        </ReduxProvider>
      </body>
    </html>
  );
}
