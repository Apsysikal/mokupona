import type { LinksFunction } from "react-router";
import {
  data,
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";

import type { Route } from "./+types/root";
import { Footer } from "./components/footer";
import { SiteNav } from "./components/site-nav";
import { Toaster } from "./components/ui/sonner";
import { useToast } from "./hooks/useToast";
import { getNextEvent } from "./models/event.server";
import { getClientHints } from "./utils/client-hints.server";
import { combineHeaders, getDomainUrl } from "./utils/misc";
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

export const loader = async ({ request }: Route.LoaderArgs) => {
  const domainUrl = getDomainUrl(request);
  const [user, nextEvent] = await Promise.all([
    getUserWithRole(request),
    getNextEvent(),
  ]);
  const clientHints = getClientHints(request);
  const { toast, headers } = await getToast(request);
  const allowIndexing = process.env.ALLOW_INDEXING !== "false";
  return data(
    {
      user,
      toast,
      domainUrl,
      clientHints,
      allowIndexing,
      nextDinnerId: nextEvent?.id ?? null,
    },
    { headers: combineHeaders(headers) },
  );
};

export default function App({ loaderData }: Route.ComponentProps) {
  const { allowIndexing } = loaderData;

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
      <body className="dark bg-background text-foreground h-full">
        <Document
          toast={loaderData.toast}
          nextDinnerId={loaderData.nextDinnerId}
        />
        <ScrollRestoration />
        <Scripts />
        <Toaster />
      </body>
    </html>
  );
}

// the auth pages are a full-height split with their own brand panel — they
// deliberately render without the shared nav/footer (design handoff §4)
const BARE_ROUTES = ["/login", "/join"];

function Document({
  toast,
  nextDinnerId,
}: {
  toast: Route.ComponentProps["loaderData"]["toast"];
  nextDinnerId: string | null;
}) {
  const location = useLocation();
  useToast(toast);

  if (BARE_ROUTES.includes(location.pathname)) {
    return <Outlet />;
  }

  const joinHref = nextDinnerId ? `/dinners/${nextDinnerId}` : "/dinners";

  return (
    <div className="flex min-h-full flex-col">
      <SiteNav joinHref={joinHref} />
      <div className="flex grow flex-col">
        <Outlet />
      </div>
      <Footer />
    </div>
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
