import { CheckIcon } from "@radix-ui/react-icons";
import React from "react";

import { cn } from "~/lib/utils";

export type CheckboxProps = React.ComponentProps<"input">;

const Checkbox = ({ className, ref, ...props }: CheckboxProps) => (
  <span className="relative inline-flex size-4 shrink-0">
    <input
      type="checkbox"
      ref={ref}
      className={cn(
        "peer border-border checked:bg-primary checked:border-primary focus-visible:ring-ring size-4 shrink-0 appearance-none rounded-sm border bg-foreground/5 transition-colors focus-visible:ring-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
    <CheckIcon className="text-primary-foreground pointer-events-none absolute inset-0 hidden size-4 peer-checked:block" />
  </span>
);

Checkbox.displayName = "Checkbox";

export { Checkbox };
