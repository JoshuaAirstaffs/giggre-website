import { cn } from "@/lib/utils"

// Grey placeholder in the shape of content that's still loading, with a soft
// shimmer (globals.css .skeleton-shimmer). Use instead of a spinner wherever
// a page, list or section loads; keep spinners for button actions.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("skeleton-shimmer rounded-md bg-muted", className)}
      {...props}
    />
  )
}

/** Rows with an avatar and two lines (notifications, people, favourites). */
function SkeletonRows({ count = 3, avatar = true, className }: { count?: number; avatar?: boolean; className?: string }) {
  return (
    <div role="status" aria-label="Loading" className={cn("space-y-3 p-2", className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          {avatar && <Skeleton className="size-9 shrink-0 rounded-full" />}
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-2.5 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Chat bubbles, alternating sides. */
function SkeletonBubbles({ count = 5, className }: { count?: number; className?: string }) {
  const widths = ["w-2/3", "w-1/3", "w-1/2", "w-2/5", "w-3/5"]
  return (
    <div role="status" aria-label="Loading messages" className={cn("space-y-3", className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={cn("flex", i % 2 ? "justify-end" : "justify-start")}>
          <Skeleton className={cn("rounded-2xl", i % 3 === 2 ? "h-14" : "h-9", widths[i % widths.length])} />
        </div>
      ))}
    </div>
  )
}

export { Skeleton, SkeletonRows, SkeletonBubbles }
