import React from "react";

import { cn } from "~/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  ref?: React.Ref<HTMLInputElement>;
}

const Input = ({ className, type, ref, ...props }: InputProps) => {
  return (
    <input
      type={type}
      className={cn(
        "border-input placeholder:text-muted-foreground file:placeholder:text-foreground focus-visible:inset-ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:border-0 focus-visible:inset-ring-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
};

Input.displayName = "Input";

export { Input };
