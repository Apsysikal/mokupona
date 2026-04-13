import { describe, expect, test } from "vitest";

import {
  refByDefinitionKey,
  refByPageBlockId,
  type BlockRef,
  type DefinitionKeyRef,
  type PageBlockIdRef,
} from "./block-ref";

describe("BlockRef", () => {
  test("refByDefinitionKey creates a DefinitionKeyRef", () => {
    const ref = refByDefinitionKey("hero-main");

    expect(ref.kind).toBe("definition-key");
    expect(ref.definitionKey).toBe("hero-main");
  });

  test("refByPageBlockId creates a PageBlockIdRef with position", () => {
    const ref = refByPageBlockId("clx123abc", 0);

    expect(ref.kind).toBe("page-block-id");
    expect(ref.pageBlockId).toBe("clx123abc");
    expect(ref.position).toBe(0);
  });

  test("discriminated union narrows correctly in a switch", () => {
    const refs: BlockRef[] = [
      refByDefinitionKey("hero-main"),
      refByPageBlockId("clx999", 2),
    ];

    const labels = refs.map((ref) => {
      switch (ref.kind) {
        case "definition-key":
          return `dk:${ref.definitionKey}`;
        case "page-block-id":
          return `id:${ref.pageBlockId}@${ref.position}`;
      }
    });

    expect(labels).toEqual(["dk:hero-main", "id:clx999@2"]);
  });

  test("DefinitionKeyRef and PageBlockIdRef are distinct types", () => {
    const defRef: DefinitionKeyRef = refByDefinitionKey("slot-a");
    const idRef: PageBlockIdRef = refByPageBlockId("abc", 1);

    expect(defRef.kind).not.toBe(idRef.kind);
  });
});
