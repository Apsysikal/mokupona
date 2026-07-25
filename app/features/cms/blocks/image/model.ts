import type { BlockImage } from "../models";
import type { BlockType } from "../types";

const BLOCK_TYPE: BlockType = "image";
const BLOCK_VERSION = 1;

type ImageBlockData = {
  image: BlockImage;
  variant: "default" | "full-width";
};

export type ImageBlockType = {
  type: typeof BLOCK_TYPE;
  version: typeof BLOCK_VERSION;
  data: ImageBlockData;
};
