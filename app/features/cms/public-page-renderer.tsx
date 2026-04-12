import { Fragment } from "react";

import type { CmsCatalog, PublicProjection } from "./catalog";
import { siteCmsCatalog } from "./site-catalog";

type PublicPageRendererProps = {
  projection: PublicProjection;
  catalog?: CmsCatalog;
};

export function PublicPageRenderer({
  projection,
  catalog = siteCmsCatalog,
}: PublicPageRendererProps) {
  return (
    <>
      {projection.blocks.map((block, index) => (
        <Fragment
          key={
            block.definitionKey ??
            `${projection.pageKey}:${block.type}:${index}`
          }
        >
          {catalog.getBlockDefinition(block.type).render(block)}
        </Fragment>
      ))}
    </>
  );
}
