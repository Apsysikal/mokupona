import type { BlockInstance } from "./catalog";

export type ExistingBlockRow = {
  id: string;
};

export type BlockOperation =
  | { op: "delete"; id: string }
  | { op: "shift"; ids: string[]; by: number }
  | { op: "update"; id: string; position: number; block: BlockInstance }
  | {
      op: "create";
      pageId: string;
      position: number;
      block: BlockInstance;
    };

/**
 * Plans the exact block writes needed to move from the current persisted rows
 * to the incoming ordered blocks without relying on Prisma or database state.
 *
 * The safety invariant is that retained rows are shifted by
 * `existingRows.length`, moving them out of the `0..incomingBlocks.length - 1`
 * target range before final positions are assigned.
 */
export function planBlockOperations(
  existingRows: readonly ExistingBlockRow[],
  incomingBlocks: readonly BlockInstance[],
  pageId: string,
): BlockOperation[] {
  const existingIds = existingRows.map(({ id }) => id);
  const incomingIds = new Set(
    incomingBlocks
      .map((block) => block.pageBlockId)
      .filter((id): id is string => id !== undefined),
  );
  const retainedIds = existingIds.filter((id) => incomingIds.has(id));
  const retainedIdSet = new Set(retainedIds);
  const operations: BlockOperation[] = [];

  for (const id of existingIds) {
    if (!incomingIds.has(id)) {
      operations.push({ op: "delete", id });
    }
  }

  if (retainedIds.length > 0) {
    operations.push({
      op: "shift",
      ids: retainedIds,
      by: existingRows.length,
    });
  }

  for (const [position, block] of incomingBlocks.entries()) {
    if (block.pageBlockId && retainedIdSet.has(block.pageBlockId)) {
      operations.push({
        op: "update",
        id: block.pageBlockId,
        position,
        block,
      });
      continue;
    }

    operations.push({
      op: "create",
      pageId,
      position,
      block,
    });
  }

  return operations;
}
