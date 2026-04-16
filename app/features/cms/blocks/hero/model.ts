import { z } from "zod/v4";

import type { LinkTargetRegistry } from "../../link-targets";
import { ActionSchema } from "../models";
import type { BlockBaseType, BlockType, BlockVersion } from "../types";

const BLOCK_TYPE: BlockType = "hero";
const BLOCK_VERSION: BlockVersion = 1;

const HeroAssetImageSchema = z.object({
  kind: z.literal("asset"),
  src: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
});

const HeroUploadedImageSchema = z
  .object({
    kind: z.literal("uploaded"),
    imageId: z.string().trim().min(1),
    fallbackAssetSrc: z.string().trim().min(1),
    decorative: z.boolean(),
    alt: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value : undefined)),
  })
  .superRefine((image, ctx) => {
    if (!image.decorative && !image.alt) {
      ctx.addIssue({
        code: "custom",
        path: ["alt"],
        message: "Alt text is required when image is descriptive",
      });
    }
  });

function optionalCopyFieldSchema() {
  return z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined));
}

function requiredCopyFieldSchema(fieldLabel: string) {
  return z
    .string({ error: `${fieldLabel} is required` })
    .trim()
    .min(1, `${fieldLabel} is required`);
}

export function createHeroActionSchema(
  linkTargetRegistry?: LinkTargetRegistry,
) {
  const hrefSchema = requiredCopyFieldSchema("CTA destination");
  const safeHrefSchema = linkTargetRegistry
    ? hrefSchema.refine(
        (href) => linkTargetRegistry.byHref[href] !== undefined,
        "CTA destination must be one of the registered site links",
      )
    : hrefSchema;

  return ActionSchema.extend({
    label: requiredCopyFieldSchema("CTA label"),
    href: safeHrefSchema,
  });
}

export function createHeroBlockDataSchema(
  linkTargetRegistry?: LinkTargetRegistry,
) {
  return z.object({
    eyebrow: optionalCopyFieldSchema(),
    headline: requiredCopyFieldSchema("Headline"),
    description: optionalCopyFieldSchema(),
    actions: z
      .array(createHeroActionSchema(linkTargetRegistry))
      .min(1, "At least one CTA is required"),
    image: z.discriminatedUnion("kind", [
      HeroAssetImageSchema,
      HeroUploadedImageSchema,
    ]),
  });
}

export const HeroBlockDataSchema = createHeroBlockDataSchema();

export type HeroBlockType = BlockBaseType<
  typeof BLOCK_TYPE,
  typeof BLOCK_VERSION,
  z.infer<typeof HeroBlockDataSchema>
>;

export type HeroBlockData = HeroBlockType["data"];
