import type { BlockAction, BlockImage } from "../models";
import type { BlockBaseType, BlockType, BlockVersion } from "../types";

const BLOCK_TYPE: BlockType = "hero";
const BLOCK_VERSION: BlockVersion = 1;

type HeroBlockData = {
  eyebrow?: string;
  headline: string;
  headlineAccent?: string;
  description?: string;
  actions: BlockAction[];
  meta?: string;
  image: BlockImage;
};

export type HeroBlockType = BlockBaseType<
  typeof BLOCK_TYPE,
  typeof BLOCK_VERSION,
  HeroBlockData
>;
