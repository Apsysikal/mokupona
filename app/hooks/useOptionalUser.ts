import { useRouteLoaderData } from "react-router";

import type { Route as RootRoute } from "../+types/root";

type RootLoaderData = RootRoute.ComponentProps["loaderData"];

export function useOptionalUser():
  NonNullable<RootLoaderData["user"]> | undefined {
  const data = useRouteLoaderData("root") as RootLoaderData | undefined;
  return data?.user ?? undefined;
}
