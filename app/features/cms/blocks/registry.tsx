import type { ReactElement } from "react";

import type { HeroBlockType } from "./hero/model";
import { HeroBlockView } from "./hero/view";
import type { ImageBlockType } from "./image/model";
import { ImageBlockView } from "./image/view";
import type { TextSectionBlockType } from "./text-section/model";
import { TextSectionBlockView } from "./text-section/view";

export type CmsBlock = HeroBlockType | TextSectionBlockType | ImageBlockType;

export function renderCmsBlock(block: CmsBlock, key: string): ReactElement {
  switch (block.type) {
    case "hero":
      return <HeroBlockView key={key} blockData={block} />;
    case "text-section":
      return <TextSectionBlockView key={key} blockData={block} />;
    case "image":
      return <ImageBlockView key={key} blockData={block} />;
  }
}
