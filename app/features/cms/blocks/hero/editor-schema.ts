import { z } from "zod/v4";

import type { BlockRef } from "../block-ref";

import { createHeroActionSchema, type HeroBlockType } from "./model";

import type { LinkTargetRegistry } from "~/features/cms/link-targets";

export type HeroBlockEditorFormShape = {
  eyebrow: string;
  headline: string;
  description: string;
  actions: [{ label: string; href: string }];
  imageAction: "keep" | "replace" | "remove";
  imageAccessibility: "decorative" | "descriptive";
  imageAlt: string;
};

export type HeroBlockEditorFormValue = {
  eyebrow?: string;
  headline: string;
  description?: string;
  actions: [{ label: string; href: string }];
  imageAction: "keep" | "replace" | "remove";
  imageAccessibility?: "decorative" | "descriptive";
  imageAlt?: string;
};

export function createHeroBlockEditorFormSchema(
  linkTargetRegistry: LinkTargetRegistry,
) {
  return z
    .object({
      eyebrow: z
        .string()
        .trim()
        .optional()
        .transform((value) => (value ? value : undefined)),
      headline: z
        .string({ error: "Headline is required" })
        .trim()
        .min(1, "Headline is required"),
      description: z
        .string()
        .trim()
        .optional()
        .transform((value) => (value ? value : undefined)),
      actions: z.tuple([
        createHeroActionSchema(linkTargetRegistry).pick({
          label: true,
          href: true,
        }),
      ]),
      imageAction: z.enum(["keep", "replace", "remove"]).default("keep"),
      imageAccessibility: z.enum(["decorative", "descriptive"]).optional(),
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

export function getHeroBlockEditorDefaultValue(
  data: HeroBlockType["data"],
  linkTargetRegistry: LinkTargetRegistry,
): HeroBlockEditorFormShape {
  const action = data.actions[0];
  const isUploadedImage = data.image.kind === "uploaded";
  const imageAccessibility = isUploadedImage
    ? data.image.decorative
      ? "decorative"
      : "descriptive"
    : "decorative";
  const imageAlt =
    isUploadedImage && imageAccessibility === "descriptive"
      ? data.image.alt ?? ""
      : "";

  return {
    eyebrow: data.eyebrow ?? "",
    headline: data.headline,
    description: data.description ?? "",
    actions: [
      {
        label: action?.label ?? "",
        href: action?.href ?? linkTargetRegistry.targets[0]?.href ?? "",
      },
    ],
    imageAction: "keep",
    imageAccessibility,
    imageAlt,
  };
}

export function applyHeroBlockEditorValue(
  currentData: HeroBlockType["data"],
  value: HeroBlockEditorFormValue,
  options?: {
    uploadedImageId?: string;
  },
): HeroBlockType["data"] {
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
          ...(value.imageAccessibility === "descriptive" && value.imageAlt
            ? { alt: value.imageAlt }
            : {}),
        }
      : value.imageAction === "remove" && currentImage.kind === "uploaded"
        ? {
            kind: "asset" as const,
            src: currentImage.fallbackAssetSrc,
          }
        : currentImage;

  return {
    ...currentData,
    eyebrow: value.eyebrow,
    headline: value.headline,
    description: value.description,
    actions: [
      {
        ...(currentData.actions[0] ?? {}),
        label: value.actions[0].label,
        href: value.actions[0].href,
      },
    ],
    image,
  };
}

export function getHeroBlockEditorFormId(blockRef: BlockRef) {
  switch (blockRef.kind) {
    case "definition-key":
      return `hero-block-editor-${blockRef.definitionKey}`;
    case "page-block-id":
      return `hero-block-editor-${blockRef.pageBlockId}`;
  }
}
