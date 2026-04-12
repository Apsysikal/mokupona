import { afterEach, beforeEach, describe, expect, test } from "vitest";

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
