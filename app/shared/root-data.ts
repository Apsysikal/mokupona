import type { Route as RootRoute } from "../+types/root";

type RootLoaderData = RootRoute.ComponentProps["loaderData"];

/**
 * Resolve the root route's loader data from a meta function's `matches` by
 * the stable route id "root" — the array is positional, so `matches[0]` is
 * not a contract. Returns undefined when the root loader did not run (e.g.
 * while rendering an error), so callers must degrade gracefully.
 */
export function getRootLoaderData(
  matches: readonly ({ id: string; loaderData: unknown } | undefined)[],
): RootLoaderData | undefined {
  const rootMatch = matches.find((match) => match?.id === "root");
  return rootMatch?.loaderData as RootLoaderData | undefined;
}
