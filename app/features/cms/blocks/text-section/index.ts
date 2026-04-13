import { createElement } from "react";

import { defineBlockDefinition } from "../../catalog";

import { TextSectionBlockEditor } from "./editor";
import { TextSectionBlockDataSchema, type TextSectionBlockType } from "./model";
import { TextSectionBlockView } from "./view";

export * from "./model";
export * from "./view";

export const textSectionBlockDefinition =
  defineBlockDefinition<TextSectionBlockType>({
    type: "text-section",
    version: 1,
    schema: TextSectionBlockDataSchema,
    render(block) {
      return createElement(TextSectionBlockView, { blockData: block });
    },
    editor(ctx) {
      return createElement(TextSectionBlockEditor, { ctx });
    },
  });
