import { describe, expect, it } from "vitest";

import { planBlockOperations, type BlockOperation } from "./block-operations";
import type { BlockInstance } from "./catalog";

function createBlock({
  pageBlockId,
  definitionKey,
}: {
  pageBlockId?: string;
  definitionKey?: string;
} = {}): BlockInstance {
  return {
    ...(definitionKey ? { definitionKey } : {}),
    ...(pageBlockId ? { pageBlockId } : {}),
    type: "hero",
    version: 1,
    data: { headline: pageBlockId ?? "new-block" },
  };
}

function expectOpTypes(
  operations: readonly BlockOperation[],
  expected: BlockOperation["op"][],
) {
  expect(operations.map((operation) => operation.op)).toEqual(expected);
}

describe("planBlockOperations", () => {
  it("emits shift before updates when two adjacent blocks swap positions", () => {
    const operations = planBlockOperations(
      [{ id: "a" }, { id: "b" }],
      [createBlock({ pageBlockId: "b" }), createBlock({ pageBlockId: "a" })],
      "page-1",
    );

    const shiftIndex = operations.findIndex(
      (operation) => operation.op === "shift",
    );
    const updateIndex = operations.findIndex(
      (operation) => operation.op === "update",
    );

    expect(shiftIndex).toBeGreaterThanOrEqual(0);
    expect(updateIndex).toBeGreaterThanOrEqual(0);
    expect(shiftIndex).toBeLessThan(updateIndex);
  });

  it("uses existingRows.length as the shift invariant", () => {
    const operations = planBlockOperations(
      [{ id: "a" }, { id: "b" }, { id: "c" }],
      [createBlock({ pageBlockId: "c" }), createBlock({ pageBlockId: "a" })],
      "page-1",
    );

    const shift = operations.find(
      (operation): operation is Extract<BlockOperation, { op: "shift" }> =>
        operation.op === "shift",
    );

    expect(shift).toEqual({
      op: "shift",
      ids: ["a", "c"],
      by: 3,
    });
  });

  it("single block reorder emits shift and update without delete or create", () => {
    const block = createBlock({ pageBlockId: "a" });

    const operations = planBlockOperations([{ id: "a" }], [block], "page-1");

    expect(operations).toEqual([
      { op: "shift", ids: ["a"], by: 1 },
      { op: "update", id: "a", position: 0, block },
    ]);
  });

  it("adds a block with the correct create position", () => {
    const retained = createBlock({ pageBlockId: "a" });
    const created = createBlock({ definitionKey: "new-image" });

    const operations = planBlockOperations(
      [{ id: "a" }],
      [retained, created],
      "page-1",
    );

    expectOpTypes(operations, ["shift", "update", "create"]);
    expect(operations[2]).toEqual({
      op: "create",
      pageId: "page-1",
      position: 1,
      block: created,
    });
  });

  it("deletes removed blocks without shifting when nothing is retained", () => {
    const operations = planBlockOperations([{ id: "a" }], [], "page-1");

    expect(operations).toEqual([{ op: "delete", id: "a" }]);
  });

  it("handles mixed add, delete, and reorder operations in the expected order", () => {
    const movedToFront = createBlock({ pageBlockId: "c" });
    const created = createBlock({ definitionKey: "new-hero" });
    const movedToEnd = createBlock({ pageBlockId: "b" });

    const operations = planBlockOperations(
      [{ id: "a" }, { id: "b" }, { id: "c" }],
      [movedToFront, created, movedToEnd],
      "page-1",
    );

    expect(operations).toEqual([
      { op: "delete", id: "a" },
      { op: "shift", ids: ["b", "c"], by: 3 },
      { op: "update", id: "c", position: 0, block: movedToFront },
      { op: "create", pageId: "page-1", position: 1, block: created },
      { op: "update", id: "b", position: 2, block: movedToEnd },
    ]);
  });
});
