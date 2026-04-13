export type BlockType = "hero" | "text-section" | "image";
export type BlockVersion = number;
export type DefinitionKey = string;

export type BlockBaseType<T extends BlockType, V extends BlockVersion, D> = {
  definitionKey?: DefinitionKey;
  /** DB primary key of the persisted PageBlock row. Present only after first persistence. */
  pageBlockId?: string;
  type: T;
  version: V;
  data: D;
};
