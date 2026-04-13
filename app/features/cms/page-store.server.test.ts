import { afterEach, beforeEach, describe, expect, test } from "vitest";

import type { BlockType } from "./blocks/types";
import { createPrismaCmsPageStore } from "./page-store.server";
import { siteCmsCatalog } from "./site-catalog";

import { prisma } from "~/db.server";

describe.sequential("createPrismaCmsPageStore", () => {
  const store = createPrismaCmsPageStore({ prisma });

  beforeEach(async () => {
    await prisma.page.deleteMany({
      where: { pageKey: "home" },
    });
  });

  afterEach(async () => {
    await prisma.page.deleteMany({
      where: { pageKey: "home" },
    });
  });

  test("upsertPage swaps block positions without a unique-constraint error", async () => {
    const snapshot = siteCmsCatalog.readPageSnapshot("home");

    // Materialize the page to get stable pageBlockIds
    await store.materializePage({
      page: {
        pageKey: snapshot.pageKey,
        title: snapshot.title,
        description: snapshot.description,
        blocks: snapshot.blocks,
      },
    });

    const persisted = await prisma.page.findUniqueOrThrow({
      where: { pageKey: "home" },
      include: { blocks: { orderBy: { position: "asc" } } },
    });

    // Build a PersistedPage-like block list for upsertPage and swap positions
    // 0 and 1 (simulating a move-block-up that would previously cause a
    // unique constraint violation on (pageId, position)).
    const blocksInNewOrder = persisted.blocks.map((b) => ({
      pageBlockId: b.id,
      definitionKey: b.definitionKey ?? undefined,
      type: b.type as BlockType,
      version: b.version,
      data: JSON.parse(b.data as string) as unknown,
    }));

    // Swap the first two blocks
    [blocksInNewOrder[0], blocksInNewOrder[1]] = [
      blocksInNewOrder[1],
      blocksInNewOrder[0],
    ];

    const result = await store.updatePage({
      pageKey: "home",
      title: snapshot.title,
      description: snapshot.description,
      blocks: blocksInNewOrder,
      expectedRevision: 1,
    });

    expect(result.status).toBe("saved");

    // Verify the positions were actually swapped
    const after = await prisma.page.findUniqueOrThrow({
      where: { pageKey: "home" },
      include: { blocks: { orderBy: { position: "asc" } } },
    });

    expect(after.blocks[0].id).toBe(persisted.blocks[1].id);
    expect(after.blocks[1].id).toBe(persisted.blocks[0].id);
  });

  test("updatePageMeta preserves existing persisted block ids", async () => {
    const snapshot = siteCmsCatalog.readPageSnapshot("home");

    const materialized = await store.materializePage({
      page: {
        pageKey: snapshot.pageKey,
        title: snapshot.title,
        description: snapshot.description,
        blocks: snapshot.blocks,
      },
    });

    expect(materialized.status).toBe("saved");

    const beforeUpdate = await prisma.page.findUnique({
      where: { pageKey: "home" },
      include: {
        blocks: {
          orderBy: { position: "asc" },
        },
      },
    });

    expect(beforeUpdate?.blocks.length).toBeGreaterThan(0);

    const beforeBlockIds = beforeUpdate?.blocks.map((block) => block.id);

    const updated = await store.updatePageMeta({
      pageKey: "home",
      expectedRevision: 1,
      title: "updated title",
      description: "updated description",
    });

    expect(updated).toMatchObject({
      status: "saved",
      materialization: "updated",
      persistedPage: {
        pageKey: "home",
        revision: 2,
        title: "updated title",
        description: "updated description",
      },
    });

    const afterUpdate = await prisma.page.findUnique({
      where: { pageKey: "home" },
      include: {
        blocks: {
          orderBy: { position: "asc" },
        },
      },
    });

    expect(afterUpdate?.blocks.map((block) => block.id)).toEqual(
      beforeBlockIds,
    );
  });
});
