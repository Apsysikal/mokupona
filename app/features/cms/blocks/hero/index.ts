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
  getUploadedImageIds(data) {
    const parsed = HeroBlockDataSchema.safeParse(data);
    if (!parsed.success || parsed.data.image.kind !== "uploaded") {
      return [];
    }

    return [parsed.data.image.imageId];
  },
  render(block) {
    return createElement(HeroBlockView, { blockData: block });
  },
  editor(ctx) {
    return createElement(HeroBlockEditor, { ctx });
  },
});
