import { createElement } from "react";

import { defineBlockDefinition } from "../../catalog";
export * from "./model";
export * from "./view";

import { HeroBlockEditor } from "./editor";
import { HeroBlockDataSchema, type HeroBlockType } from "./model";
import { HeroBlockView } from "./view";

export const heroBlockDefinition = defineBlockDefinition<HeroBlockType>({
  type: "hero",
  version: 1,
  schema: HeroBlockDataSchema,
  render(block) {
    return createElement(HeroBlockView, { blockData: block });
  },
  editor(ctx) {
    return createElement(HeroBlockEditor, { ctx });
  },
});
