import React from "react";

import { cn } from "~/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: React.Ref<HTMLTextAreaElement>;
}

const Textarea = ({ className, ref, ...props }: TextareaProps) => {
  return (
    <textarea
      className={cn(
        "placeholder:text-foreground/50 focus-visible:inset-ring-ring bg-foreground/5 flex min-h-20 w-full rounded-lg border px-3 py-3 transition-colors focus-visible:border-0 focus-visible:inset-ring-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
};

Textarea.displayName = "Textarea";

export { Textarea };
