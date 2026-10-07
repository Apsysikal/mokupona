import { redirect } from "react-router";

/** Keep bookmarked links and cached forms working after the events rename. */
export function redirectLegacyEventRequest({ request }: { request: Request }) {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(
    /^(\/admin)?\/dinners(?=\/|$)/,
    "$1/events",
  );
  return redirect(`${pathname}${url.search}`, 308);
}
