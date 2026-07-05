import { z } from "zod/v4";

import type { BlockType } from "../types";

const BLOCK_TYPE: BlockType = "text-section";
const BLOCK_VERSION = 1;

export const TextSectionBlockDataSchema = z.object({
  // small uppercase label above the headline ("our vision")
  eyebrow: z.string().optional(),
  headline: z.string(),
  body: z.string(),
  variant: z.literal(["plain", "slanted"]),
});

export type TextSectionBlockType = {
  type: typeof BLOCK_TYPE;
  version: typeof BLOCK_VERSION;
  data: z.infer<typeof TextSectionBlockDataSchema>;
};
