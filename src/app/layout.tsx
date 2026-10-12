import type { Metadata } from "next";
import Script from "next/script";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import ReduxProvider from "@/store/ReduxProvider";

export const metadata: Metadata = {
  title: "Giggre — gigs on your block",
  description:
    "Giggre connects hosts who need a hand with workers nearby who can help — same block, same day.",
};

// next/font self-hosts and inlines these at build time (no runtime request to
// Google Fonts, no separate @fontsource CSS files for Turbopack to process) —
// same weights @fontsource previously loaded. Each font's `variable` writes
// straight to the custom property globals.css's font tokens already expect,
// so no other file needs to change which name it references.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
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
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
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
