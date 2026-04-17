import { siteCmsCatalog, type CmsBlock } from "./site-catalog";

type CmsPublicPageBlocksProps = {
  blocks: readonly CmsBlock[];
};

export function CmsPublicPageBlocks({ blocks }: CmsPublicPageBlocksProps) {
  return (
    <>
      {blocks.map((block, index) =>
        siteCmsCatalog.renderBlock(block, `${block.type}-${index}`),
      )}
    </>
  );
}
