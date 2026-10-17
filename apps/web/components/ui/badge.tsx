import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

/**
 * Design «وضعیت سفارش — Badge»: outline = waiting, neutral = assigned/idle, dark = in progress,
 * success = done, destructive = cancelled or full. Green/red only ever mean status.
 */
const badgeVariants = cva(
  "inline-flex h-6 w-fit shrink-0 items-center gap-1.5 rounded-full border border-transparent px-2.5 text-xs font-semibold whitespace-nowrap",
  {
    variants: {
      variant: {
        outline: "border-slate-300 bg-card text-slate-700",
        neutral: "border-border bg-muted text-slate-700",
        dark: "bg-foreground text-white",
        success: "border-success-border bg-success-muted text-success",
        destructive: "border-destructive-border bg-destructive-muted text-destructive",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
)

function Badge({
  className,
  variant,
  dot = false,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean; dot?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp data-slot="badge" data-variant={variant} className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {children}
    </Comp>
  )
}

export { Badge, badgeVariants }
