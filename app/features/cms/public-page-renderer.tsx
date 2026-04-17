import { Fragment } from "react";

import type { CmsCatalog } from "./catalog";
import type { PublicPageView } from "./page-service.server";
import { siteCmsCatalog } from "./site-catalog";

type PublicPageRendererProps = {
  view: PublicPageView;
  catalog?: CmsCatalog;
};

export function PublicPageRenderer({
  view,
  catalog = siteCmsCatalog,
}: PublicPageRendererProps) {
  return (
    <>
      {view.blocks.map((block, index) => (
        <Fragment key={block.definitionKey ?? `${block.type}:${index}`}>
          {catalog.getBlockDefinition(block.type).render(block)}
        </Fragment>
      ))}
    </>
  );
}
