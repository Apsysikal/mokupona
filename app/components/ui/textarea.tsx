import React from "react";

import { cn } from "~/lib/utils";

export interface InputProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: React.Ref<HTMLTextAreaElement>;
}

const Textarea = ({ className, ref, ...props }: InputProps) => {
  return (
    <textarea
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[60px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:ring-1 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
};

Textarea.displayName = "Textarea";

export { Textarea };
