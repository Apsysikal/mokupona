import { InstagramLogoIcon } from "@radix-ui/react-icons";
import type {
  LinksFunction,
  LoaderFunctionArgs,
  SerializeFrom,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Form,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useSubmit,
} from "@remix-run/react";
import { useRef } from "react";

import stylesheet from "~/tailwind.css?url";
import { getUserWithRole } from "~/utils/session.server";

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
import {
  combineHeaders,
  getDomainUrl,
  useOptionalUser,
  useUser,
} from "./utils/misc";
import { getToast } from "./utils/toast.server";

export type RootLoaderData = SerializeFrom<typeof loader>;

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
  const { toast, headers } = await getToast(request);
  return json({ user, toast, domainUrl }, { headers: combineHeaders(headers) });
};

export default function App() {
  return (
    <html lang="en" className="h-full scroll-smooth">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="h-full bg-gray-950 text-gray-50">
        <Document />
        <ScrollRestoration />
        <Scripts />
        <Toaster />
      </body>
    </html>
  );
}

function Document() {
  const { toast } = useLoaderData<typeof loader>();
  const user = useOptionalUser();
  useToast(toast);

  return (
    <>
      <nav className="h-16 border-b-2 border-gray-50 bg-gray-950 text-gray-50">
        <div className="mx-auto flex h-full max-w-4xl flex-wrap items-center justify-between gap-4 px-2 sm:flex-nowrap md:gap-8">
          <span className="flex items-center gap-6">
            <Logo className="h-6 w-6" />
            <Link to="/" className="font-bold">
              moku pona
            </Link>
          </span>

          <div className="flex items-center gap-10">
            <Link to="/dinners" className="hover:underline">
              upcoming dinners
            </Link>
            <Link to="/dinners" className="hover:underline">
              about
            </Link>
            <a
              href="https://instagram.com/mokupona"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:underline"
            >
              <InstagramLogoIcon />
              Instagram
            </a>
            {user ? (
              <UserDropdown />
            ) : (
              <Button asChild variant="ghost" className="font-normal">
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
        <Button variant="ghost">
          <span className="text-body-sm">{user.email}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent sideOffset={8} align="start">
          {["moderator", "admin"].includes(user.role.name) ? (
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
