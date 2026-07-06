import { MagnifyingGlassIcon } from "@radix-ui/react-icons";

import { chipVariants, Eyebrow } from "./section";

import { cn } from "~/lib/utils";

// Shared building blocks of the admin surface: page headers, the search +
// filter-chip toolbar, seat progress bars, initials avatars and the dashed
// empty-state panel (design system §9).

export function AdminPageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <Eyebrow variant="tracked" tone="label" className="mb-2 block">
          {eyebrow}
        </Eyebrow>
        <h1 className="text-3xl font-light tracking-tight md:text-4xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-muted-foreground mt-2 text-base">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

export function AdminSearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="border-border bg-foreground/5 flex h-11 items-center gap-2 rounded-lg border px-3 max-md:w-full md:w-72">
      <MagnifyingGlassIcon className="text-foreground/50 size-4 shrink-0" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="placeholder:text-foreground/40 min-w-0 flex-1 bg-transparent text-sm outline-none"
      />
    </div>
  );
}

export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={chipVariants({ active })}
    >
      {children}
    </button>
  );
}

// The bar is deliberately capped by its parent (max-w on the wrapping group)
// rather than full-width.
export function SeatProgress({
  taken,
  total,
  muted = false,
}: {
  taken: number;
  total: number;
  /** past dinners fill in a faint tint instead of the accent */
  muted?: boolean;
}) {
  const percent =
    total > 0 ? Math.min(100, Math.round((taken / total) * 100)) : 0;

  return (
    <div className="bg-foreground/10 h-1.5 flex-1 overflow-hidden rounded-full">
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500",
          muted ? "bg-foreground/40" : "bg-primary",
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

// two rotating tints so neighbouring avatars read as distinct (the third,
// tan, tint was dropped in the native-token harmonization — design system §2)
const AVATAR_TINTS = [
  "text-accent-light bg-primary/15",
  "text-foreground/80 bg-foreground/10",
];

export function avatarInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (
    (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")
  ).toUpperCase();
}

export function InitialsAvatar({
  name,
  seed,
  className,
}: {
  name: string;
  /** list index — picks the tint so colors rotate down a list */
  seed: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
        AVATAR_TINTS[seed % AVATAR_TINTS.length],
        className,
      )}
    >
      {avatarInitials(name)}
    </span>
  );
}

export function AdminEmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-border bg-card flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-14 text-center">
      <div className="bg-primary/10 text-primary mb-1 flex size-14 items-center justify-center rounded-full">
        {icon}
      </div>
      <p className="text-lg font-semibold">{title}</p>
      <p className="text-foreground/50 max-w-xs text-sm">{description}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
