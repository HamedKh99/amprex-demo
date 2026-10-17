import * as React from "react"
import { cn } from "@/lib/utils"

/** Design «ورودی»: 44px, slate-300 border; focus = dark border + amber ring; invalid = red border. */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-control border border-input bg-card px-3 text-sm text-foreground transition-colors outline-none placeholder:text-subtle-foreground focus-visible:border-foreground focus-visible:ring-3 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
