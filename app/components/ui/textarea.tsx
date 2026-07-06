import React from "react";

import { cn } from "~/lib/utils";

export interface InputProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: React.Ref<HTMLTextAreaElement>;
}

const Textarea = ({ className, ref, ...props }: InputProps) => {
  return (
    <textarea
      className={cn(
        "border-border placeholder:text-foreground/40 focus-visible:inset-ring-ring flex min-h-18 w-full rounded-lg border bg-foreground/5 px-3 py-3 text-sm transition-colors focus-visible:border-0 focus-visible:inset-ring-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
};

Textarea.displayName = "Textarea";

export { Textarea };
