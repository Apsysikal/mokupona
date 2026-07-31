import type { LinksFunction } from "react-router";
import {
  data,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import { Footer } from "./components/footer";
import { RouteErrorContent } from "./components/route-error-content";
import { SiteNav } from "./components/site-nav";
import { Toaster } from "./components/ui/sonner";
import { useToast } from "./hooks/useToast";
import { getNextEvent } from "./models/event.server";
import { getDomainUrl } from "./shared/http.server";
import { getToast } from "./utils/toast.server";

import {
  optionalUserContext,
  requestLoggerMiddleware,
  resolveOptionalUserMiddleware,
} from "~/features/auth/middleware.server";
import { getHoneypotInputProps } from "~/features/forms/honeypot.server";
import stylesheet from "~/tailwind.css?url";

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

export const middleware: Route.MiddlewareFunction[] = [
  requestLoggerMiddleware,
  resolveOptionalUserMiddleware,
];

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const domainUrl = getDomainUrl(request);
  const user = await context.get(optionalUserContext)();
  const nextEvent = await getNextEvent();
  const { toast, headers } = await getToast(request);
  const allowIndexing = process.env.ALLOW_INDEXING !== "false";
  const cypressSupport = process.env.CYPRESS_SUPPORT === "true";
  // public image-delivery config (no bulk ENV mechanism — named fields);
  // the cloud name is public by nature, it is in every delivery URL
  const imageProvider: "local" | "cloudinary" =
    process.env.IMAGE_PROVIDER === "cloudinary" ? "cloudinary" : "local";
  return data(
    {
      user,
      toast,
      domainUrl,
      allowIndexing,
      cypressSupport,
      nextDinnerId: nextEvent?.id ?? null,
      imageProvider,
      cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME ?? null,
      honeypot: getHoneypotInputProps(),
    },
    { headers: headers ?? undefined },
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
      <body className="dark h-full">
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
  return <RouteErrorContent error={error} />;
}
