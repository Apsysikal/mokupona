import { z } from "zod/v4";

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

export function createHeroActionSchema() {
  return ActionSchema.extend({
    label: requiredCopyFieldSchema("CTA label"),
    href: requiredCopyFieldSchema("CTA destination"),
  });
}

export function createHeroBlockDataSchema() {
  return z.object({
    eyebrow: optionalCopyFieldSchema(),
    headline: requiredCopyFieldSchema("Headline"),
    description: optionalCopyFieldSchema(),
    actions: z
      .array(createHeroActionSchema())
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
