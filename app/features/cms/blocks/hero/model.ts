import { z } from "zod/v4";

import { ActionSchema, ImageSchema } from "../models";
import type { BlockBaseType, BlockType, BlockVersion } from "../types";

const BLOCK_TYPE: BlockType = "hero";
const BLOCK_VERSION: BlockVersion = 1;

export const HeroBlockDataSchema = z.object({
  eyebrow: z.string().optional(),
  headline: z.string(),
  // rendered as an italic accent-colored continuation of the headline
  // ("an evening around *one long table*")
  headlineAccent: z.string().optional(),
  description: z.string().optional(),
  actions: z.array(ActionSchema),
  // small uppercase line under the actions ("byob · 15 seats · zürich")
  meta: z.string().optional(),
  image: ImageSchema,
});

export type HeroBlockType = BlockBaseType<
  typeof BLOCK_TYPE,
  typeof BLOCK_VERSION,
  z.infer<typeof HeroBlockDataSchema>
>;
