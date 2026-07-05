import React from "react";

import { cn } from "~/lib/utils";

export interface InputProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: React.Ref<HTMLTextAreaElement>;
}

const Textarea = ({ className, ref, ...props }: InputProps) => {
  return (
    <textarea
      className={cn(
        "border-input placeholder:text-fg-faint focus-visible:inset-ring-ring flex min-h-[70px] w-full rounded-lg border bg-[var(--input-surface,var(--background))] px-3.5 py-3 text-sm focus-visible:border-0 focus-visible:inset-ring-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
};

Textarea.displayName = "Textarea";

export { Textarea };
