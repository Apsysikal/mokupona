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
  useSubmit,
} from "@remix-run/react";
import { useRef } from "react";

import { getUser } from "~/session.server";
import stylesheet from "~/tailwind.css";

import { Button } from "./components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from "./components/ui/dropdown-menu";
import { useOptionalUser, useUser } from "./utils";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
  ...(cssBundleHref ? [{ rel: "stylesheet", href: cssBundleHref }] : []),
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json({ user: await getUser(request) });
};

function Document() {
  const user = useOptionalUser();

  return (
    <>
      <nav className="h-14 w-full bg-primary">
        <div className="mx-auto flex h-full max-w-3xl flex-wrap items-center justify-between gap-4 px-2 sm:flex-nowrap md:gap-8">
          <Link to="/" className="font-medium text-primary-foreground">
            moku pona
          </Link>

          <div className="flex items-center gap-10">
            {user ? (
              <UserDropdown />
            ) : (
              <Button
                asChild
                variant="ghost"
                className="font-normal text-primary-foreground"
                size="sm"
              >
                <Link to="/login">Log In</Link>
              </Button>
            )}
          </div>
        </div>
      </nav>
      <Outlet />
    </>
  );
}

export default function App() {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="h-full scroll-smooth bg-background text-foreground">
        <Document />
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}

function UserDropdown() {
  const user = useUser();
  const submit = useSubmit();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="text-primary-foreground" size="sm">
          <span className="text-body-sm font-bold">{user.email}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent sideOffset={8} align="start">
          <DropdownMenuItem asChild>
            <Link prefetch="intent" to="/admin">
              Admin Area
            </Link>
          </DropdownMenuItem>
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
