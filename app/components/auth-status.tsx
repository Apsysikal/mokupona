import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

// centered single-panel status view shared by check-inbox, verify-email,
// forgot-password confirm, reset states and the invite dead-ends /
// confirmations (design handoff). tone picks the medallion fill: positive
// states get primary/10, dead-ends a neutral foreground/6 — the icon is the
// non-color cue.
export function AuthStatus({
  tone = "positive",
  icon,
  heading,
  children,
}: {
  tone?: "positive" | "neutral";
  icon: ReactNode;
  heading: string;
  /** body copy, CTA button(s) and secondary links */
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-5 text-center">
      <div
        aria-hidden
        className={cn(
          "flex size-16 items-center justify-center rounded-full",
          tone === "positive"
            ? "bg-primary/10 text-primary"
            : "bg-foreground/6 text-foreground/60",
        )}
      >
        {icon}
      </div>
      <h1 className="text-3xl leading-tight font-light tracking-tight">
        {heading}
      </h1>
      {children}
    </div>
  );
}

// the standard body paragraph inside an AuthStatus panel
export function AuthStatusBody({ children }: { children: ReactNode }) {
  return (
    <p className="text-foreground/65 leading-relaxed font-light">{children}</p>
  );
}
