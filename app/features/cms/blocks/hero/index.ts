import { createElement } from "react";

import { defineBlockDefinition } from "../../catalog";
import { siteLinkTargetRegistry } from "../../site-link-targets";
export * from "./model";
export * from "./view";

import { HeroBlockEditor } from "./editor";
import { createHeroBlockDataSchema, type HeroBlockType } from "./model";
import { HeroBlockView } from "./view";

const SafeHeroBlockDataSchema = createHeroBlockDataSchema(
  siteLinkTargetRegistry,
);

export const heroBlockDefinition = defineBlockDefinition<HeroBlockType>({
  type: "hero",
  version: 1,
  schema: SafeHeroBlockDataSchema,
  render(block) {
    return createElement(HeroBlockView, { blockData: block });
  },
  editor(ctx) {
    return createElement(HeroBlockEditor, { ctx });
  },
});
