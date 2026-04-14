import type { BlockRef } from "./blocks/block-ref";
import { UnknownBlockTypeError } from "./catalog";
import type {
  BlockInstance,
  CmsCatalog,
  PageKey,
  PageSnapshot,
  PublicProjection,
  PublicProjectionContext,
} from "./catalog";
import {
  createBlockBrokenDataDiagnostic,
  createBlockDisallowedTypeDiagnostic,
  createBlockMigratedDiagnostic,
  createBlockUnsupportedTypeDiagnostic,
  createBlockUnsupportedVersionDiagnostic,
  createPageMigratedDiagnostic,
  createPagePublicFallbackDefaultsDiagnostic,
  createPagePublicOmittedBrokenBlocksDiagnostic,
  isRecoverableBlockDiagnosticCode,
  isRuntimeMigrationDiagnosticCode,
  mergeCmsDiagnostics,
  type CmsDiagnostic,
  type CmsDiagnosticCode,
} from "./diagnostics";
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

export type DiagnosticCode = CmsDiagnosticCode;
export type Diagnostic = CmsDiagnostic;

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

  const hasValidRequiredLeadingBlocks = (
    pageKey: PageKey,
    blocks: readonly BlockInstance[],
  ) => {
    const requiredLeading =
      catalog.getPageRule(pageKey).requiredLeadingBlockTypes;
    if (!requiredLeading || requiredLeading.length === 0) {
      return true;
    }

    return requiredLeading.every(
      (requiredType, index) => blocks[index]?.type === requiredType,
    );
  };

  const normalizePersistedBlocks = ({
    pageKey,
    blocks,
  }: {
    pageKey: PageKey;
    blocks: readonly BlockInstance[];
  }): {
    adminBlocks: BlockInstance[];
    publicBlocks: BlockInstance[];
    diagnostics: Diagnostic[];
  } => {
    const adminBlocks: BlockInstance[] = [];
    const publicBlocks: BlockInstance[] = [];
    const diagnostics: Diagnostic[] = [];
    const allowedBlockTypes = new Set(
      catalog.getPageRule(pageKey).allowedBlockTypes,
    );
    const pushUnsupportedVersionDiagnostic = (input: {
      blockType: string;
      blockIndex: number;
      fromVersion: number;
      toVersion: number;
    }) => {
      diagnostics.push(
        createBlockUnsupportedVersionDiagnostic({
          pageKey,
          ...input,
        }),
      );
    };

    for (const [index, block] of blocks.entries()) {
      const clonedBlock = structuredClone(block);
      let definition;

      try {
        definition = catalog.getBlockDefinition(clonedBlock.type);
      } catch (error) {
        if (!(error instanceof UnknownBlockTypeError)) {
          throw error;
        }

        diagnostics.push(
          createBlockUnsupportedTypeDiagnostic({
            pageKey,
            blockType: clonedBlock.type,
            blockIndex: index,
          }),
        );
        adminBlocks.push(clonedBlock);
        continue;
      }

      if (!allowedBlockTypes.has(clonedBlock.type)) {
        diagnostics.push(
          createBlockDisallowedTypeDiagnostic({
            pageKey,
            blockType: clonedBlock.type,
            blockIndex: index,
          }),
        );
        adminBlocks.push(clonedBlock);
        continue;
      }

      let normalizedBlock = clonedBlock;
      let migratedFromVersion: number | null = null;

      if (normalizedBlock.version !== definition.version) {
        const migration = definition.migrate?.({
          fromVersion: normalizedBlock.version,
          data: normalizedBlock.data,
        });

        if (!migration) {
          pushUnsupportedVersionDiagnostic({
            blockType: normalizedBlock.type,
            blockIndex: index,
            fromVersion: normalizedBlock.version,
            toVersion: definition.version,
          });
          adminBlocks.push(normalizedBlock);
          continue;
        }

        if (migration.version !== definition.version) {
          pushUnsupportedVersionDiagnostic({
            blockType: normalizedBlock.type,
            blockIndex: index,
            fromVersion: normalizedBlock.version,
            toVersion: definition.version,
          });
          adminBlocks.push(normalizedBlock);
          continue;
        }

        migratedFromVersion = normalizedBlock.version;
        normalizedBlock = {
          ...normalizedBlock,
          version: migration.version,
          data: migration.data,
        };
      }

      const result = definition.schema.safeParse(normalizedBlock.data);
      if (!result.success) {
        diagnostics.push(
          createBlockBrokenDataDiagnostic({
            pageKey,
            blockType: normalizedBlock.type,
            blockIndex: index,
          }),
        );
        adminBlocks.push(clonedBlock);
        continue;
      }

      const validatedBlock: BlockInstance = {
        ...normalizedBlock,
        data: result.data,
      };
      if (migratedFromVersion !== null) {
        diagnostics.push(
          createBlockMigratedDiagnostic({
            pageKey,
            blockType: validatedBlock.type,
            blockIndex: index,
            fromVersion: migratedFromVersion,
            toVersion: validatedBlock.version,
          }),
        );
      }
      adminBlocks.push(validatedBlock);
      publicBlocks.push(validatedBlock);
    }

    return { adminBlocks, publicBlocks, diagnostics };
  };

  const readResolvedPage = async (pageKey: PageKey): Promise<ResolvedPage> => {
    const persistedPage = await pageStore.readPage(pageKey);

    if (!persistedPage) {
      return defaultBackedPage(pageKey);
    }

    const migratedSnapshot = catalog.migratePageSnapshot({
      snapshot: {
        pageKey,
        provenance: "persisted",
        title: persistedPage.title,
        description: persistedPage.description,
        blocks: persistedPage.blocks,
      },
    });
    const normalized = normalizePersistedBlocks({
      pageKey,
      blocks: migratedSnapshot.snapshot.blocks,
    });
    const diagnostics = [...normalized.diagnostics];
    if (migratedSnapshot.migrated) {
      diagnostics.push(createPageMigratedDiagnostic(pageKey));
    }
    if (!hasValidRequiredLeadingBlocks(pageKey, normalized.publicBlocks)) {
      diagnostics.push(createPagePublicFallbackDefaultsDiagnostic());
    }

    return {
      pageKey,
      status: { kind: "persisted", revision: persistedPage.revision },
      pageSnapshot: {
        pageKey,
        provenance: "persisted",
        title: migratedSnapshot.snapshot.title,
        description: migratedSnapshot.snapshot.description,
        blocks: normalized.adminBlocks,
      },
      diagnostics,
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
    } catch (error) {
      if (!(error instanceof UnknownBlockTypeError)) {
        throw error;
      }

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
    if (command.blockVersion !== definition.version) {
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
      const targetBlock = blocks[index];
      if (
        targetBlock.type !== command.blockType ||
        targetBlock.version !== definition.version
      ) {
        return null;
      }

      const updated = [...blocks];
      updated[index] = { ...targetBlock, data: validatedData };
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
    } catch (error) {
      if (!(error instanceof UnknownBlockTypeError)) {
        throw error;
      }

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
    if (command.blockVersion !== definition.version) {
      return readResolvedPage(command.pageKey).then((currentPage) => ({
        status: "conflict" as const,
        currentEditorModel: currentPage,
        diagnostics: [],
      }));
    }

    const validatedData = parseResult.data;
    const newBlock: BlockInstance = {
      type: command.blockType,
      version: definition.version,
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

    const hasRuntimeMigrations = currentPage.diagnostics.some((diagnostic) =>
      isRuntimeMigrationDiagnosticCode(diagnostic.code),
    );
    const writeResult = hasRuntimeMigrations
      ? await pageStore.updatePage({
          pageKey: command.pageKey,
          expectedRevision: command.baseRevision,
          title: command.title,
          description: command.description,
          blocks: currentPage.pageSnapshot.blocks,
        })
      : await pageStore.updatePageMeta({
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
      if (resolved.status.kind === "default-backed") {
        const projection = catalog.projectPublic(
          resolved.pageSnapshot,
          context,
        );
        return {
          ...projection,
          diagnostics: mergeCmsDiagnostics(
            projection.diagnostics,
            resolved.diagnostics,
          ),
        };
      }

      const omitDiagnostics = resolved.diagnostics.filter((diagnostic) =>
        isRecoverableBlockDiagnosticCode(diagnostic.code),
      );
      const omittedBlockIndexes = new Set(
        omitDiagnostics.flatMap((diagnostic) =>
          typeof diagnostic.blockIndex === "number"
            ? [diagnostic.blockIndex]
            : [],
        ),
      );
      const publicBlocks = resolved.pageSnapshot.blocks.filter((_, index) => {
        return !omittedBlockIndexes.has(index);
      });

      if (!hasValidRequiredLeadingBlocks(pageKey, publicBlocks)) {
        const fallbackSnapshot = catalog.readPageSnapshot(pageKey);
        const projection = catalog.projectPublic(fallbackSnapshot, context);
        return {
          ...projection,
          diagnostics: mergeCmsDiagnostics(
            projection.diagnostics,
            resolved.diagnostics,
            [createPagePublicFallbackDefaultsDiagnostic()],
          ),
        };
      }

      const projection = catalog.projectPublic(
        {
          ...resolved.pageSnapshot,
          blocks: publicBlocks,
        },
        context,
      );
      const publicDiagnostics = mergeCmsDiagnostics(
        projection.diagnostics,
        resolved.diagnostics,
      );
      if (publicBlocks.length !== resolved.pageSnapshot.blocks.length) {
        return {
          ...projection,
          diagnostics: mergeCmsDiagnostics(publicDiagnostics, [
            createPagePublicOmittedBrokenBlocksDiagnostic(),
          ]),
        };
      }
      return { ...projection, diagnostics: publicDiagnostics };
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
