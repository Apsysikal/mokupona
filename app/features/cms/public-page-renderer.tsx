import { Fragment } from "react";

import type { CmsCatalog, PublicProjection } from "./catalog";

type PublicPageRendererProps = {
  catalog: CmsCatalog;
  projection: PublicProjection;
};

export function PublicPageRenderer({
  catalog,
  projection,
}: PublicPageRendererProps) {
  return (
    <main>
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
    </main>
  );
}
