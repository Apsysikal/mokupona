import { CheckIcon } from "lucide-react";
import React from "react";

import { cn } from "~/lib/utils";

export type CheckboxProps = React.ComponentProps<"input">;

const Checkbox = ({ className, ref, ...props }: CheckboxProps) => (
  <span className="relative inline-flex size-4 shrink-0">
    <input
      type="checkbox"
      ref={ref}
      className={cn(
        "peer checked:bg-primary checked:border-primary focus-visible:ring-ring bg-foreground/5 size-4 shrink-0 appearance-none rounded-sm border transition-colors focus-visible:ring-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
    <CheckIcon className="text-primary-foreground pointer-events-none absolute inset-0 hidden size-4 peer-checked:block" />
  </span>
);

Checkbox.displayName = "Checkbox";

export { Checkbox };
