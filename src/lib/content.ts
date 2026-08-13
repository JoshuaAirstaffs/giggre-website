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
    headline: "Find gigs near you — grow your income your way.",
    sub: "Giggre shows you paid gigs sorted by what they pay, so you always see the best-paying work first. Get matched in minutes and paid out the same day.",
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
    dashboard: {
      name: "Ana R.",
      headerTitle: "Worker Dashboard",
      status: "You're online · available for gigs",
      earningsLabel: "Earned so far",
      earnings: "$1,240",
      earningsSub: "18 gigs completed · $180 this week",
      gigs: [
        {
          title: "Fix a leaky faucet",
          type: "quick",
          host: "Jomar S.",
          pay: "$35",
          meta: "0.4 km · today",
        },
        {
          title: "Weekend yard clean-up",
          type: "open",
          host: "Liza C.",
          pay: "$40",
          meta: "0.6 km · tomorrow",
        },
        {
          title: "Repaint the gate",
          type: "offered",
          host: "Ric D.",
          pay: "$60",
          meta: "0.3 km · this week",
        },
      ],
    },
  },
  host: {
    label: "I need help",
    eyebrow: "Now live in your area",
    headline: "Get help from someone nearby.",
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
    dashboard: {
      name: "Maria K.",
      headerTitle: "Host Dashboard",
      headerSubtitle: "Manage your gigs and find workers",
      status: "12 workers online near you",
      nearbyWorkers: [
        { name: "Jomar S.", left: "22%", top: "28%" },
        { name: "Liza C.", left: "58%", top: "60%" },
        { name: "Ric D.", left: "78%", top: "24%" },
      ],
      gigs: [
        {
          title: "Fix a leaky faucet",
          statusLabel: "Looking for a worker",
          statusColor: "gold",
          meta: "Plumbing · $35 · 0/1 workers · 2h ago",
          sub: "3 interested workers waiting for your review",
          applicants: 3,
        },
        {
          title: "Weekend yard clean-up",
          statusLabel: "Underway",
          statusColor: "green",
          meta: "Yard work · $40 · 1/1 workers · 1d ago",
          sub: "Liza's on the way",
        },
        {
          title: "Repaint the gate",
          statusLabel: "All done",
          statusColor: "gray",
          meta: "Painting · $60 · 1/1 workers · 3d ago",
          sub: "Completed · $60 paid",
        },
      ],
    },
  },
} as const;

export const openGigPostExample = {
  title: "Weekend yard clean-up",
  description: "Need someone to mow the lawn, trim the hedges, and bag the clippings.",
  skill: "Yard Work",
  experience: "Entry Level",
  experienceSub: "No prior experience needed",
  amount: "$40",
  workers: 1,
  date: "Sat, Aug 16",
  time: "10:00 AM",
  location: "San Francisco, California",
  locationSub: "Current GPS location",
};

export const gigTrackingExample = {
  gigTitle: "Weekend yard clean-up",
  workerName: "Liza C.",
  distance: "0.6 km away",
  stepIndex: 0,
  stepTitle: "Liza C. is heading to your location",
  stepBody: "Live location is shared — you'll be notified the moment they arrive.",
};

export const gigCompleteExample = {
  gigTitle: "Weekend yard clean-up",
  workerName: "Liza C.",
  distance: "0 km away",
  stepIndex: 5,
  stepTitle: "Gig complete!",
  stepBody: "Rate Liza C. to help other hosts.",
};

export const applyGigExample = {
  title: "Weekend yard clean-up",
  status: "Open",
  postedAgo: "2h ago",
  applicantsCount: 3,
  host: "Liza C.",
  hostRating: "4.9",
  pay: "$40",
  schedule: "Sat, Aug 16 · 10:00 AM",
  distance: "0.6 km",
  experience: "Entry Level",
  skills: [
    { name: "Yard Work", have: true },
    { name: "Lawn Mowing", have: true },
    { name: "Heavy Lifting", have: false },
  ],
};

export const workerProgressExample = {
  gigTitle: "Fix a leaky faucet",
  hostName: "Jomar S.",
  pay: "$35",
  distance: "0.4 km away",
  elapsed: "18:42",
  stepIndex: 2,
  stepTitle: "Gig in progress",
  stepBody: "The host will mark the gig as done when finished.",
};

export const workerCompleteExample = {
  gigTitle: "Fix a leaky faucet",
  hostName: "Liza C.",
  pay: "$35",
  distance: "0 km away",
  elapsed: "42:10",
  stepIndex: 5,
  stepTitle: "All done — great work!",
  stepBody: "This gig is complete. Rate your host below.",
};
