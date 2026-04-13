import { z } from "zod/v4";

import type { BlockRef } from "../block-ref";

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
      imageAction: z.enum(["keep", "replace", "remove"]).default("keep"),
      imageAccessibility: z.preprocess(
        (value) => (value === "" ? undefined : value),
        z.enum(["decorative", "descriptive"]).optional(),
      ),
      imageAlt: z
        .string()
        .trim()
        .optional()
        .transform((value) => (value ? value : undefined)),
    })
    .superRefine((value, ctx) => {
      if (value.imageAction !== "replace") {
        return;
      }

      if (!value.imageAccessibility) {
        ctx.addIssue({
          code: "custom",
          path: ["imageAccessibility"],
          message: "Image accessibility choice is required",
        });
      }

      if (
        value.imageAccessibility === "descriptive" &&
        (!value.imageAlt || value.imageAlt.length === 0)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["imageAlt"],
          message: "Alt text is required for descriptive images",
        });
      }
    });
}

export function getImageBlockEditorDefaultValue(
  data: ImageBlockType["data"],
): ImageBlockEditorFormShape {
  const imageAccessibility =
    data.image.kind === "uploaded"
      ? data.image.decorative
        ? "decorative"
        : "descriptive"
      : "";
  const imageAlt =
    data.image.kind === "uploaded" && imageAccessibility === "descriptive"
      ? (data.image.alt ?? "")
      : "";

  return {
    variant: data.variant,
    imageAction: "keep",
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
  const currentImage = currentData.image;
  const image =
    value.imageAction === "replace" && options?.uploadedImageId
      ? {
          kind: "uploaded" as const,
          imageId: options.uploadedImageId,
          fallbackAssetSrc:
            currentImage.kind === "asset"
              ? currentImage.src
              : currentImage.fallbackAssetSrc,
          decorative: value.imageAccessibility !== "descriptive",
          alt:
            value.imageAccessibility === "descriptive"
              ? value.imageAlt
              : undefined,
        }
      : value.imageAction === "remove" && currentImage.kind === "uploaded"
        ? {
            kind: "asset" as const,
            src: currentImage.fallbackAssetSrc,
            alt: "",
          }
        : value.imageAction === "keep" &&
            currentImage.kind === "uploaded" &&
            value.imageAccessibility
          ? {
              ...currentImage,
              decorative: value.imageAccessibility !== "descriptive",
              alt:
                value.imageAccessibility === "descriptive"
                  ? value.imageAlt
                  : undefined,
            }
          : currentImage;

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
