export type Mode = "worker" | "host";
export type GigType = "quick" | "open" | "offered";

export const gigTypes = [
  {
    key: "quick",
    tag: "Fastest",
    title: "Quick Gig",
    accentTint: "var(--quick-tint)",
    accentText: "var(--quick-text)",
    accentStart: "var(--quick-start)",
    accentEnd: "var(--quick-end)",
    steps: {
      worker: [
        {
          title: "Stay ready",
          body: "Turn on availability so Giggre knows you're nearby and qualified.",
        },
        {
          title: "Get matched, then decide",
          body: "The moment a quick gig posts near you, Giggre sends it your way first — once you accept, you're set. No applying needed.",
        },
        {
          title: "Do the gig, get paid",
          body: "Show up, do the work, and get paid in cash the same day.",
        },
      ],
      host: [
        {
          title: "Post what you need",
          body: "Describe the task and your budget — no need to set an appointment time.",
        },
        {
          title: "Get instantly matched",
          body: "Giggre offers it to the nearest qualified worker first — once they accept, you're set. No applications to review.",
        },
        {
          title: "Track it, pay it",
          body: "Watch them arrive and pay in cash the moment it's done.",
        },
      ],
    },
  },
  {
    key: "open",
    tag: "Most control",
    title: "Open Gig",
    accentTint: "var(--worker-tint)",
    accentText: "var(--worker-text)",
    accentStart: "var(--worker-start)",
    accentEnd: "var(--worker-end)",
    steps: {
      worker: [
        {
          title: "See what's nearby",
          body: "Open the app to real gigs in your area, closest first, updated live.",
        },
        {
          title: "Send your offer",
          body: "Apply with your price and availability — no back and forth on other apps.",
        },
        {
          title: "Do the gig, get paid",
          body: "Get accepted, do the gig, and get paid in cash the same day.",
        },
      ],
      host: [
        {
          title: "Post what you need",
          body: "Describe the task, your budget, and when you need it done.",
        },
        {
          title: "Pick your local",
          body: "Compare applications from qualified workers nearby and accept the one you trust.",
        },
        {
          title: "Track it, pay it",
          body: "Watch progress in the app and pay in cash the moment it's finished.",
        },
      ],
    },
  },
  {
    key: "offered",
    tag: "Direct ask",
    title: "Offered Gig",
    accentTint: "var(--offered-tint)",
    accentText: "var(--offered-text)",
    accentStart: "var(--offered-start)",
    accentEnd: "var(--offered-end)",
    steps: {
      worker: [
        {
          title: "Get offered directly",
          body: "A host who already trusts your work sends the gig straight to you.",
        },
        {
          title: "Accept or decline",
          body: "Review the details and accept if it works for you — no applying required.",
        },
        {
          title: "Do the gig, get paid",
          body: "Show up, do the work, and get paid in cash the same day.",
        },
      ],
      host: [
        {
          title: "Pick your trusted worker",
          body: "Already know who you want? Choose them from your past gigs or nearby list.",
        },
        {
          title: "Send the offer",
          body: "Offer the gig directly with your price and timing — no posting required.",
        },
        {
          title: "Track it, pay it",
          body: "Watch progress in the app and pay in cash the moment it's finished.",
        },
      ],
    },
  },
] as const;

export const modeCopy = {
  worker: {
    label: "I want to earn",
    eyebrow: "Now live in your area",
    headline: "Find gigs near you — the distance is your call.",
    sub: "Giggre shows you paid gigs closest first, but the choice is yours — apply down the block or across town. Get matched in minutes and paid out the same day.",
    cta: "Browse nearby gigs",
    accentTint: "var(--worker-tint)",
    accentText: "var(--worker-text)",
    accentStart: "var(--worker-start)",
    accentEnd: "var(--worker-end)",
    radarPins: [
      { label: "Fix a leaky faucet", meta: "0.4 km · $35", angle: 20, radius: 0.55 },
      { label: "Move a sofa upstairs", meta: "0.9 km · $25", angle: 100, radius: 0.8 },
      { label: "Weekend yard clean-up", meta: "0.6 km · $40", angle: 190, radius: 0.65 },
      { label: "Watch the store for 2 hrs", meta: "1.1 km · $20", angle: 260, radius: 0.9 },
      { label: "Repaint the gate", meta: "0.3 km · $60", angle: 320, radius: 0.45 },
    ],
  },
  host: {
    label: "I need help",
    eyebrow: "Now live in your area",
    headline: "Get help from someone on your own block.",
    sub: "Post what you need done, set your budget, and Giggre matches you with a verified local who can start today.",
    cta: "Post a gig",
    accentTint: "var(--host-tint)",
    accentText: "var(--host-text)",
    accentStart: "var(--host-start)",
    accentEnd: "var(--host-end)",
    radarPins: [
      { label: "Maria K. · Handyman", meta: "0.4 km · ★4.9", angle: 40, radius: 0.5 },
      { label: "Jomar S. · Mover", meta: "0.8 km · ★4.8", angle: 120, radius: 0.85 },
      { label: "Ana R. · Cleaner", meta: "0.5 km · ★5.0", angle: 210, radius: 0.6 },
      { label: "Ric D. · Painter", meta: "1.0 km · ★4.7", angle: 280, radius: 0.9 },
      { label: "Liza C. · Errands", meta: "0.3 km · ★4.9", angle: 340, radius: 0.4 },
    ],
  },
} as const;
