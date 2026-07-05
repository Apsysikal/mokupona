import type { ReactNode } from "react";
import { Link } from "react-router";

import { BrandLockup } from "./brand-lockup";

import { cn } from "~/lib/utils";

// soft accent glow anchored to a corner — never behind text (design §4)
function CornerGlow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute rounded-full bg-[radial-gradient(circle,rgba(237,130,94,.16),transparent_70%)]",
        className,
      )}
    />
  );
}

export interface AuthShellProps {
  mode: "login" | "join";
  /** preserved on the toggle links (e.g. redirectTo) */
  search?: string;
  children: ReactNode;
}

// full-height split for the auth pages: solid warm brand panel on the left,
// the form column with the log in / sign up toggle on the right. Rendered
// without the shared nav/footer.
export function AuthShell({ mode, search, children }: AuthShellProps) {
  return (
    <div className="flex min-h-full flex-col md:flex-row">
      {/* desktop brand panel — a solid fill, imagery is deliberately not
          allowed behind this copy */}
      <div className="bg-card border-foreground/8 relative hidden flex-col justify-between overflow-hidden border-r p-12 md:flex md:w-[46%]">
        <CornerGlow className="-top-30 -right-[90px] size-[340px]" />
        <BrandLockup to="/" className="relative" />
        <div className="relative flex flex-col gap-4">
          <span className="text-accent-light text-[13px] font-semibold">
            members
          </span>
          <h2 className="text-[38px] leading-[1.12] font-light">
            welcome back to the table
          </h2>
          <p className="text-fg-secondary max-w-[340px] leading-relaxed font-light">
            sign in to manage your reservations, or create an account to start
            joining our dinners.
          </p>
        </div>
        <span className="text-fg-faint relative text-xs">
          made with love in zürich
        </span>
      </div>

      {/* mobile brand header */}
      <div className="bg-card border-foreground/8 relative flex flex-col gap-4.5 overflow-hidden border-b px-6 pt-6.5 pb-7 md:hidden">
        <CornerGlow className="-top-[90px] -right-15 size-55" />
        <BrandLockup
          to="/"
          className="relative"
          logoClassName="size-[19px]"
          wordmarkClassName="text-[15px]"
        />
        <div className="relative flex flex-col gap-2">
          <span className="text-accent-light text-xs font-semibold">
            members
          </span>
          <h1 className="text-[28px] leading-[1.12] font-light">
            welcome back to the table
          </h1>
        </div>
      </div>

      <div className="flex flex-col px-6 py-6.5 md:w-[54%] md:justify-center md:px-18 md:py-16">
        <div className="mx-auto flex w-full max-w-[400px] flex-col gap-4.5 md:gap-5.5">
          <ModeToggle mode={mode} search={search} />
          {children}
        </div>
      </div>
    </div>
  );
}

function ModeToggle({ mode, search }: Pick<AuthShellProps, "mode" | "search">) {
  const segmentClasses = (active: boolean) =>
    cn(
      "flex h-9.5 flex-1 items-center justify-center rounded-[7px] text-sm",
      active
        ? "bg-primary text-primary-foreground font-semibold"
        : "text-fg-muted font-medium hover:text-foreground",
    );

  return (
    <div className="bg-card border-foreground/12 flex rounded-[10px] border p-1">
      <Link
        to={{ pathname: "/login", search }}
        className={segmentClasses(mode === "login")}
        aria-current={mode === "login" ? "page" : undefined}
      >
        log in
      </Link>
      <Link
        to={{ pathname: "/join", search }}
        className={segmentClasses(mode === "join")}
        aria-current={mode === "join" ? "page" : undefined}
      >
        sign up
      </Link>
    </div>
  );
}
