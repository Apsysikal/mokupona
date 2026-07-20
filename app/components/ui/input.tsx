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
        // one field recipe: the merged hairline (foreground/15), a subtle
        // foreground/5 fill so the field reads as raised on either surface
        "border-border placeholder:text-foreground/40 file:placeholder:text-foreground file:text-foreground focus-visible:inset-ring-ring bg-foreground/5 flex h-11 w-full rounded-lg border px-3 py-1 transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:border-0 focus-visible:inset-ring-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
};

Input.displayName = "Input";

export { Input };
