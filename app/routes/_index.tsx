import type { MetaFunction } from "react-router";

import { PublicPageRenderer } from "~/features/cms/public-page-renderer";
import { siteCmsCatalog } from "~/features/cms/site-catalog";
import type { RootLoaderData } from "~/root";

export const meta: MetaFunction<null, { root: RootLoaderData }> = ({
  matches,
  location,
}) => {
  const domainUrl = matches.find(({ id }) => id === "root")?.data.domainUrl;
  return siteCmsCatalog.projectPublic("home", {
    domainUrl,
    pathname: location.pathname,
  }).meta;
};

export default function Index() {
  const projection = siteCmsCatalog.projectPublic("home", { pathname: "/" });

  return (
    <PublicPageRenderer catalog={siteCmsCatalog} projection={projection} />
  );
}
