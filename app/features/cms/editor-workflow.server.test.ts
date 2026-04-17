import { describe, expect, test } from "vitest";

import { refByPageBlockId } from "./blocks/block-ref";
import type { BlockInstance } from "./catalog";
import { createCmsEditorWorkflow } from "./editor-workflow.server";
import { createCmsPageService, type CmsPageStore } from "./page-service.server";
import { siteCmsCatalog } from "./site-catalog";
import { siteLinkTargetRegistry } from "./site-link-targets";

function createMemoryPageStore(): CmsPageStore {
  let page: {
    pageKey: string;
    title: string;
    description: string;
    blocks: BlockInstance[];
    revision: number;
  } | null = null;

  return {
    async readPage(pageKey) {
      if (!page || page.pageKey !== pageKey) return null;
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

      page = { ...page, title, description, revision: page.revision + 1 };
      return {
        status: "saved" as const,
        materialization: "updated" as const,
        persistedPage: structuredClone(page),
      };
    },
    async updatePage({ pageKey, expectedRevision, title, description, blocks }) {
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
    async deletePage(pageKey) {
      if (page?.pageKey === pageKey) page = null;
    },
  };
}

function createWorkflow() {
  const pageService = createCmsPageService({
    catalog: siteCmsCatalog,
    pageStore: createMemoryPageStore(),
  });
  return createCmsEditorWorkflow({
    pageService,
    catalog: siteCmsCatalog,
    linkTargets: siteLinkTargetRegistry,
    prisma: {
      pageBlock: { count: async () => 0 },
      event: { count: async () => 0 },
      image: { count: async () => 0, delete: async () => ({}) },
    },
  });
}

function formData(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value);
  }
  return data;
}

describe("createCmsEditorWorkflow", () => {
  test("loads editor model with workflow resources", async () => {
    const workflow = createWorkflow();

    const loaded = await workflow.loadEditor("home");

    expect(loaded.editorModel.pageKey).toBe("home");
    expect(loaded.linkTargets.targets).toHaveLength(3);
    expect(Object.keys(loaded.blockSchemas).sort()).toEqual([
      "hero",
      "image",
      "text-section",
    ]);
  });

  test("returns validation-error for invalid page-meta input", async () => {
    const workflow = createWorkflow();

    const result = await workflow.mutateFromForm({
      pageKey: "home",
      baseRevision: null,
      formData: formData({
        intent: "set-page-meta",
        title: "",
        description: "desc",
        revision: "",
      }),
      upload: { persistImage: async () => "unused" },
    });

    expect(result.status).toBe("validation-error");
    if (result.status !== "validation-error") return;
    expect(result.blockRef).toBeUndefined();
    expect(result.editorModel.status.kind).toBe("default-backed");
  });

  test("applies add/move/delete/reset through mutateFromForm", async () => {
    const workflow = createWorkflow();

    const addResult = await workflow.mutateFromForm({
      pageKey: "home",
      baseRevision: null,
      formData: formData({
        intent: "add-block",
        blockType: "text-section",
        blockVersion: "1",
      }),
      upload: { persistImage: async () => "unused" },
    });
    expect(addResult.status).toBe("saved");
    if (addResult.status !== "saved") return;
    expect(addResult.materialization).toBe("created");

    const addedBlocks = addResult.editorModel.pageSnapshot.blocks;
    const addedBlock = addedBlocks[addedBlocks.length - 1];
    expect(addedBlock?.pageBlockId).toBeDefined();
    const addedBlockRef = JSON.stringify(
      refByPageBlockId(
        addedBlock?.pageBlockId ?? "missing",
        addResult.editorModel.pageSnapshot.blocks.length - 1,
      ),
    );

    const moveResult = await workflow.mutateFromForm({
      pageKey: "home",
      baseRevision: addResult.editorModel.status.revision,
      formData: formData({
        intent: "move-block-up",
        blockRef: addedBlockRef,
      }),
      upload: { persistImage: async () => "unused" },
    });
    expect(moveResult.status).toBe("saved");

    const movedRevision =
      moveResult.status === "saved" ? moveResult.editorModel.status.revision : null;
    const deleteResult = await workflow.mutateFromForm({
      pageKey: "home",
      baseRevision: movedRevision,
      formData: formData({
        intent: "delete-block",
        blockRef: addedBlockRef,
      }),
      upload: { persistImage: async () => "unused" },
    });
    expect(deleteResult.status).toBe("saved");

    const deleteRevision =
      deleteResult.status === "saved"
        ? deleteResult.editorModel.status.revision
        : null;
    const resetResult = await workflow.mutateFromForm({
      pageKey: "home",
      baseRevision: deleteRevision,
      formData: formData({
        intent: "reset-page",
      }),
      upload: { persistImage: async () => "unused" },
    });
    expect(resetResult).toMatchObject({
      status: "saved",
      materialization: "reset",
      editorModel: {
        status: { kind: "default-backed", revision: null },
      },
    });
  });
});
