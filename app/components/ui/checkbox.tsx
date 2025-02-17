import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { CheckIcon } from "@radix-ui/react-icons";
import type { ClassValue } from "clsx";
import React from "react";

import { cn } from "~/lib/utils";

export type CheckboxProps = Omit<
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
  "type"
> & {
  type?: string;
};

const Checkbox = ({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root> & {
  className?: string | ClassValue[];
}) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer border-primary focus-visible:ring-ring data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground h-4 w-4 shrink-0 rounded-sm border shadow-sm focus-visible:ring-1 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <CheckIcon className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
);

Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
