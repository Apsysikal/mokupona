import { HamburgerMenuIcon, InstagramLogoIcon } from "@radix-ui/react-icons";
import { useRef } from "react";
import type { LinksFunction, LoaderFunctionArgs } from "react-router";
import {
  data,
  Form,
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useSubmit,
} from "react-router";

import type { Route } from "./+types/root";
import { Footer } from "./components/footer";
import { Logo } from "./components/logo";
import { Button } from "./components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from "./components/ui/dropdown-menu";
import { Toaster } from "./components/ui/sonner";
import { useToast } from "./hooks/useToast";
import { getClientHints } from "./utils/client-hints.server";
import { combineHeaders, getDomainUrl, useOptionalUser } from "./utils/misc";
import { getToast } from "./utils/toast.server";

import stylesheet from "~/tailwind.css?url";
import { getUserWithRole } from "~/utils/session.server";

export type RootLoaderData = typeof loader;

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
  { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
  {
    rel: "icon",
    type: "image/png",
    sizes: "32x32",
    href: "/favicon-32x32.png",
  },
  {
    rel: "icon",
    type: "image/png",
    sizes: "16x16",
    href: "/favicon-16x16.png",
  },
  { rel: "manifest", href: "/site.webmanifest" },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const domainUrl = getDomainUrl(request);
  const user = await getUserWithRole(request);
  const clientHints = getClientHints(request);
  const { toast, headers } = await getToast(request);
  const allowIndexing = process.env.ALLOW_INDEXING !== "false";
  return data(
    { user, toast, domainUrl, clientHints, allowIndexing },
    { headers: combineHeaders(headers) },
  );
};

export default function App() {
  const { allowIndexing } = useLoaderData<typeof loader>();

  return (
    <html lang="en" className="h-full scroll-smooth">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        {allowIndexing ? null : (
          <meta name="robots" content="noindex, nofollow" />
        )}
        <Meta />
        <Links />
      </head>
      <body className="dark h-full bg-gray-950 text-gray-50">
        <Document />
        <ScrollRestoration />
        <Scripts />
        <Toaster />
      </body>
    </html>
  );
}

function Document() {
  const optionalUser = useOptionalUser();
  const { toast } = useLoaderData<typeof loader>();
  useToast(toast);

  return (
    <>
      <nav className="h-20 border-b border-gray-50 bg-gray-950 text-gray-50">
        <div className="mx-auto flex h-full max-w-4xl flex-wrap items-center justify-between gap-4 px-2 sm:flex-nowrap md:gap-8">
          <Link to="/" className="flex items-center gap-6 font-bold">
            <Logo className="size-6" />
            moku pona
          </Link>

          <div className="flex items-center gap-10 max-md:gap-5">
            <Link to="/dinners" className="hover:underline max-md:hidden">
              upcoming dinners
            </Link>

            <Link to="/about" className="hover:underline max-md:hidden">
              about
            </Link>

            <a
              href="https://instagram.com/mokupona"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:underline max-md:hidden"
            >
              <InstagramLogoIcon className="size-6" />
            </a>

            {["moderator", "admin"].includes(optionalUser?.role.name ?? "") ? (
              <Link
                prefetch="intent"
                to="/admin"
                className="hover:underline max-md:hidden"
              >
                admin area
              </Link>
            ) : null}

            {optionalUser ? (
              <Form action="/logout" method="POST" className="max-md:hidden">
                <button className="hover:underline">logout</button>
              </Form>
            ) : (
              <Link to="/login" className="hover:underline max-md:hidden">
                login
              </Link>
            )}

            <span className="flex items-center gap-4 md:hidden">
              <a
                href="https://instagram.com/mokupona"
                target="_blank"
                rel="noopener noreferrer"
              >
                <InstagramLogoIcon className="size-6" />
                <span className="sr-only">instagram</span>
              </a>
              <GeneralDropdown />
            </span>
          </div>
        </div>
      </nav>
      <Outlet />
      <Footer />
    </>
  );
}

function GeneralDropdown() {
  const optionalUser = useOptionalUser();
  const submit = useSubmit();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" aria-label="Menu Button">
          <HamburgerMenuIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent sideOffset={8} align="start">
          <DropdownMenuItem>
            <Link to="/dinners" className="hover:underline">
              upcoming dinners
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem>
            <Link to="/about" className="hover:underline">
              about
            </Link>
          </DropdownMenuItem>

          {["moderator", "admin"].includes(optionalUser?.role.name ?? "") ? (
            <DropdownMenuItem asChild>
              <Link prefetch="intent" to="/admin">
                admin area
              </Link>
            </DropdownMenuItem>
          ) : null}

          {optionalUser ? (
            <DropdownMenuItem
              asChild
              // this prevents the menu from closing before the form submission is completed
              onSelect={(event) => {
                event.preventDefault();
                submit(formRef.current);
              }}
            >
              <Form action="/logout" method="POST" ref={formRef}>
                <button type="submit">logout</button>
              </Form>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem asChild>
              <Link prefetch="intent" to="/login">
                login
              </Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error)) {
    return (
      <div className="mx-auto mt-16 flex flex-col items-center gap-2 pt-4">
        <h1 className="font-semibold">
          {error.status} {error.statusText}
        </h1>
        <p>{error.data}</p>
      </div>
    );
  } else if (error instanceof Error) {
    return (
      <div className="mx-auto mt-16 flex flex-col items-center gap-2 pt-4">
        <h1 className="font-semibold">Error</h1>
        <p>{error.message}</p>
      </div>
    );
  } else {
    return (
      <div className="mx-auto mt-16 flex flex-col items-center gap-2 pt-4">
        <h1 className="font-semibold">Unknown Error</h1>
      </div>
    );
  }
}
