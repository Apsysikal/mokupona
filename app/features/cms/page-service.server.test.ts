import { describe, expect, test } from "vitest";

import { refByDefinitionKey, refByPageBlockId } from "./blocks/block-ref";
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

      let blockSeq = 0;
      page = {
        pageKey: nextPage.pageKey,
        title: nextPage.title,
        description: nextPage.description,
        blocks: nextPage.blocks.map((b) => ({
          ...structuredClone(b),
          pageBlockId: `mem-block-${++blockSeq}`,
        })),
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
    async updatePage({
      pageKey,
      expectedRevision,
      title,
      description,
      blocks,
    }) {
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

      let blockSeq = page.blocks.length;
      page = {
        ...page,
        title,
        description,
        blocks: blocks.map((b) => ({
          ...structuredClone(b),
          pageBlockId: b.pageBlockId ?? `mem-block-${++blockSeq}`,
        })),
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
    // blocks match the default snapshot (pageBlockId is added by the store, so omit it)
    const defaultBlocks = siteCmsCatalog.readPageSnapshot("home").blocks;
    expect(editorModel.pageSnapshot.blocks).toHaveLength(defaultBlocks.length);
    editorModel.pageSnapshot.blocks.forEach((block, i) => {
      expect(block.type).toBe(defaultBlocks[i].type);
      expect(block.data).toEqual(defaultBlocks[i].data);
      expect(block.pageBlockId).toBeDefined();
    });
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

describe("createCmsPageService — block commands", () => {
  /** Materialize the home page and return the service + store. */
  async function setupPersisted() {
    const store = createMemoryPageStore();
    const service = createCmsPageService({
      catalog: siteCmsCatalog,
      pageStore: store,
    });

    const result = await service.applyPageCommand({
      type: "set-page-meta",
      pageKey: "home",
      baseRevision: null,
      title: "home title",
      description: "home desc",
    });

    if (result.status !== "saved") throw new Error("setup: expected saved");

    return { service, store, revision: result.editorModel.status.revision! };
  }

  test("set-block-data updates the hero block headline on a persisted page", async () => {
    const { service, store, revision } = await setupPersisted();

    // The hero block is at position 0 with definitionKey "hero-main"
    const heroBlock = store.peek("home")!.blocks[0];
    const ref = refByPageBlockId(heroBlock.pageBlockId!, 0);

    const result = await service.applyPageCommand({
      type: "set-block-data",
      pageKey: "home",
      baseRevision: revision,
      ref,
      blockType: "hero",
      blockVersion: 1,
      data: {
        ...(heroBlock.data as object),
        headline: "Updated headline",
      },
    });

    expect(result.status).toBe("saved");
    if (result.status !== "saved") return;

    const updatedBlock = result.editorModel.pageSnapshot.blocks[0];
    expect((updatedBlock.data as { headline: string }).headline).toBe(
      "Updated headline",
    );
    expect(result.editorModel.status.revision).toBe(revision + 1);
  });

  test("set-block-data returns the current persisted editor model when block data is invalid", async () => {
    const { service, store, revision } = await setupPersisted();

    const heroBlock = store.peek("home")!.blocks[0];
    const ref = refByPageBlockId(heroBlock.pageBlockId!, 0);

    const result = await service.applyPageCommand({
      type: "set-block-data",
      pageKey: "home",
      baseRevision: revision,
      ref,
      blockType: "hero",
      blockVersion: 1,
      data: { headline: 999 }, // headline must be a string
    });

    expect(result.status).toBe("conflict");
    if (result.status !== "conflict") return;

    expect(result.currentEditorModel.status).toEqual({
      kind: "persisted",
      revision,
    });
    expect(result.currentEditorModel.pageSnapshot.blocks[0]).toEqual(heroBlock);
    expect(store.peek("home")?.revision).toBe(revision);
  });

  test("set-block-data rejects CTA href values outside the registered site targets", async () => {
    const { service, store, revision } = await setupPersisted();

    const heroBlock = store.peek("home")!.blocks[0];
    const ref = refByPageBlockId(heroBlock.pageBlockId!, 0);

    const result = await service.applyPageCommand({
      type: "set-block-data",
      pageKey: "home",
      baseRevision: revision,
      ref,
      blockType: "hero",
      blockVersion: 1,
      data: {
        ...(heroBlock.data as object),
        actions: [{ label: "Join", href: "https://example.com" }],
      },
    });

    expect(result.status).toBe("conflict");
    if (result.status !== "conflict") return;

    expect(result.currentEditorModel.status).toEqual({
      kind: "persisted",
      revision,
    });
    expect(
      (
        result.currentEditorModel.pageSnapshot.blocks[0].data as {
          actions: { href: string }[];
        }
      ).actions[0].href,
    ).toBe("/dinners");
    expect(store.peek("home")?.revision).toBe(revision);
  });

  test("set-block-data on a default-backed page materializes the page first", async () => {
    const store = createMemoryPageStore();
    const service = createCmsPageService({
      catalog: siteCmsCatalog,
      pageStore: store,
    });

    // Hero block on the default-backed page is at position 0 with definitionKey "hero-main"
    const ref = refByDefinitionKey("hero-main");
    const defaultSnapshot = siteCmsCatalog.readPageSnapshot("home");
    const defaultHeroData = defaultSnapshot.blocks[0].data as {
      headline: string;
      actions: { href: string; label: string }[];
      image:
        | { kind: "asset"; src: string }
        | { kind: "uploaded"; imageId: string };
    };

    const result = await service.applyPageCommand({
      type: "set-block-data",
      pageKey: "home",
      baseRevision: null,
      ref,
      blockType: "hero",
      blockVersion: 1,
      data: { ...defaultHeroData, headline: "First materialized" },
    });

    expect(result.status).toBe("saved");
    if (result.status !== "saved") return;
    expect(result.materialization).toBe("created");
    expect(result.editorModel.pageSnapshot.provenance).toBe("persisted");
    const heroData = result.editorModel.pageSnapshot.blocks[0].data as {
      headline: string;
    };
    expect(heroData.headline).toBe("First materialized");
  });

  test("move-block-up swaps a block with its predecessor", async () => {
    const { service, store, revision } = await setupPersisted();

    // Block at position 2 (image) can move to position 1 without entering the required zone
    const blockAtTwo = store.peek("home")!.blocks[2];
    const ref = refByPageBlockId(blockAtTwo.pageBlockId!, 2);

    const result = await service.applyPageCommand({
      type: "move-block-up",
      pageKey: "home",
      baseRevision: revision,
      ref,
    });

    expect(result.status).toBe("saved");
    if (result.status !== "saved") return;

    // The block that was at index 2 is now at index 1
    const movedBlock = result.editorModel.pageSnapshot.blocks[1];
    expect(movedBlock.pageBlockId).toBe(blockAtTwo.pageBlockId);
  });

  test("move-block-up is rejected when the target position is in the required leading zone", async () => {
    const { service, store, revision } = await setupPersisted();

    // Block at position 1 cannot move to position 0 — hero must stay at position 0
    const blockAtOne = store.peek("home")!.blocks[1];
    const ref = refByPageBlockId(blockAtOne.pageBlockId!, 1);

    const result = await service.applyPageCommand({
      type: "move-block-up",
      pageKey: "home",
      baseRevision: revision,
      ref,
    });

    expect(result.status).not.toBe("saved");
  });

  test("move-block-down swaps a block with its successor", async () => {
    const { service, store, revision } = await setupPersisted();

    // The last block cannot move down, so use second-to-last
    const blocks = store.peek("home")!.blocks;
    const secondToLast = blocks[blocks.length - 2];
    const ref = refByPageBlockId(secondToLast.pageBlockId!, blocks.length - 2);

    const result = await service.applyPageCommand({
      type: "move-block-down",
      pageKey: "home",
      baseRevision: revision,
      ref,
    });

    expect(result.status).toBe("saved");
    if (result.status !== "saved") return;

    const movedBlock =
      result.editorModel.pageSnapshot.blocks[blocks.length - 1];
    expect(movedBlock.pageBlockId).toBe(secondToLast.pageBlockId);
  });

  test("move-block-down is rejected for a block in the required leading zone", async () => {
    const { service, store, revision } = await setupPersisted();

    const heroBlock = store.peek("home")!.blocks[0];
    const ref = refByPageBlockId(heroBlock.pageBlockId!, 0);

    const result = await service.applyPageCommand({
      type: "move-block-down",
      pageKey: "home",
      baseRevision: revision,
      ref,
    });

    expect(result.status).toBe("conflict");
  });

  test("delete-block removes a non-required block from the page", async () => {
    const { service, store, revision } = await setupPersisted();

    const blocks = store.peek("home")!.blocks;
    const initialCount = blocks.length;

    // Position 1 is not a required leading block
    const blockAtOne = blocks[1];
    const ref = refByPageBlockId(blockAtOne.pageBlockId!, 1);

    const result = await service.applyPageCommand({
      type: "delete-block",
      pageKey: "home",
      baseRevision: revision,
      ref,
    });

    expect(result.status).toBe("saved");
    if (result.status !== "saved") return;
    expect(result.editorModel.pageSnapshot.blocks).toHaveLength(
      initialCount - 1,
    );
    expect(
      result.editorModel.pageSnapshot.blocks.find(
        (b) => b.pageBlockId === blockAtOne.pageBlockId,
      ),
    ).toBeUndefined();
  });

  test("delete-block is rejected for a block in a required leading slot", async () => {
    const { service, store, revision } = await setupPersisted();

    // Hero is at position 0 and is in requiredLeadingBlockTypes
    const heroBlock = store.peek("home")!.blocks[0];
    const ref = refByPageBlockId(heroBlock.pageBlockId!, 0);

    const result = await service.applyPageCommand({
      type: "delete-block",
      pageKey: "home",
      baseRevision: revision,
      ref,
    });

    expect(result.status).not.toBe("saved");
  });
});

describe("createCmsPageService — add-block command", () => {
  async function setupPersisted() {
    const store = createMemoryPageStore();
    const service = createCmsPageService({
      catalog: siteCmsCatalog,
      pageStore: store,
    });

    const result = await service.applyPageCommand({
      type: "set-page-meta",
      pageKey: "home",
      baseRevision: null,
      title: "home title",
      description: "home desc",
    });

    if (result.status !== "saved") throw new Error("setup: expected saved");

    return { service, store, revision: result.editorModel.status.revision! };
  }

  test("add-block appends a new text-section block at the end of the page", async () => {
    const { service, store, revision } = await setupPersisted();
    const initialCount = store.peek("home")!.blocks.length;

    const result = await service.applyPageCommand({
      type: "add-block",
      pageKey: "home",
      baseRevision: revision,
      blockType: "text-section",
      blockVersion: 1,
      data: {
        headline: "New section",
        body: "New body text",
        variant: "plain",
      },
    });

    expect(result.status).toBe("saved");
    if (result.status !== "saved") return;

    const blocks = result.editorModel.pageSnapshot.blocks;
    expect(blocks).toHaveLength(initialCount + 1);

    const newBlock = blocks[blocks.length - 1];
    expect(newBlock.type).toBe("text-section");
    expect((newBlock.data as { headline: string }).headline).toBe(
      "New section",
    );
    expect(newBlock.pageBlockId).toBeDefined();
  });

  test("add-block materializes a default-backed page on first add", async () => {
    const store = createMemoryPageStore();
    const service = createCmsPageService({
      catalog: siteCmsCatalog,
      pageStore: store,
    });

    const result = await service.applyPageCommand({
      type: "add-block",
      pageKey: "home",
      baseRevision: null,
      blockType: "text-section",
      blockVersion: 1,
      data: { headline: "First section", body: "Body text", variant: "plain" },
    });

    expect(result.status).toBe("saved");
    if (result.status !== "saved") return;
    expect(result.materialization).toBe("created");
    expect(result.editorModel.pageSnapshot.provenance).toBe("persisted");
  });

  test("add-block returns conflict when block type is not in allowedBlockTypes", async () => {
    const { service, revision } = await setupPersisted();

    // "unknown-type" is not registered and not allowed
    const result = await service.applyPageCommand({
      type: "add-block",
      pageKey: "home",
      baseRevision: revision,
      blockType: "unknown-type" as never,
      blockVersion: 1,
      data: {},
    });

    expect(result.status).toBe("conflict");
  });

  test("add-block returns conflict when block data fails schema validation", async () => {
    const { service, revision } = await setupPersisted();

    const result = await service.applyPageCommand({
      type: "add-block",
      pageKey: "home",
      baseRevision: revision,
      blockType: "text-section",
      blockVersion: 1,
      data: { headline: 123, body: "Body", variant: "plain" }, // headline must be string
    });

    expect(result.status).toBe("conflict");
  });

  test("add-block returns conflict on stale revision", async () => {
    const { service } = await setupPersisted();

    const result = await service.applyPageCommand({
      type: "add-block",
      pageKey: "home",
      baseRevision: 999,
      blockType: "text-section",
      blockVersion: 1,
      data: { headline: "Section", body: "Body", variant: "plain" },
    });

    expect(result.status).toBe("conflict");
  });

  test("add-block appends a new image block at the end of the page", async () => {
    const { service, store, revision } = await setupPersisted();
    const initialCount = store.peek("home")!.blocks.length;

    const result = await service.applyPageCommand({
      type: "add-block",
      pageKey: "home",
      baseRevision: revision,
      blockType: "image",
      blockVersion: 1,
      data: {
        image: {
          kind: "asset",
          src: "/accent-image.png",
          alt: "",
        },
        variant: "default",
      },
    });

    expect(result.status).toBe("saved");
    if (result.status !== "saved") return;

    const blocks = result.editorModel.pageSnapshot.blocks;
    expect(blocks).toHaveLength(initialCount + 1);

    const newBlock = blocks[blocks.length - 1];
    expect(newBlock.type).toBe("image");
    expect(newBlock.pageBlockId).toBeDefined();
    expect(newBlock.data).toEqual({
      image: {
        kind: "asset",
        src: "/accent-image.png",
        alt: "",
      },
      variant: "default",
    });
  });
});
