import { createElement } from "react";

import { defineBlockDefinition } from "../../catalog";
export * from "./model";
export * from "./view";

import { TextSectionBlockDataSchema, type TextSectionBlockType } from "./model";
import { TextSectionBlockView } from "./view";

export const textSectionBlockDefinition =
  defineBlockDefinition<TextSectionBlockType>({
    type: "text-section",
    version: 1,
    schema: TextSectionBlockDataSchema,
    render(block) {
      return createElement(TextSectionBlockView, { blockData: block });
    },
  });
