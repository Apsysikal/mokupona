import {
  ChevronRightIcon,
  Cross1Icon,
  InstagramLogoIcon,
} from "@radix-ui/react-icons";
import {
  useEffect,
  useState,
  type ComponentProps,
  type ElementType,
} from "react";
import { Form, Link, useLocation } from "react-router";

import { BrandLockup } from "./brand-lockup";
import { Button } from "./ui/button";

import { ADMIN_ROLE_NAMES } from "~/features/auth/roles";
import { useOptionalUser } from "~/hooks/useOptionalUser";
import { cn } from "~/lib/utils";

export function SiteNav({ joinHref }: { joinHref: string }) {
  const optionalUser = useOptionalUser();
  const loggedIn = Boolean(optionalUser);
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isModerator = (ADMIN_ROLE_NAMES as readonly string[]).includes(
    optionalUser?.role.name ?? "",
  );

  // the overlay must never survive a navigation
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const sectionLinkClasses = (active: boolean) =>
    cn(
      "hover:text-foreground pb-0.5",
      active ? "text-foreground border-b border-primary" : "text-foreground/80",
    );

  return (
    <>
      <nav className="border-border border-b">
        {/* desktop */}
        <div className="flex h-16 items-center justify-between px-10 max-md:hidden">
          <BrandLockup to="/" />

          <div className="text-foreground/80 flex items-center gap-7 text-sm">
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
              <InstagramLogoIcon className="size-5" />
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

            {loggedIn ? (
              <Link
                to="/me"
                className={sectionLinkClasses(location.pathname === "/me")}
              >
                account
              </Link>
            ) : null}

            {loggedIn ? (
              <Form action="/logout" method="POST">
                <button className="text-foreground/80 hover:text-foreground">
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
        <div className="flex h-14 items-center justify-between px-5 md:hidden">
          <BrandLockup to="/" />
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            className="flex flex-col gap-1 py-2"
            onClick={() => setMenuOpen(true)}
          >
            <span className="bg-foreground/80 h-0.5 w-5" />
            <span className="bg-foreground/80 h-0.5 w-5" />
          </button>
        </div>
      </nav>

      {menuOpen ? (
        <MobileMenu
          joinHref={joinHref}
          isModerator={isModerator}
          loggedIn={loggedIn}
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
  onClose: closeMenu,
}: {
  joinHref: string;
  isModerator: boolean;
  loggedIn: boolean;
  onClose: () => void;
}) {
  return (
    <div className="bg-background fixed inset-0 z-50 flex flex-col overflow-hidden md:hidden">
      <div
        aria-hidden
        className="glow-primary-strong pointer-events-none absolute -top-10 -right-10 size-72 rounded-full"
      />

      <div className="border-border relative border-b">
        <div className="flex h-14 items-center justify-between px-5">
          <BrandLockup to="/" />
          <button
            type="button"
            aria-label="Close menu"
            className="p-2"
            onClick={closeMenu}
          >
            <Cross1Icon className="size-5" />
          </button>
        </div>
      </div>

      <div className="relative flex flex-1 flex-col overflow-y-auto px-7 pt-10 pb-8">
        <div className="flex flex-col">
          <MobileMenuLink to="/dinners">dinners</MobileMenuLink>

          {isModerator ? (
            <MobileMenuLink to="/admin">admin area</MobileMenuLink>
          ) : null}

          {loggedIn ? <MobileMenuLink to="/me">account</MobileMenuLink> : null}

          {loggedIn ? (
            <Form action="/logout" method="POST">
              <MobileMenuLink as="button" className="w-full text-left">
                logout
              </MobileMenuLink>
            </Form>
          ) : (
            <MobileMenuLink to="/login">login</MobileMenuLink>
          )}
        </div>

        <Button size="lg" className="mt-8" asChild>
          <Link to={joinHref}>join a dinner</Link>
        </Button>

        <div className="mt-auto flex flex-col gap-4 pt-9">
          <div className="text-foreground/80 flex gap-6 text-sm">
            <a
              href="https://instagram.com/mokupona"
              target="_blank"
              rel="noopener noreferrer"
            >
              instagram
            </a>
            <Link to="/privacy">privacy policy</Link>
          </div>
          <span className="text-foreground/40 text-xs">
            made with love in zürich
          </span>
        </div>
      </div>
    </div>
  );
}

type MobileMenuLinkProps =
  | (ComponentProps<typeof Link> & { as?: never })
  | (Omit<ComponentProps<typeof Link>, "to"> & {
      as: ElementType;
      to?: never;
    });

function MobileMenuLink(props: MobileMenuLinkProps) {
  const { as, className, children, ...rest } = props;
  const Component = as ?? Link;

  return (
    <Component
      className={cn(
        "border-border flex items-center justify-between border-b py-4 text-xl tracking-tight",
        className,
      )}
      {...rest}
    >
      {children}
      <ChevronRightIcon className="text-primary size-5" />
    </Component>
  );
}
