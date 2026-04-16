import { renderCmsBlock, type CmsBlock } from "./blocks/registry";

type CmsPublicPageBlocksProps = {
  blocks: readonly CmsBlock[];
};

export function CmsPublicPageBlocks({ blocks }: CmsPublicPageBlocksProps) {
  return blocks.map((block, index) => renderCmsBlock(block, `${block.type}-${index}`));
}
