import type { ReactNode } from "react";
import { Link } from "react-router";

import { Eyebrow } from "./section";

import { cn } from "~/lib/utils";

function CornerGlow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "glow-primary pointer-events-none absolute rounded-full",
        className,
      )}
    />
  );
}

interface AuthShellBrandCopy {
  eyebrow: string;
  heading: ReactNode;
  /** desktop-only supporting line under the heading */
  body?: ReactNode;
}

// the login/join default; status surfaces pass their own (design handoff §3–7)
const DEFAULT_BRAND: AuthShellBrandCopy = {
  eyebrow: "members",
  heading: "welcome back to the table",
  body: "sign in to manage your reservations, or create an account to start joining our dinners.",
};

interface AuthShellProps {
  /** omit to hide the login/sign-up toggle (status + reset surfaces) */
  mode?: "login" | "join";
  /** preserved on the toggle links (e.g. redirectTo) */
  search?: string;
  brand?: AuthShellBrandCopy;
  children: ReactNode;
}

export function AuthShell({
  mode,
  search,
  brand = DEFAULT_BRAND,
  children,
}: AuthShellProps) {
  return (
    <div className="flex grow flex-col md:flex-row">
      <div className="bg-card relative hidden flex-col justify-center overflow-hidden border-r p-12 md:flex md:w-1/2">
        <CornerGlow className="-top-30 -right-24 size-80" />
        <div className="relative flex flex-col gap-4">
          <Eyebrow variant="kicker" tone="light">
            {brand.eyebrow}
          </Eyebrow>
          <h2 className="text-4xl leading-tight font-light tracking-tight">
            {brand.heading}
          </h2>
          {brand.body ? (
            <p className="text-foreground/80 max-w-10/12 leading-relaxed font-light">
              {brand.body}
            </p>
          ) : null}
        </div>
      </div>

      {/* mobile brand header */}
      <div className="bg-card relative flex flex-col overflow-hidden border-b px-6 pt-6 pb-7 md:hidden">
        <CornerGlow className="-top-24 -right-16 size-56" />
        <div className="relative flex flex-col gap-2">
          <span className="text-accent-light text-xs font-semibold">
            {brand.eyebrow}
          </span>
          <h1 className="text-3xl leading-tight font-light tracking-tight">
            {brand.heading}
          </h1>
        </div>
      </div>

      <div className="flex flex-col px-6 py-6 md:w-1/2 md:justify-center md:px-18 md:py-16">
        <div className="mx-auto flex w-full max-w-md flex-col gap-4 md:gap-5">
          {mode ? <ModeToggle mode={mode} search={search} /> : null}
          {children}
        </div>
      </div>
    </div>
  );
}

function ModeToggle({ mode, search }: Pick<AuthShellProps, "mode" | "search">) {
  const segmentClasses = (active: boolean) =>
    cn(
      "flex h-9 flex-1 items-center justify-center rounded-md text-sm transition-colors",
      active
        ? "bg-primary text-primary-foreground font-semibold"
        : "text-foreground/65 font-medium hover:text-foreground",
    );

  return (
    <div className="bg-card flex rounded-lg border p-1">
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
