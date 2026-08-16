import { cva, type VariantProps } from "class-variance-authority";
import React from "react";

import { cn } from "~/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center border px-3 py-1 text-xs font-semibold tracking-wide",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border-transparent",
        secondary: "bg-card text-card-foreground",
        info: "border-sky-300/35 bg-sky-300/10 text-sky-300",
      },
      pill: {
        true: "rounded-full",
        false: "rounded-lg",
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
    <div
      className={cn(badgeVariants({ variant, pill }), className)}
      {...props}
    />
  );
}

export { Badge };
