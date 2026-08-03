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
import { Glow } from "./section";
import { Button } from "./ui/button";

import { ADMIN_ROLE_NAMES } from "~/features/auth/roles";
import { useOptionalUser } from "~/hooks/useOptionalUser";
import { cn } from "~/lib/utils";

const INSTAGRAM_URL = "https://instagram.com/mokupona";

type NavItem =
  | {
      kind: "link";
      label: string;
      to: string;
      isActive: (pathname: string) => boolean;
      prefetch?: "intent";
    }
  | { kind: "instagram" }
  | { kind: "logout" };

/**
 * One authenticated item list drives both layouts; desktop and mobile keep
 * their own markup and may place items elsewhere (mobile renders instagram
 * in its footer instead of the link list).
 */
function buildNavItems({
  loggedIn,
  isModerator,
}: {
  loggedIn: boolean;
  isModerator: boolean;
}): NavItem[] {
  const items: NavItem[] = [
    {
      kind: "link",
      label: "dinners",
      to: "/dinners",
      isActive: (pathname) => pathname.startsWith("/dinners"),
    },
    {
      kind: "link",
      label: "gallery",
      to: "/gallery",
      isActive: (pathname) => pathname.startsWith("/gallery"),
    },
    { kind: "instagram" },
  ];

  if (isModerator) {
    items.push({
      kind: "link",
      label: "admin area",
      to: "/admin",
      prefetch: "intent",
      isActive: (pathname) => pathname.startsWith("/admin"),
    });
  }

  if (loggedIn) {
    items.push(
      {
        kind: "link",
        label: "account",
        to: "/me",
        isActive: (pathname) => pathname === "/me",
      },
      { kind: "logout" },
    );
  } else {
    items.push({
      kind: "link",
      label: "login",
      to: "/login",
      isActive: (pathname) => pathname.startsWith("/login"),
    });
  }

  return items;
}

export function SiteNav({ joinHref }: { joinHref: string }) {
  const optionalUser = useOptionalUser();
  const loggedIn = Boolean(optionalUser);
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isModerator = (ADMIN_ROLE_NAMES as readonly string[]).includes(
    optionalUser?.role.name ?? "",
  );

  const navItems = buildNavItems({ loggedIn, isModerator });

  // the overlay must never survive a navigation
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const sectionLinkClasses = (active: boolean) =>
    cn(
      "hover:text-foreground pb-1",
      active && "text-foreground border-b border-primary",
    );

  return (
    <>
      <nav className="border-b">
        {/* desktop */}
        <div className="flex h-16 items-center justify-between px-10 max-md:hidden">
          <BrandLockup to="/" />

          <div className="text-foreground/80 flex items-center gap-7 text-sm">
            {navItems.map((item) => {
              switch (item.kind) {
                case "link":
                  return (
                    <Link
                      key={item.label}
                      to={item.to}
                      prefetch={item.prefetch}
                      className={sectionLinkClasses(
                        item.isActive(location.pathname),
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                case "instagram":
                  return (
                    <a
                      key="instagram"
                      href={INSTAGRAM_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-foreground"
                    >
                      <InstagramLogoIcon className="size-5" />
                      <span className="sr-only">instagram</span>
                    </a>
                  );
                case "logout":
                  return (
                    <Form key="logout" action="/logout" method="POST">
                      <button className={sectionLinkClasses(false)}>
                        logout
                      </button>
                    </Form>
                  );
              }
            })}

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
          navItems={navItems}
          onClose={() => setMenuOpen(false)}
        />
      ) : null}
    </>
  );
}

function MobileMenu({
  joinHref,
  navItems,
  onClose: closeMenu,
}: {
  joinHref: string;
  navItems: NavItem[];
  onClose: () => void;
}) {
  return (
    <div className="bg-background fixed inset-0 z-50 flex flex-col overflow-hidden md:hidden">
      <Glow strong className="-top-10 -right-10 size-72" />

      <div className="relative border-b">
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

      <div className="relative flex flex-1 flex-col overflow-y-auto px-5 pt-10 pb-8">
        <div className="flex flex-col">
          {navItems.map((item) => {
            switch (item.kind) {
              case "link":
                return (
                  <MobileMenuLink key={item.label} to={item.to}>
                    {item.label}
                  </MobileMenuLink>
                );
              case "instagram":
                // rendered in the footer below instead
                return null;
              case "logout":
                return (
                  <Form key="logout" action="/logout" method="POST">
                    <MobileMenuLink as="button" className="w-full text-left">
                      logout
                    </MobileMenuLink>
                  </Form>
                );
            }
          })}
        </div>

        <Button size="lg" className="mt-8" asChild>
          <Link to={joinHref}>join a dinner</Link>
        </Button>

        <div className="mt-auto flex flex-col gap-4 pt-9">
          <div className="text-foreground/80 flex gap-6 text-sm">
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
              instagram
            </a>
            <Link to="/privacy">privacy policy</Link>
          </div>
          <span className="text-foreground/50 text-xs">
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
        "flex items-center justify-between border-b py-4 text-xl tracking-tight",
        className,
      )}
      {...rest}
    >
      {children}
      <ChevronRightIcon className="text-primary size-5" />
    </Component>
  );
}
