import { useRouteLoaderData } from "react-router";

import type { Route as RootRoute } from "../+types/root";

import type { HoneypotInputProps } from "~/features/forms/honeypot";
import type { ImageProviderConfig } from "~/shared/image";

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

function toImageConfig(data: RootLoaderData | undefined): ImageProviderConfig {
  // the local defaults keep error boundaries (no root loader data) rendering
  // valid `/file/:fileId` fallback URLs
  return {
    imageProvider: data?.imageProvider ?? "local",
    cloudinaryCloudName: data?.cloudinaryCloudName ?? null,
  };
}

/** Image-delivery config for `meta` functions, resolved from `matches`. */
export function getImageConfig(
  matches: readonly ({ id: string; loaderData: unknown } | undefined)[],
): ImageProviderConfig {
  return toImageConfig(getRootLoaderData(matches));
}

/** Image-delivery config for components (root loader data by route id). */
export function useImageConfig(): ImageProviderConfig {
  return toImageConfig(
    useRouteLoaderData("root") as RootLoaderData | undefined,
  );
}

/** Honeypot props for components (root loader data by route id). */
export function useHoneypotProps(): HoneypotInputProps | undefined {
  const data = useRouteLoaderData("root") as RootLoaderData | undefined;
  return data?.honeypot;
}
