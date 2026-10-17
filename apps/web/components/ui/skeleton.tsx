import { cn } from "@/lib/utils"

/** Design «اسکلتون»: border-colour blocks pulsing. Decorative; the container announces loading. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" aria-hidden className={cn("animate-pulse rounded-sm bg-border", className)} {...props} />
}

export { Skeleton }
