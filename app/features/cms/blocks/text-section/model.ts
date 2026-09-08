import type { BlockType } from "../types";

const BLOCK_TYPE: BlockType = "text-section";
const BLOCK_VERSION = 1;

type TextSectionBlockData = {
  eyebrow?: string;
  headline: string;
  body: string;
  variant: "plain" | "feature";
};

export type TextSectionBlockType = {
  type: typeof BLOCK_TYPE;
  version: typeof BLOCK_VERSION;
  data: TextSectionBlockData;
};
