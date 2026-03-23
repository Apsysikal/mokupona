export type BlockType = "hero" | "text-section" | "image";
export type BlockVersion = number;

export type BlockBaseType<T extends BlockType, V extends BlockVersion, D> = {
  type: T;
  version: V;
  data: D;
};
