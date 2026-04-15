import { describe, expect, test } from "vitest";

import { refByDefinitionKey, refByPageBlockId } from "./blocks/block-ref";
import {
  createCmsCatalog,
  defineBlockDefinition,
  definePageDefinition,
  type BlockInstance,
  type CmsCatalog,
} from "./catalog";
import { cmsDiagnosticCodes } from "./diagnostics";
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

  test("lists editable pages with typed diagnostics for recoverable persisted content", async () => {
    const store = createMemoryPageStore();
    store.seed({
      pageKey: "home",
      title: "persisted title",
      description: "persisted description",
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

    const pages = await service.listEditablePages();

    expect(pages).toHaveLength(1);
    expect(pages[0].status).toEqual({ kind: "persisted", revision: 1 });
    expect(pages[0].diagnostics).toContainEqual({
      code: cmsDiagnosticCodes.blockBrokenData,
      message:
        'Persisted block "hero" on page "home" has invalid data. Keep it editable in admin and omit it from public.',
      blockType: "hero",
      blockIndex: 0,
    });
    expect(pages[0].diagnostics).toContainEqual({
      code: cmsDiagnosticCodes.pagePublicFallbackDefaults,
      message:
        "Persisted page structure is invalid for public rendering. Falling back to default page content.",
    });
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

  test("rethrows unexpected block definition lookup errors while normalizing persisted blocks", async () => {
    const pageStore = createMemoryPageStore();
    pageStore.seed({
      pageKey: "home",
      title: "persisted title",
      description: "persisted description",
      blocks: [
        {
          pageBlockId: "persisted-hero",
          definitionKey: "hero-main",
          type: "hero",
          version: 1,
          data: {
            headline: "Persisted hero",
            body: "Persisted body",
            cta: {
              text: "RSVP",
              href: "/about",
              kind: "internal",
              linkTargetKey: "about",
            },
            image: {
              kind: "asset",
              src: "/default-home-hero.jpg",
              alt: "Default hero image",
              decorative: false,
            },
          },
        },
      ],
      revision: 1,
    });
    const explodingCatalog: CmsCatalog = {
      ...siteCmsCatalog,
      getBlockDefinition() {
        throw new Error("boom");
      },
    };
    const service = createCmsPageService({
      catalog: explodingCatalog,
      pageStore,
    });

    await expect(service.readEditorModel("home")).rejects.toThrow("boom");
  });

  test("rethrows unexpected block definition lookup errors while validating set-block-data commands", async () => {
    const explodingCatalog: CmsCatalog = {
      ...siteCmsCatalog,
      getBlockDefinition() {
        throw new Error("boom");
      },
    };
    const service = createCmsPageService({
      catalog: explodingCatalog,
      pageStore: createMemoryPageStore(),
    });

    await expect(
      service.applyPageCommand({
        type: "set-block-data",
        pageKey: "home",
        baseRevision: null,
        ref: refByDefinitionKey("hero-main"),
        blockType: "hero",
        blockVersion: 1,
        data: {
          headline: "Updated headline",
          body: "Updated body",
          cta: {
            text: "RSVP",
            href: "/about",
            kind: "internal",
            linkTargetKey: "about",
          },
          image: {
            kind: "asset",
            src: "/default-home-hero.jpg",
            alt: "Default hero image",
            decorative: false,
          },
        },
      }),
    ).rejects.toThrow("boom");
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

  test("keeps persisted pages editable in admin with diagnostics when block data is invalid", async () => {
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
      kind: "persisted",
      revision: 1,
    });
    expect(resolved.pageSnapshot.title).toBe("broken persisted title");
    expect(resolved.pageSnapshot.blocks).toHaveLength(1);
    expect(resolved.diagnostics).toEqual([
      {
        code: cmsDiagnosticCodes.blockBrokenData,
        message:
          'Persisted block "hero" on page "home" has invalid data. Keep it editable in admin and omit it from public.',
        blockType: "hero",
        blockIndex: 0,
      },
      {
        code: cmsDiagnosticCodes.pagePublicFallbackDefaults,
        message:
          "Persisted page structure is invalid for public rendering. Falling back to default page content.",
      },
    ]);
  });

  test("public projection omits broken blocks and reports recovery diagnostics", async () => {
    const store = createMemoryPageStore();
    store.seed({
      pageKey: "home",
      title: "broken persisted title",
      description: "broken persisted description",
      blocks: [
        {
          type: "hero",
          version: 1,
          data: siteCmsCatalog.readPageSnapshot("home").blocks[0].data,
        },
        {
          type: "text-section",
          version: 1,
          data: {},
        } as unknown as BlockInstance,
        {
          type: "text-section",
          version: 1,
          data: {
            headline: "Valid block",
            body: "Still visible",
            variant: "plain",
          },
        },
      ],
      revision: 1,
    });
    const service = createCmsPageService({
      catalog: siteCmsCatalog,
      pageStore: store,
    });

    const projection = await service.readPublicProjection("home", {
      pathname: "/",
    });

    expect(projection.blocks).toHaveLength(2);
    expect(projection.blocks[0].type).toBe("hero");
    expect(projection.blocks[1].type).toBe("text-section");
    expect(
      projection.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === cmsDiagnosticCodes.pagePublicOmittedBrokenBlocks,
      ),
    ).toBe(true);
  });

  test("preserves diagnostics emitted by catalog public projection", async () => {
    const catalogProjectionDiagnostic = {
      code: cmsDiagnosticCodes.pageMigrated,
      message: "catalog projection diagnostic",
    } as const;
    const catalogWithProjectionDiagnostic: CmsCatalog = {
      ...siteCmsCatalog,
      projectPublic(snapshot, context) {
        const projection = siteCmsCatalog.projectPublic(snapshot, context);
        return {
          ...projection,
          diagnostics: [
            ...projection.diagnostics,
            { ...catalogProjectionDiagnostic },
          ],
        };
      },
    };

    const defaultBackedService = createCmsPageService({
      catalog: catalogWithProjectionDiagnostic,
      pageStore: createMemoryPageStore(),
    });
    const defaultProjection = await defaultBackedService.readPublicProjection(
      "home",
      {
        pathname: "/",
      },
    );
    expect(defaultProjection.diagnostics).toContainEqual(
      catalogProjectionDiagnostic,
    );

    const persistedStore = createMemoryPageStore();
    const defaultSnapshot = siteCmsCatalog.readPageSnapshot("home");
    persistedStore.seed({
      pageKey: "home",
      title: "persisted title",
      description: "persisted description",
      blocks: defaultSnapshot.blocks,
      revision: 1,
    });
    const persistedService = createCmsPageService({
      catalog: catalogWithProjectionDiagnostic,
      pageStore: persistedStore,
    });
    const persistedProjection = await persistedService.readPublicProjection(
      "home",
      {
        pathname: "/",
      },
    );
    expect(persistedProjection.diagnostics).toContainEqual(
      catalogProjectionDiagnostic,
    );
  });

  test("deduplicates page omission diagnostics when catalog projection already emits them", async () => {
    const store = createMemoryPageStore();
    store.seed({
      pageKey: "home",
      title: "persisted title",
      description: "persisted description",
      blocks: [
        {
          type: "hero",
          version: 1,
          data: siteCmsCatalog.readPageSnapshot("home").blocks[0].data,
        },
        {
          type: "text-section",
          version: 1,
          data: {},
        } as unknown as BlockInstance,
      ],
      revision: 1,
    });
    const catalogWithOmissionDiagnostic: CmsCatalog = {
      ...siteCmsCatalog,
      projectPublic(snapshot, context) {
        const projection = siteCmsCatalog.projectPublic(snapshot, context);
        return {
          ...projection,
          diagnostics: [
            ...projection.diagnostics,
            {
              code: cmsDiagnosticCodes.pagePublicOmittedBrokenBlocks,
              message:
                "Some persisted blocks were omitted from public rendering because they are unsupported or broken.",
            },
          ],
        };
      },
    };
    const service = createCmsPageService({
      catalog: catalogWithOmissionDiagnostic,
      pageStore: store,
    });

    const projection = await service.readPublicProjection("home", {
      pathname: "/",
    });
    expect(
      projection.diagnostics.filter(
        ({ code }) => code === cmsDiagnosticCodes.pagePublicOmittedBrokenBlocks,
      ),
    ).toHaveLength(1);
  });

  test("public projection falls back to defaults when required leading blocks are invalid", async () => {
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

    const projection = await service.readPublicProjection("home", {
      pathname: "/",
    });

    expect(projection.blocks).toEqual(
      siteCmsCatalog.readPageSnapshot("home").blocks,
    );
    expect(
      projection.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === cmsDiagnosticCodes.pagePublicFallbackDefaults,
      ),
    ).toBe(true);
  });

  test("keeps invalid persisted block order recoverable in admin while public falls back to defaults", async () => {
    const store = createMemoryPageStore();
    const defaultBlocks = siteCmsCatalog.readPageSnapshot("home").blocks;
    store.seed({
      pageKey: "home",
      title: "misordered persisted title",
      description: "misordered persisted description",
      blocks: [
        {
          definitionKey: "text-first",
          type: "text-section",
          version: 1,
          data: {
            headline: "First but invalid for page rule",
            body: "This block should follow hero",
            variant: "plain",
          },
        },
        {
          ...defaultBlocks[0],
          definitionKey: "hero-second",
        },
      ],
      revision: 1,
    });
    const service = createCmsPageService({
      catalog: siteCmsCatalog,
      pageStore: store,
    });

    const editorModel = await service.readEditorModel("home");
    expect(editorModel.pageSnapshot.blocks).toMatchObject([
      { definitionKey: "text-first", type: "text-section" },
      { definitionKey: "hero-second", type: "hero" },
    ]);
    expect(editorModel.diagnostics).toContainEqual({
      code: cmsDiagnosticCodes.pagePublicFallbackDefaults,
      message:
        "Persisted page structure is invalid for public rendering. Falling back to default page content.",
    });

    const projection = await service.readPublicProjection("home", {
      pathname: "/",
    });
    expect(projection.blocks).toEqual(defaultBlocks);
    expect(
      projection.diagnostics.filter(
        (diagnostic) =>
          diagnostic.code === cmsDiagnosticCodes.pagePublicFallbackDefaults,
      ),
    ).toHaveLength(1);
  });

  test("keeps unsupported block types recoverable in admin and omits them from public", async () => {
    const store = createMemoryPageStore();
    store.seed({
      pageKey: "home",
      title: "persisted title",
      description: "persisted description",
      blocks: [
        {
          type: "hero",
          version: 1,
          data: siteCmsCatalog.readPageSnapshot("home").blocks[0].data,
        },
        {
          type: "legacy-cta",
          version: 1,
          data: { label: "Legacy CTA" },
        } as unknown as BlockInstance,
      ],
      revision: 1,
    });
    const service = createCmsPageService({
      catalog: siteCmsCatalog,
      pageStore: store,
    });

    const editorModel = await service.readEditorModel("home");
    expect(editorModel.pageSnapshot.blocks).toHaveLength(2);
    expect(editorModel.pageSnapshot.blocks[1]).toMatchObject({
      type: "legacy-cta",
      version: 1,
      data: { label: "Legacy CTA" },
    });
    expect(editorModel.diagnostics).toContainEqual({
      code: cmsDiagnosticCodes.blockUnsupportedType,
      message:
        'Persisted block "legacy-cta" on page "home" is no longer supported. Keep it editable in admin and omit it from public.',
      blockType: "legacy-cta",
      blockIndex: 1,
    });

    const projection = await service.readPublicProjection("home", {
      pathname: "/",
    });
    expect(projection.blocks).toHaveLength(1);
    expect(projection.blocks[0].type).toBe("hero");
    expect(
      projection.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === cmsDiagnosticCodes.blockUnsupportedType,
      ),
    ).toBe(true);
    expect(
      projection.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === cmsDiagnosticCodes.pagePublicOmittedBrokenBlocks,
      ),
    ).toBe(true);
  });

  test("keeps disallowed block types recoverable in admin and omits them from public", async () => {
    const pageDefaults = siteCmsCatalog.readPageSnapshot("home");
    const constrainedCatalog = createCmsCatalog({
      blocks: [
        siteCmsCatalog.getBlockDefinition("hero"),
        siteCmsCatalog.getBlockDefinition("text-section"),
      ],
      pages: [
        definePageDefinition({
          pageKey: "home",
          defaults: {
            title: "fallback title",
            description: "fallback description",
            blocks: [
              {
                definitionKey: "hero-main",
                type: "hero",
                version: 1,
                data: pageDefaults.blocks[0].data,
              },
            ],
          },
          rules: {
            allowedBlockTypes: ["hero"],
            requiredLeadingBlockTypes: ["hero"],
          },
        }),
      ],
    });
    const store = createMemoryPageStore();
    store.seed({
      pageKey: "home",
      title: "persisted title",
      description: "persisted description",
      blocks: [
        {
          type: "hero",
          version: 1,
          data: pageDefaults.blocks[0].data,
        },
        {
          type: "text-section",
          version: 1,
          data: {
            headline: "legacy section",
            body: "legacy body",
            variant: "plain",
          },
        },
      ],
      revision: 1,
    });
    const service = createCmsPageService({
      catalog: constrainedCatalog,
      pageStore: store,
    });

    const editorModel = await service.readEditorModel("home");
    expect(editorModel.pageSnapshot.blocks).toHaveLength(2);
    expect(editorModel.pageSnapshot.blocks[1]).toMatchObject({
      type: "text-section",
      version: 1,
      data: {
        headline: "legacy section",
        body: "legacy body",
        variant: "plain",
      },
    });
    expect(editorModel.diagnostics).toContainEqual({
      code: cmsDiagnosticCodes.blockDisallowedType,
      message:
        'Persisted block "text-section" on page "home" is no longer allowed on this page. Keep it editable in admin and omit it from public.',
      blockType: "text-section",
      blockIndex: 1,
    });

    const projection = await service.readPublicProjection("home", {
      pathname: "/",
    });
    expect(projection.blocks).toHaveLength(1);
    expect(projection.blocks[0].type).toBe("hero");
    expect(
      projection.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === cmsDiagnosticCodes.blockDisallowedType,
      ),
    ).toBe(true);
    expect(
      projection.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === cmsDiagnosticCodes.pagePublicOmittedBrokenBlocks,
      ),
    ).toBe(true);
  });

  test("flags unsupported block versions, keeps them recoverable in admin, and omits them from public", async () => {
    const store = createMemoryPageStore();
    store.seed({
      pageKey: "home",
      title: "persisted title",
      description: "persisted description",
      blocks: [
        {
          type: "hero",
          version: 1,
          data: siteCmsCatalog.readPageSnapshot("home").blocks[0].data,
        },
        {
          type: "text-section",
          version: 999,
          data: {
            headline: "legacy",
            body: "legacy body",
            variant: "plain",
          },
        },
      ],
      revision: 1,
    });
    const service = createCmsPageService({
      catalog: siteCmsCatalog,
      pageStore: store,
    });

    const editorModel = await service.readEditorModel("home");
    expect(editorModel.pageSnapshot.blocks[1]).toMatchObject({
      type: "text-section",
      version: 999,
    });
    expect(editorModel.diagnostics).toContainEqual({
      code: cmsDiagnosticCodes.blockUnsupportedVersion,
      message:
        'Persisted block "text-section" on page "home" has unsupported version 999. Keep it editable in admin and omit it from public.',
      blockType: "text-section",
      blockIndex: 1,
      fromVersion: 999,
      toVersion: 1,
    });

    const projection = await service.readPublicProjection("home", {
      pathname: "/",
    });
    expect(projection.blocks).toHaveLength(1);
    expect(projection.blocks[0].type).toBe("hero");
    expect(
      projection.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === cmsDiagnosticCodes.blockUnsupportedVersion,
      ),
    ).toBe(true);
    expect(
      projection.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === cmsDiagnosticCodes.pagePublicOmittedBrokenBlocks,
      ),
    ).toBe(true);
  });

  test("migrates a persisted block at read time and reports migration diagnostics", async () => {
    const migratableCatalog = createCmsCatalog({
      blocks: [
        defineBlockDefinition({
          type: "text-section",
          version: 2,
          schema: siteCmsCatalog.getBlockDefinition("text-section").schema,
          migrate({ fromVersion, data }) {
            if (fromVersion !== 1) return null;
            const legacy = data as { headline?: string; body?: string };
            return {
              version: 2,
              data: {
                headline: legacy.headline ?? "",
                body: legacy.body ?? "",
                variant: "plain",
              },
            };
          },
          render: () => null,
        }),
      ],
      pages: [
        definePageDefinition({
          pageKey: "home",
          defaults: {
            title: "fallback title",
            description: "fallback description",
            blocks: [
              {
                type: "text-section",
                version: 2,
                data: {
                  headline: "default",
                  body: "default",
                  variant: "plain",
                },
              },
            ],
          },
          rules: {
            allowedBlockTypes: ["text-section"],
            requiredLeadingBlockTypes: ["text-section"],
          },
        }),
      ],
    });

    const store = createMemoryPageStore();
    store.seed({
      pageKey: "home",
      title: "persisted title",
      description: "persisted description",
      blocks: [
        {
          type: "text-section",
          version: 1,
          data: {
            headline: "legacy",
            body: "legacy body",
          },
        },
      ],
      revision: 1,
    });

    const service = createCmsPageService({
      catalog: migratableCatalog,
      pageStore: store,
    });

    const resolved = await service.readPage("home");
    expect(resolved.pageSnapshot.blocks[0].version).toBe(2);
    expect(resolved.diagnostics).toContainEqual({
      code: cmsDiagnosticCodes.blockMigrated,
      message:
        'Persisted block "text-section" on page "home" was migrated from version 1 to 2.',
      blockType: "text-section",
      blockIndex: 0,
      fromVersion: 1,
      toVersion: 2,
    });
  });

  test("keeps a block recoverable when runtime migration output is invalid", async () => {
    const migratableCatalog = createCmsCatalog({
      blocks: [
        defineBlockDefinition({
          type: "text-section",
          version: 2,
          schema: siteCmsCatalog.getBlockDefinition("text-section").schema,
          migrate({ fromVersion }) {
            if (fromVersion !== 1) return null;
            return {
              version: 2,
              data: {
                headline: 42,
              },
            } as unknown as {
              version: 2;
              data: {
                headline: string;
                body: string;
                variant: "plain" | "highlight";
              };
            };
          },
          render: () => null,
        }),
      ],
      pages: [
        definePageDefinition({
          pageKey: "home",
          defaults: {
            title: "fallback title",
            description: "fallback description",
            blocks: [
              {
                definitionKey: "main-section",
                type: "text-section",
                version: 2,
                data: {
                  headline: "default",
                  body: "default",
                  variant: "plain",
                },
              },
            ],
          },
          rules: {
            allowedBlockTypes: ["text-section"],
            requiredLeadingBlockTypes: ["text-section"],
          },
        }),
      ],
    });

    const store = createMemoryPageStore();
    const legacyBlock = {
      definitionKey: "main-section",
      type: "text-section",
      version: 1,
      data: {
        headline: "legacy",
        body: "legacy body",
      },
    } as unknown as BlockInstance;
    store.seed({
      pageKey: "home",
      title: "persisted title",
      description: "persisted description",
      blocks: [legacyBlock],
      revision: 1,
    });

    const service = createCmsPageService({
      catalog: migratableCatalog,
      pageStore: store,
    });

    const editorModel = await service.readEditorModel("home");
    expect(editorModel.pageSnapshot.blocks[0]).toMatchObject(legacyBlock);
    expect(
      editorModel.diagnostics.some(
        (diagnostic) => diagnostic.code === cmsDiagnosticCodes.blockMigrated,
      ),
    ).toBe(false);
    expect(editorModel.diagnostics).toContainEqual({
      code: cmsDiagnosticCodes.blockBrokenData,
      message:
        'Persisted block "text-section" on page "home" has invalid data. Keep it editable in admin and omit it from public.',
      blockType: "text-section",
      blockIndex: 0,
    });

    const projection = await service.readPublicProjection("home", {
      pathname: "/",
    });
    expect(projection.blocks).toHaveLength(1);
    expect(projection.blocks[0]).toMatchObject(
      migratableCatalog.readPageSnapshot("home").blocks[0],
    );
    expect(
      projection.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === cmsDiagnosticCodes.pagePublicFallbackDefaults,
      ),
    ).toBe(true);

    const result = await service.applyPageCommand({
      type: "set-page-meta",
      pageKey: "home",
      baseRevision: 1,
      title: "updated title",
      description: "updated description",
    });
    expect(result.status).toBe("saved");
    expect(store.peek("home")?.blocks[0]).toMatchObject(legacyBlock);
  });

  test("migrates a persisted page snapshot at read time and reports page migration diagnostics", async () => {
    const migratableCatalog = createCmsCatalog({
      blocks: [siteCmsCatalog.getBlockDefinition("text-section")],
      pages: [
        definePageDefinition({
          pageKey: "home",
          defaults: {
            title: "fallback title",
            description: "fallback description",
            blocks: [
              {
                definitionKey: "main-section",
                type: "text-section",
                version: 1,
                data: {
                  headline: "default",
                  body: "default",
                  variant: "plain",
                },
              },
            ],
          },
          rules: {
            allowedBlockTypes: ["text-section"],
            requiredLeadingBlockTypes: ["text-section"],
          },
          migrate({ snapshot }) {
            if (!snapshot.title.startsWith("legacy: ")) {
              return null;
            }

            return {
              ...snapshot,
              title: snapshot.title.replace("legacy: ", ""),
              description: `${snapshot.description} (migrated)`,
            };
          },
        }),
      ],
    });

    const store = createMemoryPageStore();
    store.seed({
      pageKey: "home",
      title: "legacy: persisted title",
      description: "persisted description",
      blocks: [
        {
          definitionKey: "main-section",
          type: "text-section",
          version: 1,
          data: {
            headline: "legacy",
            body: "legacy body",
            variant: "plain",
          },
        },
      ],
      revision: 1,
    });

    const service = createCmsPageService({
      catalog: migratableCatalog,
      pageStore: store,
    });

    const resolved = await service.readPage("home");
    expect(resolved.pageSnapshot.title).toBe("persisted title");
    expect(resolved.pageSnapshot.description).toBe(
      "persisted description (migrated)",
    );
    expect(resolved.diagnostics).toContainEqual({
      code: cmsDiagnosticCodes.pageMigrated,
      message: 'Persisted page "home" was migrated at read time.',
    });
  });

  test("exposes migration diagnostics through both admin and public read projections", async () => {
    const migratableCatalog = createCmsCatalog({
      blocks: [
        defineBlockDefinition({
          type: "text-section",
          version: 2,
          schema: siteCmsCatalog.getBlockDefinition("text-section").schema,
          migrate({ fromVersion, data }) {
            if (fromVersion !== 1) return null;
            const legacy = data as { headline?: string; body?: string };
            return {
              version: 2,
              data: {
                headline: legacy.headline ?? "",
                body: legacy.body ?? "",
                variant: "plain",
              },
            };
          },
          render: () => null,
        }),
      ],
      pages: [
        definePageDefinition({
          pageKey: "home",
          defaults: {
            title: "fallback title",
            description: "fallback description",
            blocks: [
              {
                type: "text-section",
                version: 2,
                data: {
                  headline: "default",
                  body: "default",
                  variant: "plain",
                },
              },
            ],
          },
          rules: {
            allowedBlockTypes: ["text-section"],
            requiredLeadingBlockTypes: ["text-section"],
          },
          migrate({ snapshot }) {
            if (!snapshot.title.startsWith("legacy: ")) {
              return null;
            }

            return {
              ...snapshot,
              title: snapshot.title.replace("legacy: ", ""),
            };
          },
        }),
      ],
    });
    const store = createMemoryPageStore();
    store.seed({
      pageKey: "home",
      title: "legacy: persisted title",
      description: "persisted description",
      blocks: [
        {
          type: "text-section",
          version: 1,
          data: {
            headline: "legacy",
            body: "legacy body",
          },
        },
      ],
      revision: 1,
    });
    const service = createCmsPageService({
      catalog: migratableCatalog,
      pageStore: store,
    });

    const editorModel = await service.readEditorModel("home");
    expect(
      editorModel.diagnostics.some(
        ({ code }) => code === cmsDiagnosticCodes.pageMigrated,
      ),
    ).toBe(true);
    expect(
      editorModel.diagnostics.some(
        ({ code }) => code === cmsDiagnosticCodes.blockMigrated,
      ),
    ).toBe(true);

    const projection = await service.readPublicProjection("home", {
      pathname: "/",
    });
    expect(
      projection.diagnostics.some(
        ({ code }) => code === cmsDiagnosticCodes.pageMigrated,
      ),
    ).toBe(true);
    expect(
      projection.diagnostics.some(
        ({ code }) => code === cmsDiagnosticCodes.blockMigrated,
      ),
    ).toBe(true);
  });

  test("set-page-meta persists runtime migrations while preserving unsupported blocks", async () => {
    const migratableCatalog = createCmsCatalog({
      blocks: [
        defineBlockDefinition({
          type: "text-section",
          version: 2,
          schema: siteCmsCatalog.getBlockDefinition("text-section").schema,
          migrate({ fromVersion, data }) {
            if (fromVersion !== 1) return null;
            const legacy = data as { headline?: string; body?: string };
            return {
              version: 2,
              data: {
                headline: legacy.headline ?? "",
                body: legacy.body ?? "",
                variant: "plain",
              },
            };
          },
          render: () => null,
        }),
      ],
      pages: [
        definePageDefinition({
          pageKey: "home",
          defaults: {
            title: "fallback title",
            description: "fallback description",
            blocks: [
              {
                type: "text-section",
                version: 2,
                data: {
                  headline: "default",
                  body: "default",
                  variant: "plain",
                },
              },
            ],
          },
          rules: {
            allowedBlockTypes: ["text-section"],
            requiredLeadingBlockTypes: ["text-section"],
          },
        }),
      ],
    });

    const unsupportedBlock = {
      type: "legacy-cta",
      version: 9,
      data: { label: "Legacy", href: "/legacy" },
    } as unknown as BlockInstance;
    const store = createMemoryPageStore();
    store.seed({
      pageKey: "home",
      title: "persisted title",
      description: "persisted description",
      blocks: [
        {
          type: "text-section",
          version: 1,
          data: {
            headline: "legacy",
            body: "legacy body",
          },
        },
        unsupportedBlock,
      ],
      revision: 1,
    });

    const service = createCmsPageService({
      catalog: migratableCatalog,
      pageStore: store,
    });

    const result = await service.applyPageCommand({
      type: "set-page-meta",
      pageKey: "home",
      baseRevision: 1,
      title: "updated title",
      description: "updated description",
    });

    expect(result.status).toBe("saved");
    const persisted = store.peek("home");
    expect(persisted?.blocks[0]).toMatchObject({
      type: "text-section",
      version: 2,
      data: {
        headline: "legacy",
        body: "legacy body",
        variant: "plain",
      },
    });
    expect(persisted?.blocks[1]).toMatchObject(unsupportedBlock);
  });

  test("set-block-data persists runtime page migrations as part of the normalized snapshot", async () => {
    const migratableCatalog = createCmsCatalog({
      blocks: [siteCmsCatalog.getBlockDefinition("text-section")],
      pages: [
        definePageDefinition({
          pageKey: "home",
          defaults: {
            title: "fallback title",
            description: "fallback description",
            blocks: [
              {
                definitionKey: "main-section",
                type: "text-section",
                version: 1,
                data: {
                  headline: "default",
                  body: "default",
                  variant: "plain",
                },
              },
            ],
          },
          rules: {
            allowedBlockTypes: ["text-section"],
            requiredLeadingBlockTypes: ["text-section"],
          },
          migrate({ snapshot }) {
            if (!snapshot.title.startsWith("legacy: ")) {
              return null;
            }

            return {
              ...snapshot,
              title: snapshot.title.replace("legacy: ", ""),
            };
          },
        }),
      ],
    });

    const store = createMemoryPageStore();
    store.seed({
      pageKey: "home",
      title: "legacy: persisted title",
      description: "persisted description",
      blocks: [
        {
          definitionKey: "main-section",
          type: "text-section",
          version: 1,
          data: {
            headline: "legacy",
            body: "legacy body",
            variant: "plain",
          },
        },
      ],
      revision: 1,
    });

    const service = createCmsPageService({
      catalog: migratableCatalog,
      pageStore: store,
    });

    const result = await service.applyPageCommand({
      type: "set-block-data",
      pageKey: "home",
      baseRevision: 1,
      ref: refByDefinitionKey("main-section"),
      blockType: "text-section",
      blockVersion: 1,
      data: {
        headline: "updated",
        body: "updated body",
        variant: "plain",
      },
    });

    expect(result.status).toBe("saved");
    const persisted = store.peek("home");
    expect(persisted?.title).toBe("persisted title");
    expect(persisted?.blocks[0]).toMatchObject({
      definitionKey: "main-section",
      type: "text-section",
      version: 1,
      data: {
        headline: "updated",
        body: "updated body",
        variant: "plain",
      },
    });
  });

  test("set-page-meta persists runtime-migrated blocks as the normalized snapshot", async () => {
    const migratableCatalog = createCmsCatalog({
      blocks: [
        defineBlockDefinition({
          type: "text-section",
          version: 2,
          schema: siteCmsCatalog.getBlockDefinition("text-section").schema,
          migrate({ fromVersion, data }) {
            if (fromVersion !== 1) return null;
            const legacy = data as { headline?: string; body?: string };
            return {
              version: 2,
              data: {
                headline: legacy.headline ?? "",
                body: legacy.body ?? "",
                variant: "plain",
              },
            };
          },
          render: () => null,
        }),
      ],
      pages: [
        definePageDefinition({
          pageKey: "home",
          defaults: {
            title: "fallback title",
            description: "fallback description",
            blocks: [
              {
                type: "text-section",
                version: 2,
                data: {
                  headline: "default",
                  body: "default",
                  variant: "plain",
                },
              },
            ],
          },
          rules: {
            allowedBlockTypes: ["text-section"],
            requiredLeadingBlockTypes: ["text-section"],
          },
        }),
      ],
    });

    const store = createMemoryPageStore();
    store.seed({
      pageKey: "home",
      title: "persisted title",
      description: "persisted description",
      blocks: [
        {
          type: "text-section",
          version: 1,
          data: {
            headline: "legacy",
            body: "legacy body",
          },
        },
      ],
      revision: 1,
    });

    const service = createCmsPageService({
      catalog: migratableCatalog,
      pageStore: store,
    });

    const result = await service.applyPageCommand({
      type: "set-page-meta",
      pageKey: "home",
      baseRevision: 1,
      title: "updated title",
      description: "updated description",
    });

    expect(result.status).toBe("saved");
    expect(store.peek("home")?.blocks[0]).toMatchObject({
      type: "text-section",
      version: 2,
      data: {
        headline: "legacy",
        body: "legacy body",
        variant: "plain",
      },
    });
  });

  test("set-block-data persists runtime migrations while preserving unsupported blocks", async () => {
    const migratableCatalog = createCmsCatalog({
      blocks: [
        defineBlockDefinition({
          type: "text-section",
          version: 2,
          schema: siteCmsCatalog.getBlockDefinition("text-section").schema,
          migrate({ fromVersion, data }) {
            if (fromVersion !== 1) return null;
            const legacy = data as { headline?: string; body?: string };
            return {
              version: 2,
              data: {
                headline: legacy.headline ?? "",
                body: legacy.body ?? "",
                variant: "plain",
              },
            };
          },
          render: () => null,
        }),
      ],
      pages: [
        definePageDefinition({
          pageKey: "home",
          defaults: {
            title: "fallback title",
            description: "fallback description",
            blocks: [
              {
                definitionKey: "main-text",
                type: "text-section",
                version: 2,
                data: {
                  headline: "default",
                  body: "default",
                  variant: "plain",
                },
              },
            ],
          },
          rules: {
            allowedBlockTypes: ["text-section"],
            requiredLeadingBlockTypes: ["text-section"],
          },
        }),
      ],
    });

    const unsupportedBlock = {
      type: "legacy-cta",
      version: 9,
      data: { label: "Legacy", href: "/legacy" },
    } as unknown as BlockInstance;
    const store = createMemoryPageStore();
    store.seed({
      pageKey: "home",
      title: "persisted title",
      description: "persisted description",
      blocks: [
        {
          definitionKey: "main-text",
          type: "text-section",
          version: 1,
          data: {
            headline: "legacy",
            body: "legacy body",
          },
        },
        unsupportedBlock,
      ],
      revision: 1,
    });

    const service = createCmsPageService({
      catalog: migratableCatalog,
      pageStore: store,
    });

    const result = await service.applyPageCommand({
      type: "set-block-data",
      pageKey: "home",
      baseRevision: 1,
      ref: refByDefinitionKey("main-text"),
      blockType: "text-section",
      blockVersion: 2,
      data: {
        headline: "edited",
        body: "edited body",
        variant: "plain",
      },
    });

    expect(result.status).toBe("saved");
    const persisted = store.peek("home");
    expect(persisted?.blocks[0]).toMatchObject({
      definitionKey: "main-text",
      type: "text-section",
      version: 2,
      data: {
        headline: "edited",
        body: "edited body",
        variant: "plain",
      },
    });
    expect(persisted?.blocks[1]).toMatchObject(unsupportedBlock);
  });

  test("set-block-data round-trips unrelated broken blocks unchanged", async () => {
    const store = createMemoryPageStore();
    const defaultBlocks = siteCmsCatalog.readPageSnapshot("home").blocks;
    const brokenBlock = {
      definitionKey: "broken-content",
      type: "text-section",
      version: 1,
      data: {
        headline: 42,
      },
    } as unknown as BlockInstance;
    store.seed({
      pageKey: "home",
      title: "persisted title",
      description: "persisted description",
      blocks: [
        {
          ...defaultBlocks[0],
          definitionKey: "hero-main",
        },
        brokenBlock,
        {
          definitionKey: "editable-text",
          type: "text-section",
          version: 1,
          data: {
            headline: "editable",
            body: "editable body",
            variant: "plain",
          },
        },
      ],
      revision: 1,
    });
    const service = createCmsPageService({
      catalog: siteCmsCatalog,
      pageStore: store,
    });

    const result = await service.applyPageCommand({
      type: "set-block-data",
      pageKey: "home",
      baseRevision: 1,
      ref: refByDefinitionKey("editable-text"),
      blockType: "text-section",
      blockVersion: 1,
      data: {
        headline: "updated",
        body: "updated body",
        variant: "plain",
      },
    });

    expect(result.status).toBe("saved");
    const persisted = store.peek("home");
    expect(persisted?.blocks[1]).toMatchObject(brokenBlock);
    expect(persisted?.blocks[2]).toMatchObject({
      definitionKey: "editable-text",
      type: "text-section",
      version: 1,
      data: {
        headline: "updated",
        body: "updated body",
        variant: "plain",
      },
    });
  });

  test("set-page-meta round-trips unrelated broken blocks unchanged", async () => {
    const store = createMemoryPageStore();
    const defaultBlocks = siteCmsCatalog.readPageSnapshot("home").blocks;
    const brokenBlock = {
      definitionKey: "broken-content",
      type: "text-section",
      version: 1,
      data: {
        headline: 42,
      },
    } as unknown as BlockInstance;
    store.seed({
      pageKey: "home",
      title: "persisted title",
      description: "persisted description",
      blocks: [
        {
          ...defaultBlocks[0],
          definitionKey: "hero-main",
        },
        brokenBlock,
      ],
      revision: 1,
    });
    const service = createCmsPageService({
      catalog: siteCmsCatalog,
      pageStore: store,
    });

    const result = await service.applyPageCommand({
      type: "set-page-meta",
      pageKey: "home",
      baseRevision: 1,
      title: "updated title",
      description: "updated description",
    });

    expect(result.status).toBe("saved");
    const persisted = store.peek("home");
    expect(persisted?.title).toBe("updated title");
    expect(persisted?.description).toBe("updated description");
    expect(persisted?.blocks[1]).toMatchObject(brokenBlock);
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

  test("set-block-data returns conflict when command block type does not match the targeted block", async () => {
    const { service, store, revision } = await setupPersisted();

    const heroBlock = store.peek("home")!.blocks[0];
    const ref = refByPageBlockId(heroBlock.pageBlockId!, 0);

    const result = await service.applyPageCommand({
      type: "set-block-data",
      pageKey: "home",
      baseRevision: revision,
      ref,
      blockType: "text-section",
      blockVersion: 1,
      data: {
        headline: "Wrong target",
        body: "Wrong block type payload",
        variant: "plain",
      },
    });

    expect(result.status).toBe("conflict");
    expect(store.peek("home")?.blocks[0]).toEqual(heroBlock);
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

  test("add-block returns conflict when command blockVersion does not match the registered version", async () => {
    const { service, store, revision } = await setupPersisted();
    const initialCount = store.peek("home")!.blocks.length;

    const result = await service.applyPageCommand({
      type: "add-block",
      pageKey: "home",
      baseRevision: revision,
      blockType: "text-section",
      blockVersion: 999,
      data: {
        headline: "Version mismatch",
        body: "Should fail",
        variant: "plain",
      },
    });

    expect(result.status).toBe("conflict");
    expect(store.peek("home")?.blocks).toHaveLength(initialCount);
    expect(store.peek("home")?.revision).toBe(revision);
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
