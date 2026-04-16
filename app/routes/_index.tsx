import type { MetaFunction } from "react-router";

import { getHomePageMeta, homePageBlocks } from "~/features/cms/pages/home";
import { CmsPublicPageBlocks } from "~/features/cms/public-page";
import type { RootLoaderData } from "~/root";

export const meta: MetaFunction<null, { root: RootLoaderData }> = ({
  matches,
  location,
}) => {
  const domainUrl = matches.find(({ id }) => id === "root")?.data.domainUrl;
  return getHomePageMeta({ domainUrl, pathname: location.pathname });
};

export default function Index() {
  return (
    <main>
      <CmsPublicPageBlocks blocks={homePageBlocks} />
    </main>
  );
}
