import { z } from "zod/v4";

import type { BlockBaseType, BlockType } from "../types";

const BLOCK_TYPE: BlockType = "image";
const BLOCK_VERSION = 1;
export const DEFAULT_IMAGE_BLOCK_ASSET_SRC = "/accent-image.jpg";

const ImageAssetSchema = z.object({
  kind: z.literal("asset"),
  src: z.string(),
  alt: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

const ImageUploadedSchema = z
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

export const ImageBlockDataSchema = z.object({
  image: z.discriminatedUnion("kind", [ImageAssetSchema, ImageUploadedSchema]),
  variant: z.enum(["default", "full-width"]),
});

export type ImageBlockType = BlockBaseType<
  typeof BLOCK_TYPE,
  typeof BLOCK_VERSION,
  z.infer<typeof ImageBlockDataSchema>
>;

export function createDefaultImageBlockData(): ImageBlockType["data"] {
  return {
    image: {
      kind: "asset",
      src: DEFAULT_IMAGE_BLOCK_ASSET_SRC,
      alt: "",
    },
    variant: "default",
  };
}
