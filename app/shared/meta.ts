import type { MetaDescriptor } from "react-router";

import { getRootLoaderData } from "./root-data";

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
