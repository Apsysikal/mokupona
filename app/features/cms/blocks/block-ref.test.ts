import { describe, expect, test } from "vitest";

import {
  isBlockRef,
  parseBlockRef,
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

  test("isBlockRef validates shape for each supported kind", () => {
    expect(
      isBlockRef({ kind: "definition-key", definitionKey: "hero-main" }),
    ).toBe(true);
    expect(
      isBlockRef({ kind: "page-block-id", pageBlockId: "pb_1", position: 1 }),
    ).toBe(true);
    expect(
      isBlockRef({ kind: "page-block-id", pageBlockId: "pb_1", position: -1 }),
    ).toBe(false);
  });

  test("parseBlockRef parses valid JSON and rejects invalid payloads", () => {
    expect(
      parseBlockRef(
        JSON.stringify({ kind: "definition-key", definitionKey: "hero-main" }),
      ),
    ).toEqual({ kind: "definition-key", definitionKey: "hero-main" });
    expect(parseBlockRef("{bad-json")).toBeNull();
    expect(
      parseBlockRef(JSON.stringify({ kind: "page-block-id", pageBlockId: 1 })),
    ).toBeNull();
  });
});
