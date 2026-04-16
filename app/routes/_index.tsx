import { useLoaderData } from "react-router";

import type { Route } from "./+types/_index";

import { PublicPageRenderer } from "~/features/cms/public-page-renderer";
import { siteCmsPageService } from "~/features/cms/site-page-service.server";
import { getDomainUrl } from "~/utils/misc";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const projection = await siteCmsPageService.readPublicProjection("home", {
    domainUrl: getDomainUrl(request),
    pathname: url.pathname,
  });

  return { projection };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) {
    return [];
  }

  return loaderData.projection.meta;
}

export default function Index() {
  const { projection } = useLoaderData<typeof loader>();

  return (
    <main>
      <PublicPageRenderer projection={projection} />
    </main>
  );
}
