import type { Block, BlockRegistry } from "./types";

import { heroSectionBlock } from "./hero";
import { imageSectionBlock } from "./image";
import { textSectionBlock } from "./text-section";

class BlockRegistryBuilder<R extends BlockRegistry = {}> {
  private constructor(private registry: R) {}

  static create(): BlockRegistryBuilder {
    return new BlockRegistryBuilder({});
  }

  addBlock<
    K extends string,
    VS extends Block["viewSchema"],
    VP extends object,
    ES extends Block["editorSchema"],
    EP extends object,
  >(
    kind: K,
    block: Block<VS, VP, ES, EP>,
  ): BlockRegistryBuilder<R & Record<K, Block<VS, VP, ES, EP>>> {
    return new BlockRegistryBuilder({
      ...this.registry,
      [kind]: block,
    });
  }

  build(): R {
    return this.registry;
  }
}

export const registry = BlockRegistryBuilder.create()
  .addBlock("text-section", textSectionBlock)
  .addBlock("image", imageSectionBlock)
  .addBlock("hero", heroSectionBlock)
  .build();
