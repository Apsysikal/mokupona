export type DefinitionKeyRef = {
  readonly kind: "definition-key";
  readonly definitionKey: string;
};

export type PageBlockIdRef = {
  readonly kind: "page-block-id";
  readonly pageBlockId: string;
  readonly position: number;
};

export type BlockRef = DefinitionKeyRef | PageBlockIdRef;

/** Targets a fixed/named block by its definition key. Valid before and after persistence. */
export function refByDefinitionKey(definitionKey: string): DefinitionKeyRef {
  return { kind: "definition-key", definitionKey };
}

/** Targets a persisted block by its DB id. Only valid after first persistence. */
export function refByPageBlockId(
  pageBlockId: string,
  position: number,
): PageBlockIdRef {
  return { kind: "page-block-id", pageBlockId, position };
}
