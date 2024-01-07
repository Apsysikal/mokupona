import { cssBundleHref } from "@remix-run/css-bundle";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Form,
  Link,
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useSubmit,
} from "@remix-run/react";
import { useRef } from "react";

import { getUserWithRole } from "~/session.server";
import stylesheet from "~/tailwind.css";

import { Footer } from "./components/footer";
import { Button } from "./components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from "./components/ui/dropdown-menu";
import { cn } from "./lib/utils";
import { useOptionalUser, useUser } from "./utils";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
  ...(cssBundleHref ? [{ rel: "stylesheet", href: cssBundleHref }] : []),
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json({ user: await getUserWithRole(request) });
};

export default function App() {
  return (
    <html lang="en" className="h-full scroll-smooth">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="h-full bg-background text-foreground">
        <Document />
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}

function Document() {
  const user = useOptionalUser();
  const location = useLocation();

  const isAdminSection = location.pathname.startsWith("/admin");

  return (
    <>
      <nav
        className={cn(
          "h-14",
          isAdminSection
            ? "bg-destructive text-destructive-foreground"
            : "bg-primary text-primary-foreground",
        )}
      >
        <div className="mx-auto flex h-full max-w-3xl flex-wrap items-center justify-between gap-4 px-2 sm:flex-nowrap md:gap-8">
          <span className="flex items-center gap-2">
            <Link to="/" className="font-bold">
              moku pona
            </Link>
            {isAdminSection ? <Link to="/admin">Admin</Link> : null}
          </span>

          <div className="flex items-center gap-10">
            {user ? (
              <UserDropdown />
            ) : (
              <Button asChild variant="ghost" className="font-normal" size="sm">
                <Link to="/login">Log In</Link>
              </Button>
            )}
          </div>
        </div>
      </nav>
      <Outlet />
      <Footer />
    </>
  );
}

function UserDropdown() {
  const user = useUser();
  const submit = useSubmit();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="" size="sm">
          <span className="text-body-sm">{user.email}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent sideOffset={8} align="start">
          {["moderator", "admin"].includes(user.Role.name) ? (
            <DropdownMenuItem asChild>
              <Link prefetch="intent" to="/admin">
                Admin Area
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            asChild
            // this prevents the menu from closing before the form submission is completed
            onSelect={(event) => {
              event.preventDefault();
              submit(formRef.current);
            }}
          >
            <Form action="/logout" method="POST" ref={formRef}>
              <button type="submit">Logout</button>
            </Form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}
