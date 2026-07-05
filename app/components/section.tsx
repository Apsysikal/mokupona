import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

// small uppercase tracked label above headings ("gatherings", "our vision")
export function Eyebrow({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "text-primary text-xs font-semibold tracking-[.24em] uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}

// "the next dinner" / "past dinners" — label with a hairline rule running out
export function SectionDivider({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex items-center gap-3.5", className)}>
      <span className="text-fg-label text-xs font-semibold tracking-[.24em] uppercase">
        {children}
      </span>
      <span aria-hidden className="bg-foreground/10 h-px flex-1" />
    </div>
  );
}
