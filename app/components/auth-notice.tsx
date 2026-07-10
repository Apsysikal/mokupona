import {
  EnvelopeClosedIcon,
  ExclamationTriangleIcon,
} from "@radix-ui/react-icons";
import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

// form-level banner inside the auth form column (design handoff). The icon
// carries the state — never color alone. destructive = bad credentials,
// accent = "verification link just sent".
export function AuthNotice({
  variant,
  title,
  children,
}: {
  variant: "destructive" | "accent";
  /** bold first line (the accent variant uses it) */
  title?: string;
  children: ReactNode;
}) {
  const destructive = variant === "destructive";

  return (
    <div
      role={destructive ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4 text-sm leading-snug",
        destructive
          ? "border-destructive/50 bg-destructive/15 text-red-300"
          : "border-primary/35 bg-primary/10",
      )}
    >
      {destructive ? (
        <ExclamationTriangleIcon className="mt-0.5 size-4.5 shrink-0" />
      ) : (
        <EnvelopeClosedIcon className="text-accent-light mt-0.5 size-5 shrink-0" />
      )}
      <div className="flex flex-col gap-1">
        {title ? (
          <p className="text-accent-light font-semibold">{title}</p>
        ) : null}
        <div className={destructive ? undefined : "text-foreground/80"}>
          {children}
        </div>
      </div>
    </div>
  );
}
