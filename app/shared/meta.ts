import type { MetaDescriptor } from "react-router";

import { getRootLoaderData } from "./root-data";

/**
 * Append absolute `og:image`/`og:url` tags built against the root loader's
 * `domainUrl`. Client-safe. Returns `tags` unchanged when the root loader
 * did not run (e.g. while rendering an error) — absolute URLs cannot be
 * built then, so callers keep their relative-safe tags. `imagePath` is
 * optional because an event's cover can be absent; there is no og:image then.
 */
export function withOpenGraphUrls(
  tags: MetaDescriptor[],
  {
    matches,
    imagePath,
    pagePath,
  }: {
    matches: readonly ({ id: string; loaderData: unknown } | undefined)[];
    imagePath?: string;
    pagePath: string;
  },
): MetaDescriptor[] {
  const domainUrl = getRootLoaderData(matches)?.domainUrl;
  if (!domainUrl) return tags;

  return [
    ...tags,
    ...(imagePath
      ? [{ property: "og:image", content: new URL(imagePath, domainUrl).href }]
      : []),
    { property: "og:url", content: new URL(pagePath, domainUrl).href },
  ];
}
