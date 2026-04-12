import type { MetaFunction } from "react-router";

import { PublicPageRenderer } from "~/features/cms/public-page-renderer";
import { siteCmsCatalog } from "~/features/cms/site-catalog";
import type { RootLoaderData } from "~/root";

export const meta: MetaFunction<null, { root: RootLoaderData }> = ({
  matches,
  location,
}) => {
  const domainUrl = matches.find(({ id }) => id === "root")?.data.domainUrl;
  const snapshot = siteCmsCatalog.readPageSnapshot("home");
  return siteCmsCatalog.projectPublic(snapshot, {
    domainUrl,
    pathname: location.pathname,
  }).meta;
};

export default function Index() {
  const snapshot = siteCmsCatalog.readPageSnapshot("home");
  const projection = siteCmsCatalog.projectPublic(snapshot, { pathname: "/" });

  return (
    <PublicPageRenderer catalog={siteCmsCatalog} projection={projection} />
  );
}
