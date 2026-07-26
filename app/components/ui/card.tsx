import React from "react";

import { cn } from "~/lib/utils";

// Surfaces are elevated with a hairline border, never a shadow (shadows are
// reserved for floating layers). `interactive` adds the hover-border treatment
// the admin list/grid cards share.
const Card = ({
  className,
  interactive = false,
  as: Component = "div",
  ref,
  ...props
}: React.ComponentProps<"div"> & {
  interactive?: boolean;
  as?: React.ElementType;
}) => (
  <Component
    ref={ref}
    className={cn(
      "bg-card text-card-foreground rounded-2xl border",
      interactive && "hover:border-primary/35 transition-colors",
      className,
    )}
    {...props}
  />
);

Card.displayName = "Card";

const CardHeader = ({
  className,
  ref,
  ...props
}: React.ComponentProps<"div">) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-2 p-5 pb-4", className)}
    {...props}
  />
);

CardHeader.displayName = "CardHeader";

const CardTitle = ({
  className,
  ref,
  ...props
}: React.ComponentProps<"div">) => (
  <div
    ref={ref}
    className={cn(
      "text-base leading-none font-semibold tracking-tight",
      className,
    )}
    {...props}
  />
);

CardTitle.displayName = "CardTitle";

const CardDescription = ({
  className,
  ref,
  ...props
}: React.ComponentProps<"div">) => (
  <div
    ref={ref}
    className={cn("text-foreground/50 text-sm", className)}
    {...props}
  />
);

CardDescription.displayName = "CardDescription";

const CardContent = ({
  className,
  ref,
  ...props
}: React.ComponentProps<"div">) => (
  <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
);

CardContent.displayName = "CardContent";

export { Card, CardContent, CardDescription, CardHeader, CardTitle };
