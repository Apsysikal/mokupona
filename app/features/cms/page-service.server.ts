import type { BlockRef } from "./blocks/block-ref";
import type {
  BlockInstance,
  CmsCatalog,
  PageKey,
  PageSnapshot,
  PublicProjection,
  PublicProjectionContext,
} from "./catalog";
import type {
  AddBlockCommand,
  DeleteBlockCommand,
  MoveBlockDownCommand,
  MoveBlockUpCommand,
  MutableBlockRef,
  PageCommand,
  SetBlockDataCommand,
  SetPageMetaCommand,
} from "./page-commands";
import type { PageStatus, Revision } from "./page-status";

export { formatPageStatus } from "./page-status";
export type { PageStatus, Revision } from "./page-status";
// Re-export command types from the client-safe module so existing importers
// of page-service.server continue to work without changes.
export { createPageCommandBuilder } from "./page-commands";
export type {
  AddBlockCommand,
  DeleteBlockCommand,
  MoveBlockDownCommand,
  MoveBlockUpCommand,
  MutableBlockRef,
  PageCommand,
  PageCommandBuilder,
  SetBlockDataCommand,
  SetPageMetaCommand,
} from "./page-commands";

export type Diagnostic = {
  code:
    | "block/invalid-data"
    | "block/unsupported-type"
    | "block/unsupported-version";
  message: string;
};

export type EditorModel = {
  pageKey: PageKey;
  status: PageStatus;
  pageSnapshot: PageSnapshot;
  diagnostics: readonly Diagnostic[];
};

export type ResolvedPage = {
  pageKey: PageKey;
  status: PageStatus;
  pageSnapshot: PageSnapshot;
  diagnostics: readonly Diagnostic[];
};

export type EditablePageSummary = {
  pageKey: PageKey;
  title: string;
  status: PageStatus;
  diagnostics: readonly Diagnostic[];
};

export type PersistedPageRecord = {
  pageKey: PageKey;
  revision: Revision;
  title: string;
  description: string;
  blocks: BlockInstance[];
};

type WriteSuccess = {
  status: "saved";
  materialization: "created" | "updated";
  persistedPage: PersistedPageRecord;
};

type WriteConflict = {
  status: "conflict";
  persistedPage: PersistedPageRecord | null;
};

export type CmsPageStore = {
  readPage(pageKey: PageKey): Promise<PersistedPageRecord | null>;
  materializePage(input: {
    page: Omit<PersistedPageRecord, "revision">;
  }): Promise<WriteSuccess | WriteConflict>;
  updatePageMeta(input: {
    pageKey: PageKey;
    expectedRevision: Revision;
    title: string;
    description: string;
  }): Promise<WriteSuccess | WriteConflict>;
  /** Write the full page snapshot (meta + blocks) atomically with a revision bump. */
  updatePage(input: {
    pageKey: PageKey;
    expectedRevision: Revision;
    title: string;
    description: string;
    blocks: readonly BlockInstance[];
  }): Promise<WriteSuccess | WriteConflict>;
};

export type ApplyPageCommandResult =
  | {
      status: "saved";
      materialization: "created" | "updated";
      editorModel: EditorModel;
    }
  | {
      status: "conflict";
      currentEditorModel: EditorModel;
      diagnostics: readonly Diagnostic[];
    };

export type CmsPageService = {
  listEditablePages(): Promise<readonly EditablePageSummary[]>;
  isKnownPageKey(pageKey: string): boolean;
  readPage(pageKey: PageKey): Promise<ResolvedPage>;
  readPublicProjection(
    pageKey: PageKey,
    context: PublicProjectionContext,
  ): Promise<PublicProjection>;
  readEditorModel(pageKey: PageKey): Promise<EditorModel>;
  applyPageCommand(command: PageCommand): Promise<ApplyPageCommandResult>;
};

export function createCmsPageService({
  catalog,
  pageStore,
}: {
  catalog: CmsCatalog;
  pageStore: CmsPageStore;
}): CmsPageService {
  const defaultBackedPage = (
    pageKey: PageKey,
    diagnostics: readonly Diagnostic[] = [],
  ): ResolvedPage => ({
    pageKey,
    status: { kind: "default-backed", revision: null },
    pageSnapshot: catalog.readPageSnapshot(pageKey),
    diagnostics,
  });

  const validatePersistedPage = (
    persistedPage: PersistedPageRecord,
  ): readonly Diagnostic[] => {
    const diagnostics: Diagnostic[] = [];

    for (const block of persistedPage.blocks) {
      let definition;

      try {
        definition = catalog.getBlockDefinition(block.type);
      } catch {
        diagnostics.push({
          code: "block/unsupported-type",
          message: `Persisted block "${block.type}" on page "${persistedPage.pageKey}" is no longer supported. Showing defaults instead.`,
        });
        continue;
      }

      if (block.version !== definition.version) {
        diagnostics.push({
          code: "block/unsupported-version",
          message: `Persisted block "${block.type}" on page "${persistedPage.pageKey}" has unsupported version ${block.version}. Showing defaults instead.`,
        });
        continue;
      }

      const result = definition.schema.safeParse(block.data);
      if (!result.success) {
        diagnostics.push({
          code: "block/invalid-data",
          message: `Persisted block "${block.type}" on page "${persistedPage.pageKey}" has invalid data. Showing defaults instead.`,
        });
      }
    }

    return diagnostics;
  };

  const readResolvedPage = async (pageKey: PageKey): Promise<ResolvedPage> => {
    const persistedPage = await pageStore.readPage(pageKey);

    if (!persistedPage) {
      return defaultBackedPage(pageKey);
    }

    const diagnostics = validatePersistedPage(persistedPage);
    if (diagnostics.length > 0) {
      return defaultBackedPage(pageKey, diagnostics);
    }

    return {
      pageKey,
      status: { kind: "persisted", revision: persistedPage.revision },
      pageSnapshot: {
        pageKey,
        provenance: "persisted",
        title: persistedPage.title,
        description: persistedPage.description,
        blocks: structuredClone(persistedPage.blocks),
      },
      diagnostics: [],
    };
  };

  const resolvedPageFromPersisted = (
    pageKey: PageKey,
    persistedPage: PersistedPageRecord,
  ): ResolvedPage => ({
    pageKey,
    status: { kind: "persisted", revision: persistedPage.revision },
    pageSnapshot: {
      pageKey,
      provenance: "persisted",
      title: persistedPage.title,
      description: persistedPage.description,
      blocks: structuredClone(persistedPage.blocks),
    },
    diagnostics: [],
  });

  /** Resolve a BlockRef to an index in the blocks array. Returns -1 if not found. */
  const resolveBlockIndex = (
    blocks: readonly BlockInstance[],
    ref: BlockRef,
  ): number => {
    switch (ref.kind) {
      case "definition-key":
        return blocks.findIndex((b) => b.definitionKey === ref.definitionKey);
      case "page-block-id":
        return blocks.findIndex((b) => b.pageBlockId === ref.pageBlockId);
    }
  };

  /**
   * Apply a block mutation to a persisted snapshot, persist it, and return the result.
   * Handles materialization if the page is still default-backed.
   */
  const applyBlockMutation = async (
    command:
      | SetBlockDataCommand
      | MoveBlockUpCommand
      | MoveBlockDownCommand
      | DeleteBlockCommand
      | AddBlockCommand,
    mutate: (blocks: BlockInstance[]) => BlockInstance[] | null,
  ): Promise<ApplyPageCommandResult> => {
    const currentPage = await readResolvedPage(command.pageKey);

    // Check concurrency
    if (currentPage.status.kind === "default-backed") {
      if (command.baseRevision !== null) {
        return {
          status: "conflict",
          currentEditorModel: currentPage,
          diagnostics: [],
        };
      }
    } else {
      if (
        command.baseRevision === null ||
        command.baseRevision !== currentPage.status.revision
      ) {
        return {
          status: "conflict",
          currentEditorModel: currentPage,
          diagnostics: [],
        };
      }
    }

    const blocks = [...currentPage.pageSnapshot.blocks];
    const mutatedBlocks = mutate(blocks);

    // null signals a rule violation — return a conflict
    if (mutatedBlocks === null) {
      return {
        status: "conflict",
        currentEditorModel: currentPage,
        diagnostics: [],
      };
    }

    if (currentPage.status.kind === "default-backed") {
      const writeResult = await pageStore.materializePage({
        page: {
          pageKey: command.pageKey,
          title: currentPage.pageSnapshot.title,
          description: currentPage.pageSnapshot.description,
          blocks: mutatedBlocks,
        },
      });

      if (writeResult.status === "conflict") {
        const refreshed = await readResolvedPage(command.pageKey);
        return {
          status: "conflict",
          currentEditorModel: refreshed,
          diagnostics: [],
        };
      }

      return {
        status: "saved",
        materialization: writeResult.materialization,
        editorModel: resolvedPageFromPersisted(
          command.pageKey,
          writeResult.persistedPage,
        ),
      };
    }

    const writeResult = await pageStore.updatePage({
      pageKey: command.pageKey,
      expectedRevision: currentPage.status.revision,
      title: currentPage.pageSnapshot.title,
      description: currentPage.pageSnapshot.description,
      blocks: mutatedBlocks,
    });

    if (writeResult.status === "conflict") {
      const refreshed = await readResolvedPage(command.pageKey);
      return {
        status: "conflict",
        currentEditorModel: refreshed,
        diagnostics: [],
      };
    }

    return {
      status: "saved",
      materialization: writeResult.materialization,
      editorModel: resolvedPageFromPersisted(
        command.pageKey,
        writeResult.persistedPage,
      ),
    };
  };

  const applySetBlockData = async (
    command: SetBlockDataCommand,
  ): Promise<ApplyPageCommandResult> => {
    let definition;
    try {
      definition = catalog.getBlockDefinition(command.blockType);
    } catch {
      return {
        status: "conflict",
        currentEditorModel: await readResolvedPage(command.pageKey),
        diagnostics: [],
      };
    }

    const parseResult = definition.schema.safeParse(command.data);
    if (!parseResult.success) {
      return {
        status: "conflict",
        currentEditorModel: await readResolvedPage(command.pageKey),
        diagnostics: [],
      };
    }

    const validatedData = parseResult.data;

    return applyBlockMutation(command, (blocks) => {
      const index = resolveBlockIndex(blocks, command.ref);
      if (index === -1) return null;

      const updated = [...blocks];
      updated[index] = { ...updated[index], data: validatedData };
      return updated;
    });
  };

  const getRequiredLeadingCount = (pageKey: PageKey): number =>
    catalog.getPageRule(pageKey).requiredLeadingBlockTypes?.length ?? 0;

  const canMutateBlockAtIndex = (
    index: number,
    requiredLeadingCount: number,
  ): boolean => index >= requiredLeadingCount;

  const canMoveBlockUp = (
    index: number,
    requiredLeadingCount: number,
  ): boolean =>
    index > 0 && canMutateBlockAtIndex(index - 1, requiredLeadingCount);

  const canMoveBlockDown = (
    index: number,
    blockCount: number,
    requiredLeadingCount: number,
  ): boolean =>
    index >= 0 &&
    index < blockCount - 1 &&
    canMutateBlockAtIndex(index, requiredLeadingCount);

  const applyMoveBlockUp = (
    command: MoveBlockUpCommand,
  ): Promise<ApplyPageCommandResult> => {
    return applyBlockMutation(command, (blocks) => {
      const index = resolveBlockIndex(blocks, command.ref);
      const requiredLeadingCount = getRequiredLeadingCount(command.pageKey);
      if (!canMoveBlockUp(index, requiredLeadingCount)) return null;
      const newIndex = index - 1;

      const updated = [...blocks];
      [updated[newIndex], updated[index]] = [updated[index], updated[newIndex]];
      return updated;
    });
  };

  const applyMoveBlockDown = (
    command: MoveBlockDownCommand,
  ): Promise<ApplyPageCommandResult> => {
    return applyBlockMutation(command, (blocks) => {
      const index = resolveBlockIndex(blocks, command.ref);
      const requiredLeadingCount = getRequiredLeadingCount(command.pageKey);
      if (!canMoveBlockDown(index, blocks.length, requiredLeadingCount)) {
        return null;
      }

      const updated = [...blocks];
      [updated[index], updated[index + 1]] = [
        updated[index + 1],
        updated[index],
      ];
      return updated;
    });
  };

  const applyDeleteBlock = (
    command: DeleteBlockCommand,
  ): Promise<ApplyPageCommandResult> => {
    return applyBlockMutation(command, (blocks) => {
      const index = resolveBlockIndex(blocks, command.ref);
      const requiredLeadingCount = getRequiredLeadingCount(command.pageKey);
      if (!canMutateBlockAtIndex(index, requiredLeadingCount)) return null;

      const updated = [...blocks];
      updated.splice(index, 1);
      return updated;
    });
  };

  const applyAddBlock = (
    command: AddBlockCommand,
  ): Promise<ApplyPageCommandResult> => {
    let definition;
    try {
      definition = catalog.getBlockDefinition(command.blockType);
    } catch {
      return readResolvedPage(command.pageKey).then((currentPage) => ({
        status: "conflict" as const,
        currentEditorModel: currentPage,
        diagnostics: [],
      }));
    }

    const pageRule = catalog.getPageRule(command.pageKey);
    if (!pageRule.allowedBlockTypes.includes(command.blockType)) {
      return readResolvedPage(command.pageKey).then((currentPage) => ({
        status: "conflict" as const,
        currentEditorModel: currentPage,
        diagnostics: [],
      }));
    }

    const parseResult = definition.schema.safeParse(command.data);
    if (!parseResult.success) {
      return readResolvedPage(command.pageKey).then((currentPage) => ({
        status: "conflict" as const,
        currentEditorModel: currentPage,
        diagnostics: [],
      }));
    }

    const validatedData = parseResult.data;
    const newBlock: BlockInstance = {
      type: command.blockType,
      version: command.blockVersion,
      data: validatedData,
    };

    return applyBlockMutation(command, (blocks) => [...blocks, newBlock]);
  };

  const applySetPageMeta = async (
    command: SetPageMetaCommand,
  ): Promise<ApplyPageCommandResult> => {
    const currentPage = await readResolvedPage(command.pageKey);

    if (currentPage.status.kind === "default-backed") {
      if (command.baseRevision !== null) {
        return {
          status: "conflict",
          currentEditorModel: currentPage,
          diagnostics: [],
        };
      }

      const writeResult = await pageStore.materializePage({
        page: {
          pageKey: command.pageKey,
          title: command.title,
          description: command.description,
          blocks: currentPage.pageSnapshot.blocks,
        },
      });

      if (writeResult.status === "conflict") {
        const refreshed = await readResolvedPage(command.pageKey);
        return {
          status: "conflict",
          currentEditorModel: refreshed,
          diagnostics: [],
        };
      }

      return {
        status: "saved",
        materialization: writeResult.materialization,
        editorModel: resolvedPageFromPersisted(
          command.pageKey,
          writeResult.persistedPage,
        ),
      };
    }

    if (
      command.baseRevision === null ||
      command.baseRevision !== currentPage.status.revision
    ) {
      return {
        status: "conflict",
        currentEditorModel: currentPage,
        diagnostics: [],
      };
    }

    const writeResult = await pageStore.updatePageMeta({
      pageKey: command.pageKey,
      expectedRevision: command.baseRevision,
      title: command.title,
      description: command.description,
    });

    if (writeResult.status === "conflict") {
      const refreshed = await readResolvedPage(command.pageKey);
      return {
        status: "conflict",
        currentEditorModel: refreshed,
        diagnostics: [],
      };
    }

    return {
      status: "saved",
      materialization: writeResult.materialization,
      editorModel: resolvedPageFromPersisted(
        command.pageKey,
        writeResult.persistedPage,
      ),
    };
  };

  return {
    async listEditablePages() {
      return Promise.all(
        catalog.listPageKeys().map(async (pageKey) => {
          const resolved = await readResolvedPage(pageKey);
          return {
            pageKey,
            title: resolved.pageSnapshot.title,
            status: resolved.status,
            diagnostics: resolved.diagnostics,
          };
        }),
      );
    },
    isKnownPageKey(pageKey) {
      return catalog.listPageKeys().includes(pageKey);
    },
    async readPage(pageKey) {
      return readResolvedPage(pageKey);
    },
    async readPublicProjection(pageKey, context) {
      const resolved = await readResolvedPage(pageKey);
      return catalog.projectPublic(resolved.pageSnapshot, context);
    },
    async readEditorModel(pageKey) {
      return readResolvedPage(pageKey);
    },
    async applyPageCommand(command) {
      switch (command.type) {
        case "set-page-meta":
          return applySetPageMeta(command);
        case "set-block-data":
          return applySetBlockData(command);
        case "move-block-up":
          return applyMoveBlockUp(command);
        case "move-block-down":
          return applyMoveBlockDown(command);
        case "delete-block":
          return applyDeleteBlock(command);
        case "add-block":
          return applyAddBlock(command);
      }
    },
  };
}
