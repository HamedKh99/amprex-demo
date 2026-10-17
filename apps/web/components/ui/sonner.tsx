"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

/** Light-only toaster (the design has no dark theme), right-to-left. */
const Toaster = ({ ...props }: ToasterProps) => (
  <Sonner
    theme="light"
    dir="rtl"
    position="top-center"
    className="toaster group"
    icons={{
      success: <CircleCheckIcon className="size-4" />,
      info: <InfoIcon className="size-4" />,
      warning: <TriangleAlertIcon className="size-4" />,
      error: <OctagonXIcon className="size-4" />,
      loading: <Loader2Icon className="size-4 animate-spin" />,
    }}
    style={
      {
        "--normal-bg": "var(--popover)",
        "--normal-text": "var(--popover-foreground)",
        "--normal-border": "var(--border)",
        "--border-radius": "var(--radius-card)",
        fontFamily: "var(--font-sans)",
      } as React.CSSProperties
    }
    {...props}
  />
)

export { Toaster }
