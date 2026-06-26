import type { BaseBlock, BlockRegistry } from "./types";

export class BlockRegistryBuilder<R extends BlockRegistry = {}> {
  private constructor(private registry: R) {}

  static create(): BlockRegistryBuilder {
    return new BlockRegistryBuilder({});
  }

  addBlock<const K extends string, B extends BaseBlock>(
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
