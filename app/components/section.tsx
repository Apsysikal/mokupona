import { ChevronLeftIcon } from "@radix-ui/react-icons";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ElementType, ReactNode } from "react";
import { Link } from "react-router";

import { cn } from "~/lib/utils";

export const pageTitleClassName =
  "text-3xl leading-tight font-light tracking-tight md:text-4xl";

export function PageContainer({
  as: Component = "main",
  className,
  children,
  ...rest
}: ComponentProps<"main"> & { as?: ElementType }) {
  return (
    <Component
      className={cn("mx-auto w-full max-w-5xl px-5 md:px-10", className)}
      {...rest}
    >
      {children}
    </Component>
  );
}

export function BackLink({
  to,
  prefetch,
  className,
  children,
}: {
  to: string;
  prefetch?: "intent";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      prefetch={prefetch}
      className={cn(
        "text-foreground/50 hover:text-foreground mb-3 inline-flex items-center gap-2 text-sm transition-colors",
        className,
      )}
    >
      <ChevronLeftIcon className="size-4" />
      {children}
    </Link>
  );
}

export const pillVariants = cva(
  "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold",
  {
    variants: {
      accent: {
        true: "border-primary/35 bg-primary/10 text-accent-light",
        false: "text-foreground/65",
      },
    },
    defaultVariants: {
      accent: false,
    },
  },
);

// One eyebrow, two variants (design system §5). `tracked` is the uppercase,
// letter-spaced kicker above headings; `kicker` is the sentence-case accent
// line. Tones map to the native foreground opacity tiers.
const eyebrowVariants = cva("block font-semibold", {
  variants: {
    variant: {
      tracked: "text-xs uppercase tracking-widest",
      kicker: "text-sm",
    },
    tone: {
      primary: "text-primary",
      light: "text-accent-light",
      label: "text-foreground/50",
      onPrimary: "text-primary-foreground/70",
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
        "border-foreground/40 hover:border-foreground w-fit border-b pb-1 text-base transition-colors",
        className,
      )}
    >
      {children}
    </Link>
  );
}

// One pill-chip recipe shared by the admin filter chips and the section jump
// nav (design system §9). Callers apply it to a <button>, <a> or <Link>.
export const chipVariants = cva("rounded-full border transition-colors", {
  variants: {
    active: {
      true: "border-primary/35 bg-primary/10 text-accent-light font-semibold",
      false: "text-foreground/65 hover:text-foreground",
    },
    size: {
      default:
        "inline-flex items-center px-4 py-2 text-xs font-semibold whitespace-nowrap",
      nav: "block px-3 py-2 text-sm md:rounded-lg",
    },
  },
  compoundVariants: [
    { active: false, size: "default", class: "hover:border-foreground/20" },
    {
      active: false,
      size: "nav",
      class: "md:hover:bg-foreground/5 md:border-transparent",
    },
  ],
  defaultVariants: {
    active: false,
    size: "default",
  },
});

export function Glow({
  strong = false,
  className,
}: {
  strong?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute rounded-full",
        strong ? "glow-primary-strong" : "glow-primary",
        className,
      )}
    />
  );
}

export const segmentGroupClassName =
  "bg-foreground/5 flex rounded-lg border p-1";

export const segmentVariants = cva(
  "flex h-9 flex-1 items-center justify-center rounded-md text-sm font-semibold transition-colors",
  {
    variants: {
      active: {
        true: "bg-primary text-primary-foreground",
        false: "text-foreground/65 hover:text-foreground",
      },
    },
    defaultVariants: {
      active: false,
    },
  },
);
