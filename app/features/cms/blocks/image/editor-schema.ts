import { z } from "zod/v4";

import type { BlockRef } from "../block-ref";
import {
  applyImageSlot,
  hydrateImageSlot,
  imageSlotSchema,
  refineImageSlot,
} from "../image-action";

import type { ImageBlockType } from "./model";

export type ImageBlockEditorFormShape = {
  variant: "default" | "full-width";
  imageAction: "keep" | "replace" | "remove";
  imageAccessibility: "" | "decorative" | "descriptive";
  imageAlt: string;
};

export type ImageBlockEditorFormValue = {
  variant: "default" | "full-width";
  imageAction: "keep" | "replace" | "remove";
  imageAccessibility?: "decorative" | "descriptive";
  imageAlt?: string;
};

export function createImageBlockEditorFormSchema() {
  return z
    .object({
      variant: z.enum(["default", "full-width"]),
      ...imageSlotSchema().shape,
    })
    .superRefine((value, ctx) => {
      refineImageSlot(ctx, value);
    });
}

export function getImageBlockEditorDefaultValue(
  data: ImageBlockType["data"],
): ImageBlockEditorFormShape {
  const { imageAction, imageAccessibility, imageAlt } = hydrateImageSlot(
    data.image,
  );

  return {
    variant: data.variant,
    imageAction,
    imageAccessibility,
    imageAlt,
  };
}

export function applyImageBlockEditorValue(
  currentData: ImageBlockType["data"],
  value: ImageBlockEditorFormValue,
  options?: {
    uploadedImageId?: string;
  },
): ImageBlockType["data"] {
  const rawImage = applyImageSlot(currentData.image, value, options ?? {});
  // Image block assets always carry an explicit alt (empty string when decorative/unset)
  const image =
    rawImage.kind === "asset"
      ? { ...rawImage, alt: rawImage.alt ?? "" }
      : rawImage;

  return {
    ...currentData,
    image,
    variant: value.variant,
  };
}

export function getImageBlockEditorFormId(blockRef: BlockRef): string {
  switch (blockRef.kind) {
    case "definition-key":
      return `image-block-editor-${blockRef.definitionKey}`;
    case "page-block-id":
      return `image-block-editor-${blockRef.pageBlockId}`;
  }
}
