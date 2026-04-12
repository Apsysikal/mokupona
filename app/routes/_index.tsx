import { useLoaderData } from "react-router";

import type { Route } from "./+types/_index";

import { PublicPageRenderer } from "~/features/cms/public-page-renderer";
import { siteCmsCatalog } from "~/features/cms/site-catalog";
import { siteCmsPageService } from "~/features/cms/site-page-service.server";
import { getDomainUrl } from "~/utils/misc";

export async function loader({ request }: Route.LoaderArgs) {
  const page = await siteCmsPageService.readPage("home");
  const url = new URL(request.url);
  const projection = siteCmsCatalog.projectPublic(page.pageSnapshot, {
    domainUrl: getDomainUrl(request),
    pathname: url.pathname,
  });

  return { projection };
}

export function meta({ data }: Route.MetaArgs) {
  if (!data) {
    return [];
  }

  return data.projection.meta;
}

export default function Index() {
  const { projection } = useLoaderData<typeof loader>();

  return (
    <PublicPageRenderer catalog={siteCmsCatalog} projection={projection} />
  );
}
