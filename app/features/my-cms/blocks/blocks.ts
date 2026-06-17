import { heroSectionBlock } from "./hero";
import { imageSectionBlock } from "./image";
import { textSectionBlock } from "./text-section";
import type { Block, BlockRegistry } from "./types";

class BlockRegistryBuilder<R extends BlockRegistry = {}> {
  private constructor(private registry: R) {}

  static create(): BlockRegistryBuilder {
    return new BlockRegistryBuilder({});
  }

  // `Block<any, ...>` collapses the component fields to `ComponentType<any>`, so a
  // block with a *specific* `data`/`fields` type satisfies the bound (the loose `Block`
  // would reject it — `ComponentType` is contravariant in props). `B` still infers as
  // the precise block type, so the built registry keeps exact per-kind schemas.
  addBlock<const K extends string, B extends Block<any, any, any, any>>(
    kind: K,
    block: B,
  ): BlockRegistryBuilder<R & Record<K, B>> {
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
