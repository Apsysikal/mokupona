import { describe, expect, test } from "vitest";

import { createCmsPageService } from "./page-service.server";
import { siteCmsCatalog } from "./site-catalog";

function createMemoryPageStore() {
  let page: {
    pageKey: string;
    revision: number;
    title: string;
    description: string;
    blocks: ReturnType<typeof siteCmsCatalog.readPageSnapshot>["blocks"];
  } | null = null;

  return {
    async readPage(pageKey: string) {
      if (!page || page.pageKey !== pageKey) {
        return null;
      }

      return structuredClone(page);
    },
    async writePage({
      expectedRevision,
      page: nextPage,
    }: {
      expectedRevision: number | null;
      page: {
        pageKey: string;
        title: string;
        description: string;
        blocks: ReturnType<typeof siteCmsCatalog.readPageSnapshot>["blocks"];
      };
    }) {
      if (!page) {
        if (expectedRevision !== null) {
          return {
            status: "conflict" as const,
            persistedPage: null,
          };
        }

        page = {
          ...structuredClone(nextPage),
          revision: 1,
        };

        return {
          status: "saved" as const,
          materialization: "created" as const,
          persistedPage: structuredClone(page),
        };
      }

      if (expectedRevision !== page.revision) {
        return {
          status: "conflict" as const,
          persistedPage: structuredClone(page),
        };
      }

      page = {
        ...structuredClone(nextPage),
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

    await expect(service.listEditablePages()).resolves.toEqual([
      {
        pageKey: "home",
        title: "moku pona",
        status: {
          kind: "default-backed",
          provenance: "default",
          revision: null,
        },
        diagnostics: [
          {
            code: "page/default-backed",
            severity: "info",
          },
        ],
      },
    ]);
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
      provenance: "default",
      revision: null,
    });
    expect(editorModel.pageSnapshot.pageKey).toBe("home");
    expect(editorModel.pageSnapshot.provenance).toBe("default");
    expect(editorModel.pageSnapshot.title).toBe("moku pona");
    expect(editorModel.pageSnapshot.description).toBe(
      "A dinner society in Zurich, bringing people together through shared meals, stories, and the joy of discovery.",
    );
    expect(editorModel.diagnostics).toEqual([
      {
        code: "page/default-backed",
        severity: "info",
      },
    ]);
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
        status: {
          kind: "persisted",
          provenance: "persisted",
          revision: 1,
        },
        pageSnapshot: {
          pageKey: "home",
          provenance: "persisted",
          title: "edited title",
          description: "edited description",
        },
      },
    });

    const editorModel = await service.readEditorModel("home");

    expect(editorModel.status).toEqual({
      kind: "persisted",
      provenance: "persisted",
      revision: 1,
    });
    expect(editorModel.pageSnapshot.title).toBe("edited title");
    expect(editorModel.pageSnapshot.description).toBe("edited description");
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
      status: {
        kind: "persisted",
        provenance: "persisted",
        revision: 1,
      },
      pageSnapshot: {
        pageKey: "home",
        provenance: "persisted",
        title: "persisted title",
        description: "persisted description",
      },
      diagnostics: [
        {
          code: "page/persisted",
          severity: "info",
        },
      ],
    });
  });
});
