import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { cn } from "~/lib/utils";

// One eyebrow, two variants (design system §5). `tracked` is the uppercase,
// letter-spaced kicker above headings; `kicker` is the sentence-case accent
// line. Tones map to the native foreground opacity tiers.
const eyebrowVariants = cva("font-semibold", {
  variants: {
    variant: {
      tracked: "text-xs uppercase tracking-widest",
      kicker: "text-sm",
    },
    tone: {
      primary: "text-primary",
      light: "text-accent-light",
      label: "text-foreground/50",
      faint: "text-foreground/40",
    },
  },
  defaultVariants: {
    variant: "tracked",
    tone: "primary",
  },
});

export function Eyebrow({
  variant,
  tone,
  className,
  children,
}: VariantProps<typeof eyebrowVariants> & {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={cn(eyebrowVariants({ variant, tone }), className)}>
      {children}
    </span>
  );
}

// "the next dinner" / "past dinners" — a tracked label with a hairline rule
// running out to the edge.
export function SectionDivider({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Eyebrow variant="tracked" tone="label">
        {children}
      </Eyebrow>
      <span aria-hidden className="bg-border h-px flex-1" />
    </div>
  );
}

// The quiet underlined text link paired with a primary CTA (hero + dinner
// card). One source, always with a color transition (design system §9).
export function SecondaryCTA({
  to,
  className,
  children,
}: {
  to: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "border-foreground/35 hover:border-foreground w-fit border-b pb-0.5 text-base transition-colors",
        className,
      )}
    >
      {children}
    </Link>
  );
}

// One pill-chip recipe shared by the admin filter chips and the section jump
// nav (design system §9). Callers apply it to a <button>, <a> or <Link>.
export const chipVariants = cva(
  "inline-flex items-center rounded-full border px-4 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors",
  {
    variants: {
      active: {
        true: "border-primary/35 bg-primary/10 text-accent-light",
        false:
          "border-border text-foreground/65 hover:border-foreground/20 hover:text-foreground",
      },
    },
    defaultVariants: {
      active: false,
    },
  },
);
