import { describe, expect, test } from "vitest";

import type { BlockInstance } from "./catalog";
import { createCmsPageService, type CmsPageStore } from "./page-service.server";
import { siteCmsCatalog } from "./site-catalog";

function createMemoryPageStore(): CmsPageStore & {
  seed(record: {
    pageKey: string;
    title: string;
    description: string;
    blocks: BlockInstance[];
    revision: number;
  }): void;
  peek(pageKey: string): {
    pageKey: string;
    title: string;
    description: string;
    blocks: BlockInstance[];
    revision: number;
  } | null;
} {
  let page: {
    pageKey: string;
    title: string;
    description: string;
    blocks: BlockInstance[];
    revision: number;
  } | null = null;

  return {
    seed(record) {
      page = structuredClone(record);
    },
    peek(pageKey) {
      if (!page || page.pageKey !== pageKey) return null;
      return structuredClone(page);
    },
    async readPage(pageKey) {
      if (!page || page.pageKey !== pageKey) {
        return null;
      }

      return structuredClone(page);
    },
    async materializePage({ page: nextPage }) {
      if (page) {
        return {
          status: "conflict" as const,
          persistedPage: structuredClone(page),
        };
      }

      page = {
        pageKey: nextPage.pageKey,
        title: nextPage.title,
        description: nextPage.description,
        blocks: structuredClone(nextPage.blocks),
        revision: 1,
      };

      return {
        status: "saved" as const,
        materialization: "created" as const,
        persistedPage: structuredClone(page),
      };
    },
    async updatePageMeta({ pageKey, expectedRevision, title, description }) {
      if (!page || page.pageKey !== pageKey) {
        return {
          status: "conflict" as const,
          persistedPage: null,
        };
      }

      if (page.revision !== expectedRevision) {
        return {
          status: "conflict" as const,
          persistedPage: structuredClone(page),
        };
      }

      page = {
        ...page,
        title,
        description,
        revision: page.revision + 1,
      };

      return {
        status: "saved" as const,
        materialization: "updated" as const,
        persistedPage: structuredClone(page),
      };
    },
  };
}

describe("createCmsPageService", () => {
  test("lists editable pages with default-backed status before persistence", async () => {
    const service = createCmsPageService({
      catalog: siteCmsCatalog,
      pageStore: createMemoryPageStore(),
    });

    const pages = await service.listEditablePages();

    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({
      pageKey: "home",
      status: { kind: "default-backed", revision: null },
    });
    expect(typeof pages[0].title).toBe("string");
  });

  test("isKnownPageKey returns true for registered keys and false otherwise", () => {
    const service = createCmsPageService({
      catalog: siteCmsCatalog,
      pageStore: createMemoryPageStore(),
    });

    expect(service.isKnownPageKey("home")).toBe(true);
    expect(service.isKnownPageKey("nope")).toBe(false);
  });

  test("reads the home editor model as a default-backed page before persistence", async () => {
    const service = createCmsPageService({
      catalog: siteCmsCatalog,
      pageStore: createMemoryPageStore(),
    });

    const editorModel = await service.readEditorModel("home");

    expect(editorModel.pageKey).toBe("home");
    expect(editorModel.status).toEqual({
      kind: "default-backed",
      revision: null,
    });
    expect(editorModel.pageSnapshot.pageKey).toBe("home");
    expect(editorModel.pageSnapshot.provenance).toBe("default");
  });

  test("materializes the full home page snapshot on first page-meta save", async () => {
    const service = createCmsPageService({
      catalog: siteCmsCatalog,
      pageStore: createMemoryPageStore(),
    });

    const result = await service.applyPageCommand({
      type: "set-page-meta",
      pageKey: "home",
      baseRevision: null,
      title: "edited title",
      description: "edited description",
    });

    expect(result).toMatchObject({
      status: "saved",
      materialization: "created",
      editorModel: {
        pageKey: "home",
        status: { kind: "persisted", revision: 1 },
        pageSnapshot: {
          pageKey: "home",
          provenance: "persisted",
          title: "edited title",
          description: "edited description",
        },
      },
    });

    const editorModel = await service.readEditorModel("home");

    expect(editorModel.status).toEqual({ kind: "persisted", revision: 1 });
    expect(editorModel.pageSnapshot.blocks).toEqual(
      siteCmsCatalog.readPageSnapshot("home").blocks,
    );
  });

  test("reads the persisted home page after materialization", async () => {
    const service = createCmsPageService({
      catalog: siteCmsCatalog,
      pageStore: createMemoryPageStore(),
    });

    await service.applyPageCommand({
      type: "set-page-meta",
      pageKey: "home",
      baseRevision: null,
      title: "persisted title",
      description: "persisted description",
    });

    await expect(service.readPage("home")).resolves.toMatchObject({
      pageKey: "home",
      status: { kind: "persisted", revision: 1 },
      pageSnapshot: {
        pageKey: "home",
        provenance: "persisted",
        title: "persisted title",
        description: "persisted description",
      },
    });
  });

  test("falls back to defaults with diagnostics when persisted block data is invalid", async () => {
    const store = createMemoryPageStore();
    store.seed({
      pageKey: "home",
      title: "broken persisted title",
      description: "broken persisted description",
      blocks: [
        {
          type: "hero",
          version: 1,
          data: {},
        } as unknown as BlockInstance,
      ],
      revision: 1,
    });

    const service = createCmsPageService({
      catalog: siteCmsCatalog,
      pageStore: store,
    });

    const resolved = await service.readPage("home");

    expect(resolved.status).toEqual({
      kind: "default-backed",
      revision: null,
    });
    expect(resolved.pageSnapshot).toEqual(
      siteCmsCatalog.readPageSnapshot("home"),
    );
    expect(resolved.diagnostics).toEqual([
      {
        code: "block/invalid-data",
        message:
          'Persisted block "hero" on page "home" has invalid data. Showing defaults instead.',
      },
    ]);
  });

  test("set-page-meta on a persisted page does not rewrite block rows", async () => {
    const store = createMemoryPageStore();
    const service = createCmsPageService({
      catalog: siteCmsCatalog,
      pageStore: store,
    });

    await service.applyPageCommand({
      type: "set-page-meta",
      pageKey: "home",
      baseRevision: null,
      title: "first title",
      description: "first description",
    });

    const materializedBlocks = store.peek("home")?.blocks;
    expect(materializedBlocks).toBeDefined();

    await service.applyPageCommand({
      type: "set-page-meta",
      pageKey: "home",
      baseRevision: 1,
      title: "second title",
      description: "second description",
    });

    const afterUpdate = store.peek("home");
    expect(afterUpdate?.revision).toBe(2);
    expect(afterUpdate?.blocks).toEqual(materializedBlocks);
  });

  test("applyPageCommand returns conflict when the base revision is stale", async () => {
    const service = createCmsPageService({
      catalog: siteCmsCatalog,
      pageStore: createMemoryPageStore(),
    });

    await service.applyPageCommand({
      type: "set-page-meta",
      pageKey: "home",
      baseRevision: null,
      title: "first title",
      description: "first description",
    });

    const result = await service.applyPageCommand({
      type: "set-page-meta",
      pageKey: "home",
      baseRevision: 0,
      title: "stale title",
      description: "stale description",
    });

    expect(result.status).toBe("conflict");
    if (result.status === "conflict") {
      expect(result.currentEditorModel.status).toEqual({
        kind: "persisted",
        revision: 1,
      });
      expect(result.currentEditorModel.pageSnapshot.title).toBe("first title");
    }
  });

  test("applyPageCommand returns conflict when default-backed first-writer loses the race", async () => {
    const store = createMemoryPageStore();
    store.seed({
      pageKey: "home",
      title: "already there",
      description: "already there description",
      blocks: [],
      revision: 1,
    });
    const service = createCmsPageService({
      catalog: siteCmsCatalog,
      pageStore: store,
    });

    const result = await service.applyPageCommand({
      type: "set-page-meta",
      pageKey: "home",
      baseRevision: null,
      title: "late title",
      description: "late description",
    });

    expect(result.status).toBe("conflict");
  });

  test("applyPageCommand succeeds after a conflict when base revision is refreshed", async () => {
    const service = createCmsPageService({
      catalog: siteCmsCatalog,
      pageStore: createMemoryPageStore(),
    });

    await service.applyPageCommand({
      type: "set-page-meta",
      pageKey: "home",
      baseRevision: null,
      title: "t1",
      description: "d1",
    });

    const stale = await service.applyPageCommand({
      type: "set-page-meta",
      pageKey: "home",
      baseRevision: 0,
      title: "stale",
      description: "stale",
    });
    expect(stale.status).toBe("conflict");

    const fresh = await service.applyPageCommand({
      type: "set-page-meta",
      pageKey: "home",
      baseRevision: 1,
      title: "t2",
      description: "d2",
    });

    expect(fresh.status).toBe("saved");
    if (fresh.status === "saved") {
      expect(fresh.editorModel.status).toEqual({
        kind: "persisted",
        revision: 2,
      });
    }
  });
});
