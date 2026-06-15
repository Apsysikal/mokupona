import type { Block, BlockRegistry } from "./types";

import React from "react";
import type z from "zod";
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

type Registry = typeof registry;
type RegistryKey = keyof Registry;
type DataMap = {
  [K in RegistryKey]: z.output<Registry[K]["viewSchema"]>;
};
type PropsMap = {
  [K in RegistryKey]: Omit<
    React.ComponentProps<Registry[K]["viewComponent"]>,
    "data"
  >;
};
type Binders = {
  [K in RegistryKey]: (
    data: DataMap[K],
  ) => (props: PropsMap[K]) => React.ReactElement;
};

const binders: Binders = {
  "text-section": (data) => (props) =>
    React.createElement(registry["text-section"].viewComponent, {
      ...props,
      data,
    }),
  image: (data) => (props) =>
    React.createElement(registry.image.viewComponent, { ...props, data }),
  hero: (data) => (props) =>
    React.createElement(registry.hero.viewComponent, { ...props, data }),
};
