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

export function isBlockRef(value: unknown): value is BlockRef {
  if (!value || typeof value !== "object") return false;

  const candidate = value as {
    kind?: unknown;
    definitionKey?: unknown;
    pageBlockId?: unknown;
    position?: unknown;
  };

  if (candidate.kind === "definition-key") {
    return typeof candidate.definitionKey === "string";
  }

  if (candidate.kind === "page-block-id") {
    return (
      typeof candidate.pageBlockId === "string" &&
      typeof candidate.position === "number" &&
      Number.isInteger(candidate.position) &&
      candidate.position >= 0
    );
  }

  return false;
}

export function parseBlockRef(raw: string): BlockRef | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isBlockRef(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
