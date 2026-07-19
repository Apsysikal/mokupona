import { useRouteLoaderData } from "react-router";

import type { Route as RootRoute } from "../+types/root";

type RootLoaderData = RootRoute.ComponentProps["loaderData"];

/**
 * The logged-in user (with role) from the root loader, or undefined when
 * nobody is logged in or the root loader did not run (e.g. while rendering
 * an error boundary). Typed access by the stable route id "root" — no
 * duck-typing of the loader payload.
 */
export function useOptionalUser():
  NonNullable<RootLoaderData["user"]> | undefined {
  const data = useRouteLoaderData("root") as RootLoaderData | undefined;
  return data?.user ?? undefined;
}
