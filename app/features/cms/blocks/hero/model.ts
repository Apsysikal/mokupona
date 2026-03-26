import { z } from "zod/v4";

import { ActionSchema, ImageSchema } from "../models";
import type { BlockBaseType, BlockType, BlockVersion } from "../types";

const BLOCK_TYPE: BlockType = "hero";
const BLOCK_VERSION: BlockVersion = 1;

export const HeroBlockDataSchema = z.object({
  eyebrow: z.string().optional(),
  headline: z.string(),
  description: z.string().optional(),
  actions: z.array(ActionSchema),
  image: ImageSchema,
});

export type HeroBlockType = BlockBaseType<
  typeof BLOCK_TYPE,
  typeof BLOCK_VERSION,
  z.infer<typeof HeroBlockDataSchema>
>;
