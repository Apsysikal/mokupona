import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createPrismaCmsPageStore } from "./page-store.server";
import { siteCmsCatalog } from "./site-catalog";

import { prisma } from "~/db.server";

describe.sequential("createPrismaCmsPageStore", () => {
  const store = createPrismaCmsPageStore({ prisma });
  const getPersistedBlockIds = (blocks: { pageBlockId?: string }[]): string[] =>
    blocks
      .map((block) => block.pageBlockId)
      .filter((id): id is string => id !== undefined);

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

  test("updatePage can reorder persisted blocks without unique position conflicts", async () => {
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
    if (materialized.status !== "saved") return;

    const originalBlocks = [...materialized.persistedPage.blocks];
    const originalIds = getPersistedBlockIds(originalBlocks);
    expect(originalBlocks.length).toBeGreaterThan(3);

    const reorderedBlocks = [...originalBlocks];
    [reorderedBlocks[2], reorderedBlocks[3]] = [
      reorderedBlocks[3],
      reorderedBlocks[2],
    ];

    const updateResult = await store.updatePage({
      pageKey: "home",
      expectedRevision: materialized.persistedPage.revision,
      title: materialized.persistedPage.title,
      description: materialized.persistedPage.description,
      blocks: reorderedBlocks,
    });

    expect(updateResult.status).toBe("saved");
    if (updateResult.status !== "saved") return;

    expect(updateResult.persistedPage.blocks[2].pageBlockId).toBe(
      originalBlocks[3].pageBlockId,
    );
    expect(updateResult.persistedPage.blocks[3].pageBlockId).toBe(
      originalBlocks[2].pageBlockId,
    );
    expect(
      getPersistedBlockIds(updateResult.persistedPage.blocks).sort(),
    ).toEqual([...originalIds].sort());

    const persisted = await prisma.page.findUnique({
      where: { pageKey: "home" },
      include: {
        blocks: {
          orderBy: { position: "asc" },
        },
      },
    });
    expect(persisted).not.toBeNull();
    const positions = persisted!.blocks.map((block) => block.position);
    expect(new Set(positions).size).toBe(positions.length);
  });
});
