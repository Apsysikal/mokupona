import { MagnifyingGlassIcon } from "@radix-ui/react-icons";

import { cn } from "~/lib/utils";

// Shared building blocks of the admin redesign: page headers, the search +
// filter-chip toolbar, seat progress bars, initials avatars and the dashed
// empty-state panel (design handoff tmp/design_handoff_admin_redesign).

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
        <p className="text-fg-label mb-2 text-xs font-semibold tracking-[.06em] uppercase">
          {eyebrow}
        </p>
        <h1 className="text-[26px] font-extrabold tracking-[-.02em] md:text-[32px]">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-muted-foreground mt-2 text-[15px]">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2.5">{actions}</div>
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
    <div className="border-input bg-foreground/3 flex h-11 items-center gap-2.5 rounded-lg border px-3.5 max-md:w-full md:w-[300px]">
      <MagnifyingGlassIcon className="text-fg-label size-[17px] shrink-0" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="placeholder:text-fg-faint min-w-0 flex-1 bg-transparent text-sm outline-none"
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
      className={cn(
        "h-9 rounded-full border px-3.75 text-[13px] font-semibold whitespace-nowrap transition-colors",
        active
          ? "border-primary/35 bg-primary/12 text-accent-light"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
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
  /** past dinners fill in fg-faint instead of the accent */
  muted?: boolean;
}) {
  const percent =
    total > 0 ? Math.min(100, Math.round((taken / total) * 100)) : 0;

  return (
    <div className="bg-foreground/8 h-[7px] flex-1 overflow-hidden rounded-full">
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-400",
          muted ? "bg-fg-faint" : "bg-primary",
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

// three rotating tints so neighbouring avatars read as distinct
const AVATAR_TINTS = [
  "text-accent-light bg-primary/15",
  "text-fg-secondary bg-foreground/8",
  "text-[#E0A87F] bg-[#E0A87F]/15",
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
    <div className="border-input bg-card flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-15 text-center">
      <div className="bg-primary/12 text-primary mb-1 flex size-14 items-center justify-center rounded-full">
        {icon}
      </div>
      <p className="text-[17px] font-bold">{title}</p>
      <p className="text-fg-label max-w-[320px] text-sm">{description}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
