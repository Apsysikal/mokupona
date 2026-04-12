export type BlockType = "hero" | "text-section" | "image";
export type BlockVersion = number;
export type DefinitionKey = string;

export type BlockBaseType<T extends BlockType, V extends BlockVersion, D> = {
  definitionKey?: DefinitionKey;
  type: T;
  version: V;
  data: D;
};
