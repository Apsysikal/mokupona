import { z } from "zod/v4";

import { ImageSchema } from "../models";
import type { BlockBaseType, BlockType } from "../types";

const BLOCK_TYPE: BlockType = "image";
const BLOCK_VERSION = 1;

export const ImageBlockDataSchema = z.object({
  image: ImageSchema,
  variant: z.enum(["default", "full-width"]),
});

export type ImageBlockType = BlockBaseType<
  typeof BLOCK_TYPE,
  typeof BLOCK_VERSION,
  z.infer<typeof ImageBlockDataSchema>
>;
