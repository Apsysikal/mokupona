import {
  EnvelopeClosedIcon,
  ExclamationTriangleIcon,
} from "@radix-ui/react-icons";
import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

export function AuthNotice({
  variant,
  title,
  children,
}: {
  variant: "destructive" | "accent";
  title?: string;
  children: ReactNode;
}) {
  const destructive = variant === "destructive";
  const baseClasses =
    "flex items-start gap-3 rounded-lg border p-4 text-sm leading-snug";

  if (destructive) {
    return (
      <div
        role="alert"
        className={cn(
          baseClasses,
          "border-destructive/35 bg-destructive/10 text-destructive-light",
        )}
      >
        <ExclamationTriangleIcon className="mt-1 size-5 shrink-0" />
        <div className="flex flex-col gap-1">
          {title ? <p className="font-semibold">{title}</p> : null}
          <div>{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      className={cn(baseClasses, "border-primary/35 bg-primary/10")}
    >
      <EnvelopeClosedIcon className="text-accent-light mt-1 size-5 shrink-0" />
      <div className="flex flex-col gap-1">
        {title ? (
          <p className="text-accent-light font-semibold">{title}</p>
        ) : null}
        <div className="text-foreground/80">{children}</div>
      </div>
    </div>
  );
}
