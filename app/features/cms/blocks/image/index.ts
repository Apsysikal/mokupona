import { createElement } from "react";

import { defineBlockDefinition } from "../../catalog";

import { ImageBlockEditor } from "./editor";
import { ImageBlockDataSchema, type ImageBlockType } from "./model";
import { ImageBlockView } from "./view";

export * from "./model";
export * from "./view";

export const imageBlockDefinition = defineBlockDefinition<ImageBlockType>({
  type: "image",
  version: 1,
  schema: ImageBlockDataSchema,
  getUploadedImageIds(data) {
    const parsed = ImageBlockDataSchema.safeParse(data);
    if (!parsed.success || parsed.data.image.kind !== "uploaded") {
      return [];
    }

    return [parsed.data.image.imageId];
  },
  render(block) {
    return createElement(ImageBlockView, { blockData: block });
  },
  editor(ctx) {
    return createElement(ImageBlockEditor, { ctx });
  },
});
