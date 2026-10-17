import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

/** Design «دکمه‌ها»: amber primary is for the single main action of a screen. */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-control border border-transparent font-semibold whitespace-nowrap no-underline transition-colors outline-none select-none focus-visible:border-foreground focus-visible:ring-3 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
  {
    variants: {
      variant: {
        primary:
          "border-primary-border bg-primary text-primary-foreground hover:bg-primary-hover hover:text-primary-foreground",
        secondary: "border-border bg-secondary text-secondary-foreground hover:bg-border hover:text-foreground",
        outline: "border-border bg-card text-foreground hover:bg-muted hover:text-foreground",
        ghost: "bg-transparent text-slate-700 hover:bg-muted hover:text-foreground",
        danger:
          "border-destructive-border bg-card text-destructive hover:bg-destructive-muted hover:text-destructive",
        dark: "border-foreground bg-foreground text-white hover:bg-slate-800 hover:text-white",
        link: "h-auto border-0 p-0 text-link hover:text-link-hover",
      },
      size: {
        default: "h-10 px-4 text-sm",
        sm: "h-[38px] px-3.5 text-sm",
        lg: "h-12 px-5 text-[15px]",
        /** Technician app bottom bar (design: 60px, radius 14). */
        touch: "h-[60px] w-full rounded-sheet px-5 text-lg font-extrabold",
        icon: "size-10",
        "icon-sm": "size-8",
        "icon-touch": "size-11 rounded-touch",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
