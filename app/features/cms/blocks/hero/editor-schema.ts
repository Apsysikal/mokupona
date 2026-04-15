import { z } from "zod/v4";

import type { BlockRef } from "../block-ref";

import { createHeroActionSchema, type HeroBlockType } from "./model";

import type { LinkTargetRegistry } from "~/features/cms/link-targets";

const DEFAULT_HERO_ASSET_SRC = "/hero-image.jpg";
type MaybeHeroData = Partial<HeroBlockType["data"]> & {
  image?: unknown;
  actions?: unknown;
};

function normalizeHeroImage(image: unknown): HeroBlockType["data"]["image"] {
  if (
    image &&
    typeof image === "object" &&
    "kind" in image &&
    (image as { kind?: unknown }).kind === "asset"
  ) {
    const src = (image as { src?: unknown }).src;
    return {
      kind: "asset",
      src:
        typeof src === "string" && src.length > 0
          ? src
          : DEFAULT_HERO_ASSET_SRC,
    };
  }

  if (
    image &&
    typeof image === "object" &&
    "kind" in image &&
    (image as { kind?: unknown }).kind === "uploaded"
  ) {
    const imageId = (image as { imageId?: unknown }).imageId;
    const fallbackAssetSrc = (image as { fallbackAssetSrc?: unknown })
      .fallbackAssetSrc;
    if (
      typeof imageId === "string" &&
      imageId.length > 0 &&
      typeof fallbackAssetSrc === "string" &&
      fallbackAssetSrc.length > 0
    ) {
      const alt = (image as { alt?: unknown }).alt;
      return {
        kind: "uploaded",
        imageId,
        fallbackAssetSrc,
        decorative: (image as { decorative?: unknown }).decorative === true,
        alt: typeof alt === "string" ? alt : undefined,
      };
    }
  }

  return {
    kind: "asset",
    src: DEFAULT_HERO_ASSET_SRC,
  };
}

function normalizeFirstHeroAction(actions: unknown): {
  label?: string;
  href?: string;
} {
  if (!Array.isArray(actions) || actions.length === 0) {
    return {};
  }

  const first = actions[0];
  if (!first || typeof first !== "object") {
    return {};
  }

  return {
    label:
      typeof (first as { label?: unknown }).label === "string"
        ? (first as { label: string }).label
        : undefined,
    href:
      typeof (first as { href?: unknown }).href === "string"
        ? (first as { href: string }).href
        : undefined,
  };
}

export type HeroBlockEditorFormShape = {
  eyebrow: string;
  headline: string;
  description: string;
  actions: [{ label: string; href: string }];
  imageAction: "keep" | "replace" | "remove";
  imageAccessibility: "" | "decorative" | "descriptive";
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

export function getHeroBlockEditorDefaultValue(
  data: HeroBlockType["data"],
  linkTargetRegistry: LinkTargetRegistry,
): HeroBlockEditorFormShape {
  const action = data.actions[0];
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
  const currentDataRecord = currentData as unknown as MaybeHeroData;
  const currentImage = normalizeHeroImage(currentDataRecord.image);
  const currentAction = normalizeFirstHeroAction(currentDataRecord.actions);
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
    eyebrow: value.eyebrow,
    headline: value.headline,
    description: value.description,
    actions: [
      {
        ...currentAction,
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
