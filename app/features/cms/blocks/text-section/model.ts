import { z } from "zod/v4";

import type { BlockBaseType, BlockType } from "../types";

const BLOCK_TYPE: BlockType = "text-section";
const BLOCK_VERSION = 1;

export const TextSectionBlockDataSchema = z.object({
  headline: z.string(),
  body: z.string(),
  variant: z.enum(["plain", "slanted"]),
});

export type TextSectionBlockType = BlockBaseType<
  typeof BLOCK_TYPE,
  typeof BLOCK_VERSION,
  z.infer<typeof TextSectionBlockDataSchema>
>;

export type TextSectionBlockData = TextSectionBlockType["data"];
