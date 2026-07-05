import React from "react";

import { cn } from "~/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  ref?: React.Ref<HTMLInputElement>;
}

const Input = ({ className, type, ref, ...props }: InputProps) => {
  return (
    <input
      type={type}
      className={cn(
        // bg falls back to the page surface; raised containers (cards) set
        // --input-surface so inputs always contrast with their parent
        "border-input placeholder:text-fg-faint file:placeholder:text-foreground file:text-foreground focus-visible:inset-ring-ring flex h-11 w-full rounded-lg border bg-[var(--input-surface,var(--background))] px-3.5 py-1 text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:border-0 focus-visible:inset-ring-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
};

Input.displayName = "Input";

export { Input };
