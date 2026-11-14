"use client"

import Link from "next/link"
import { BriefcaseBusiness, UserSearch } from "lucide-react"
import { cn } from "@/lib/utils"

// Worker ⇄ Host switch — same as the app's dashboard headers (Option B of
// the mode-switch mockup): both modes always visible, the current one
// highlighted: "Gig Worker" | "Gig Host".
export function ModeSwitch({ role }: { role: "host" | "worker" }) {
  const segments = [
    { key: "worker", label: "Gig Worker", href: "/app/worker/browse", Icon: UserSearch,
      active: "bg-(--worker-start) text-white" },
    { key: "host", label: "Gig Host", href: "/app/host", Icon: BriefcaseBusiness,
      active: "bg-(--host-start) text-[#5c3d00]" },
  ] as const

  return (
    <nav aria-label="Mode" className="flex gap-1 rounded-full bg-muted/15 p-1">
      {segments.map(({ key, label, href, Icon, active }) => {
        const current = role === key
        const cls = cn(
          "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full text-xs font-semibold transition-colors",
          current ? active : "text-muted hover:bg-background hover:text-ink",
        )
        return current ? (
          <span key={key} aria-current="page" className={cls}>
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
          </span>
        ) : (
          <Link key={key} href={href} className={cls} title={key === "host" ? "Switch to Gig Host" : "Switch to Gig Worker"}>
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
