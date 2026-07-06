import React from "react";

import { cn } from "~/lib/utils";

// Surfaces are elevated with a hairline border, never a shadow (shadows are
// reserved for floating layers). `interactive` adds the hover-border treatment
// the admin list/grid cards share.
const Card = ({
  className,
  interactive = false,
  ref,
  ...props
}: React.ComponentProps<"div"> & { interactive?: boolean }) => (
  <div
    ref={ref}
    className={cn(
      "bg-card text-card-foreground rounded-2xl border",
      interactive && "hover:border-primary/30 transition-colors",
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
    className={cn("flex flex-col gap-1.5 p-6", className)}
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
    className={cn("leading-none font-semibold tracking-tight", className)}
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
    className={cn("text-muted-foreground text-sm", className)}
    {...props}
  />
);

CardDescription.displayName = "CardDescription";

const CardContent = ({
  className,
  ref,
  ...props
}: React.ComponentProps<"div">) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
);

CardContent.displayName = "CardContent";

const CardFooter = ({
  className,
  ref,
  ...props
}: React.ComponentProps<"div">) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
);

CardFooter.displayName = "CardFooter";

export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
};
