import { cva, type VariantProps } from "class-variance-authority";
import React from "react";

import { cn } from "~/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border-transparent",
        secondary: "bg-secondary text-secondary-foreground border-foreground/15",
        destructive:
          "bg-destructive text-destructive-foreground border-transparent",
        outline: "text-foreground",
        info: "border-sky-300/40 bg-sky-300/15 text-sky-300",
      },
      // pill-shaped badges (the "next dinner" tag, admin filter shapes) vs the
      // default rounded rectangle
      pill: {
        true: "rounded-full",
        false: "rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      pill: false,
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, pill, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, pill }), className)} {...props} />
  );
}

export { Badge };
