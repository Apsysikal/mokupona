import { z } from "zod/v4";

import { ImageSchema } from "../models";
import type { BlockType } from "../types";

const BLOCK_TYPE: BlockType = "image";
const BLOCK_VERSION = 1;

export const ImageBlockDataSchema = z.object({
  image: ImageSchema,
  variant: z.enum(["default", "full-width"]),
});

export type ImageBlockType = {
  type: typeof BLOCK_TYPE;
  version: typeof BLOCK_VERSION;
  data: z.infer<typeof ImageBlockDataSchema>;
};
