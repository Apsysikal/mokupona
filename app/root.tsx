import type { LinksFunction } from "react-router";
import {
  data,
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
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

import { getUserWithRole } from "~/features/auth/guards.server";
import stylesheet from "~/tailwind.css?url";

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
  const cypressSupport = process.env.CYPRESS_SUPPORT === "true";
  return data(
    {
      user,
      toast,
      domainUrl,
      clientHints,
      allowIndexing,
      cypressSupport,
      nextDinnerId: nextEvent?.id ?? null,
    },
    { headers: combineHeaders(headers) },
  );
};

export default function App({ loaderData }: Route.ComponentProps) {
  const { allowIndexing, cypressSupport } = loaderData;

  return (
    <html lang="en" className="h-full scroll-smooth">
      <head>
        {/* Cypress injects its bootstrap into this marker instead of
            prepending nodes to <head>, which would break React hydration
            (cypress-io/cypress#27204). Only rendered when the server runs
            with CYPRESS_SUPPORT=true (the test:e2e:* scripts). */}
        {cypressSupport ? (
          <script data-cy-bootstrap suppressHydrationWarning>
            {"/* placeholder */"}
          </script>
        ) : null}
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

// every surface — auth pages included — renders inside the shared
// nav/footer chrome (design handoff: global chrome rework)
function Document({
  toast,
  nextDinnerId,
}: {
  toast: Route.ComponentProps["loaderData"]["toast"];
  nextDinnerId: string | null;
}) {
  useToast(toast);

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
