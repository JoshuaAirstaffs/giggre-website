# Giggre website

Marketing homepage for Giggre — hyperlocal gig marketplace, launching neighborhood by neighborhood.

## Stack
- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4
- Framer Motion for animation
- Self-hosted fonts via `@fontsource` (Space Grotesk, Inter, JetBrains Mono) — no runtime call to Google Fonts, so it builds fine behind restricted networks/CI.

## Structure
```
src/
  app/
    layout.tsx      root layout, fonts, metadata
    page.tsx         renders HomeClient
    globals.css      design tokens (colors, fonts) as CSS variables
  components/
    HomeClient.tsx   owns the worker/host toggle state
    Header.tsx
    Hero.tsx
    DashboardMockup.tsx  phone-frame mockup of the real worker/host app dashboard
    ModeToggle.tsx       worker/host pill switch
    HowItWorks.tsx
    LocalProof.tsx
    DownloadCTA.tsx
    Footer.tsx
  lib/
    content.ts       all copy + dashboard mockup data for worker/host modes, edit here first
```

## Run locally
```
npm install
npm run dev
```

## Still needed (not in this build)
- `/privacy-policy`, `/terms`, `/delete-account` pages — footer already links to these paths, carried over from the current site. Rebuild them as real routes under `src/app/`.
- Login, dashboard, worker view, host view — to be scoped next.
- Real Google Play badge asset + link (placeholder button currently links to `#`).
- Account deletion should call your Supabase/Firebase delete function directly once that page is rebuilt — plan for a server action or API route under `src/app/api/delete-account/route.ts` that verifies the signed-in user before deleting, rather than doing it client-side.

## Deploy
Push to a GitHub repo you control, then import into Vercel. No environment variables are required for this homepage yet.
