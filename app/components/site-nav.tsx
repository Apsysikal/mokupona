import {
  ChevronRightIcon,
  Cross1Icon,
  InstagramLogoIcon,
} from "@radix-ui/react-icons";
import { useEffect, useState } from "react";
import { Form, Link, useLocation } from "react-router";

import { BrandLockup } from "./brand-lockup";
import { Button } from "./ui/button";

import { cn } from "~/lib/utils";
import { useOptionalUser } from "~/utils/misc";

export interface SiteNavProps {
  /** target of the "join a dinner" CTA — the next dinner when one exists */
  joinHref: string;
}

export function SiteNav({ joinHref }: SiteNavProps) {
  const optionalUser = useOptionalUser();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isModerator = ["moderator", "admin"].includes(
    optionalUser?.role.name ?? "",
  );

  // the overlay must never survive a navigation
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const sectionLinkClasses = (active: boolean) =>
    cn(
      "hover:text-foreground pb-0.5",
      active ? "text-foreground border-b border-primary" : "text-fg-secondary",
    );

  return (
    <>
      <nav className="border-foreground/10 border-b">
        {/* desktop */}
        <div className="flex h-18.5 items-center justify-between px-10 max-md:hidden">
          <BrandLockup to="/" />

          <div className="text-fg-secondary flex items-center gap-7.5 text-sm">
            <Link
              to="/dinners"
              className={sectionLinkClasses(
                location.pathname.startsWith("/dinners"),
              )}
            >
              dinners
            </Link>

            <a
              href="https://instagram.com/mokupona"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              <InstagramLogoIcon className="size-[17px]" />
              <span className="sr-only">instagram</span>
            </a>

            {isModerator ? (
              <Link
                prefetch="intent"
                to="/admin"
                className={sectionLinkClasses(
                  location.pathname.startsWith("/admin"),
                )}
              >
                admin area
              </Link>
            ) : null}

            {optionalUser ? (
              <Form action="/logout" method="POST">
                <button className="text-fg-secondary hover:text-foreground">
                  logout
                </button>
              </Form>
            ) : (
              <Link
                to="/login"
                className={sectionLinkClasses(
                  location.pathname.startsWith("/login"),
                )}
              >
                login
              </Link>
            )}

            <Button size="sm" asChild>
              <Link to={joinHref}>join a dinner</Link>
            </Button>
          </div>
        </div>

        {/* mobile */}
        <div className="flex h-[58px] items-center justify-between px-5.5 md:hidden">
          <BrandLockup
            to="/"
            logoClassName="size-[19px]"
            wordmarkClassName="text-[15px]"
          />
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            className="flex flex-col gap-1 py-2"
            onClick={() => setMenuOpen(true)}
          >
            <span className="bg-fg-secondary h-[1.5px] w-5" />
            <span className="bg-fg-secondary h-[1.5px] w-5" />
          </button>
        </div>
      </nav>

      {menuOpen ? (
        <MobileMenu
          joinHref={joinHref}
          isModerator={isModerator}
          loggedIn={Boolean(optionalUser)}
          onClose={() => setMenuOpen(false)}
        />
      ) : null}
    </>
  );
}

function MobileMenu({
  joinHref,
  isModerator,
  loggedIn,
  onClose,
}: {
  joinHref: string;
  isModerator: boolean;
  loggedIn: boolean;
  onClose: () => void;
}) {
  const menuLinkClasses =
    "flex items-center justify-between border-b border-foreground/10 py-4 text-[22px] tracking-[-.01em]";
  const chevron = <ChevronRightIcon className="text-primary size-[17px]" />;

  return (
    <div className="bg-background fixed inset-0 z-50 flex flex-col overflow-hidden md:hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 size-[300px] rounded-full bg-[radial-gradient(circle,rgba(237,130,94,.20),transparent_70%)]"
      />

      <div className="border-foreground/10 relative flex h-[58px] shrink-0 items-center justify-between border-b px-5.5">
        <BrandLockup
          to="/"
          logoClassName="size-[19px]"
          wordmarkClassName="text-[15px]"
        />
        <button
          type="button"
          aria-label="Close menu"
          className="p-2"
          onClick={onClose}
        >
          <Cross1Icon className="size-5.5" />
        </button>
      </div>

      <div className="relative flex flex-1 flex-col overflow-y-auto px-7.5 pt-10 pb-8.5">
        <div className="flex flex-col">
          <Link to="/dinners" className={menuLinkClasses}>
            dinners
            {chevron}
          </Link>

          {isModerator ? (
            <Link to="/admin" className={menuLinkClasses}>
              admin area
              {chevron}
            </Link>
          ) : null}

          {loggedIn ? (
            <Form action="/logout" method="POST">
              <button
                type="submit"
                className={cn(menuLinkClasses, "w-full text-left")}
              >
                logout
                {chevron}
              </button>
            </Form>
          ) : (
            <Link to="/login" className={menuLinkClasses}>
              login
              {chevron}
            </Link>
          )}
        </div>

        <Button
          size="lg"
          className="mt-8 h-13 rounded-[10px] text-base"
          asChild
        >
          <Link to={joinHref}>join a dinner</Link>
        </Button>

        <div className="mt-auto flex flex-col gap-4.5 pt-9">
          <div className="text-fg-secondary flex gap-6.5 text-sm">
            <a
              href="https://instagram.com/mokupona"
              target="_blank"
              rel="noopener noreferrer"
            >
              instagram
            </a>
            <Link to="/privacy">privacy policy</Link>
          </div>
          <span className="text-fg-faint text-xs">
            made with love in zürich
          </span>
        </div>
      </div>
    </div>
  );
}
