import { cva, type VariantProps } from "class-variance-authority";
import { Label as LabelPrimitive } from "radix-ui";
import React from "react";

import { cn } from "~/lib/utils";

const labelVariants = cva(
  "text-foreground/65 text-sm leading-none font-semibold peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
);

const Label = ({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root> &
  VariantProps<typeof labelVariants>) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
);

Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
