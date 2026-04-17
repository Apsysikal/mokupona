import type { BlockRef } from "./blocks/block-ref";
import { UnknownBlockTypeError } from "./catalog";
import type {
  BlockInstance,
  CmsCatalog,
  MetaTag,
  PageKey,
  PageSnapshot,
  PublicProjection,
  PublicProjectionContext,
} from "./catalog";
import {
  createMutationStaleWriteDiagnostic,
  isRuntimeMigrationDiagnosticCode,
  type CmsDiagnostic,
  type CmsDiagnosticCode,
} from "./diagnostics";
import { createPageReader, type PageReader } from "./page-reader.server";
import type {
  AddBlockCommand,
  DeleteBlockCommand,
  MoveBlockDownCommand,
  MoveBlockUpCommand,
  MutableBlockRef,
  PageCommand,
  ResetPageCommand,
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
  ResetPageCommand,
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

export type PublicPageView = {
  meta: MetaTag[];
  blocks: BlockInstance[];
};

export type ResolvedPublicPage = {
  public: PublicPageView;
  resolved: ResolvedPage;
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
  /** Delete the persisted page record, returning the page to default-backed behavior. */
  deletePage(pageKey: PageKey): Promise<void>;
};

export type ApplyPageCommandResult =
  | {
      status: "saved";
      materialization: "created" | "updated" | "reset";
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
  readPublicPage(
    pageKey: PageKey,
    context: PublicProjectionContext,
  ): Promise<ResolvedPublicPage>;
  readEditorModel(pageKey: PageKey): Promise<EditorModel>;
  applyPageCommand(command: PageCommand): Promise<ApplyPageCommandResult>;
};

function defaultBackedPage(
  catalog: CmsCatalog,
  pageKey: PageKey,
  diagnostics: readonly Diagnostic[] = [],
): ResolvedPage {
  return {
    pageKey,
    status: { kind: "default-backed", revision: null },
    pageSnapshot: catalog.readPageSnapshot(pageKey),
    diagnostics,
  };
}

/** Resolve a BlockRef to an index in the blocks array. Returns -1 if not found. */
function resolveBlockIndex(
  blocks: readonly BlockInstance[],
  ref: BlockRef,
): number {
  switch (ref.kind) {
    case "definition-key":
      return blocks.findIndex((b) => b.definitionKey === ref.definitionKey);
    case "page-block-id":
      return blocks.findIndex((b) => b.pageBlockId === ref.pageBlockId);
  }
}

function resolvedPageFromPersisted(
  pageKey: PageKey,
  persistedPage: PersistedPageRecord,
): ResolvedPage {
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
}

function getRequiredLeadingCount(catalog: CmsCatalog, pageKey: PageKey): number {
  return catalog.getPageRule(pageKey).requiredLeadingBlockTypes?.length ?? 0;
}

function canMutateBlockAtIndex(
  index: number,
  requiredLeadingCount: number,
): boolean {
  return index >= requiredLeadingCount;
}

function canMoveBlockUp(index: number, requiredLeadingCount: number): boolean {
  return index > 0 && canMutateBlockAtIndex(index - 1, requiredLeadingCount);
}

function canMoveBlockDown(
  index: number,
  blockCount: number,
  requiredLeadingCount: number,
): boolean {
  return (
    index >= 0 &&
    index < blockCount - 1 &&
    canMutateBlockAtIndex(index, requiredLeadingCount)
  );
}

type Deps = { catalog: CmsCatalog; pageStore: CmsPageStore; reader: PageReader };

/**
 * Apply a block mutation to a persisted snapshot, persist it, and return the result.
 * Handles materialization if the page is still default-backed.
 */
async function applyBlockMutation(
  { pageStore, reader }: Deps,
  command:
    | SetBlockDataCommand
    | MoveBlockUpCommand
    | MoveBlockDownCommand
    | DeleteBlockCommand
    | AddBlockCommand,
  mutate: (blocks: BlockInstance[]) => BlockInstance[] | null,
): Promise<ApplyPageCommandResult> {
  const currentPage = await reader.readAdminPage(command.pageKey);

  // Check concurrency
  if (currentPage.status.kind === "default-backed") {
    if (command.baseRevision !== null) {
      return {
        status: "conflict",
        currentEditorModel: currentPage,
        diagnostics: [createMutationStaleWriteDiagnostic()],
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
        diagnostics: [createMutationStaleWriteDiagnostic()],
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
      return {
        status: "conflict",
        currentEditorModel: await reader.readAdminPage(command.pageKey),
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
    return {
      status: "conflict",
      currentEditorModel: await reader.readAdminPage(command.pageKey),
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

async function applySetBlockData(
  deps: Deps,
  command: SetBlockDataCommand,
): Promise<ApplyPageCommandResult> {
  const { catalog, reader } = deps;
  let definition;
  try {
    definition = catalog.getBlockDefinition(command.blockType);
  } catch (error) {
    if (!(error instanceof UnknownBlockTypeError)) {
      throw error;
    }

    return {
      status: "conflict",
      currentEditorModel: await reader.readAdminPage(command.pageKey),
      diagnostics: [],
    };
  }

  const parseResult = definition.schema.safeParse(command.data);
  if (!parseResult.success) {
    return {
      status: "conflict",
      currentEditorModel: await reader.readAdminPage(command.pageKey),
      diagnostics: [],
    };
  }
  if (command.blockVersion !== definition.version) {
    return {
      status: "conflict",
      currentEditorModel: await reader.readAdminPage(command.pageKey),
      diagnostics: [],
    };
  }

  const validatedData = parseResult.data;

  return applyBlockMutation(deps, command, (blocks) => {
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
}

function applyMoveBlockUp(deps: Deps, command: MoveBlockUpCommand): Promise<ApplyPageCommandResult> {
  const { catalog } = deps;
  return applyBlockMutation(deps, command, (blocks) => {
    const index = resolveBlockIndex(blocks, command.ref);
    const requiredLeadingCount = getRequiredLeadingCount(catalog, command.pageKey);
    if (!canMoveBlockUp(index, requiredLeadingCount)) return null;
    const newIndex = index - 1;

    const updated = [...blocks];
    [updated[newIndex], updated[index]] = [updated[index], updated[newIndex]];
    return updated;
  });
}

function applyMoveBlockDown(deps: Deps, command: MoveBlockDownCommand): Promise<ApplyPageCommandResult> {
  const { catalog } = deps;
  return applyBlockMutation(deps, command, (blocks) => {
    const index = resolveBlockIndex(blocks, command.ref);
    const requiredLeadingCount = getRequiredLeadingCount(catalog, command.pageKey);
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
}

function applyDeleteBlock(deps: Deps, command: DeleteBlockCommand): Promise<ApplyPageCommandResult> {
  const { catalog } = deps;
  return applyBlockMutation(deps, command, (blocks) => {
    const index = resolveBlockIndex(blocks, command.ref);
    const requiredLeadingCount = getRequiredLeadingCount(catalog, command.pageKey);
    if (!canMutateBlockAtIndex(index, requiredLeadingCount)) return null;

    const updated = [...blocks];
    updated.splice(index, 1);
    return updated;
  });
}

async function applyAddBlock(deps: Deps, command: AddBlockCommand): Promise<ApplyPageCommandResult> {
  const { catalog, reader } = deps;
  let definition;
  try {
    definition = catalog.getBlockDefinition(command.blockType);
  } catch (error) {
    if (!(error instanceof UnknownBlockTypeError)) {
      throw error;
    }

    return {
      status: "conflict" as const,
      currentEditorModel: await reader.readAdminPage(command.pageKey),
      diagnostics: [],
    };
  }

  const pageRule = catalog.getPageRule(command.pageKey);
  if (!pageRule.allowedBlockTypes.includes(command.blockType)) {
    return {
      status: "conflict" as const,
      currentEditorModel: await reader.readAdminPage(command.pageKey),
      diagnostics: [],
    };
  }

  const parseResult = definition.schema.safeParse(command.data);
  if (!parseResult.success) {
    return {
      status: "conflict" as const,
      currentEditorModel: await reader.readAdminPage(command.pageKey),
      diagnostics: [],
    };
  }
  if (command.blockVersion !== definition.version) {
    return {
      status: "conflict" as const,
      currentEditorModel: await reader.readAdminPage(command.pageKey),
      diagnostics: [],
    };
  }

  const validatedData = parseResult.data;
  const newBlock: BlockInstance = {
    type: command.blockType,
    version: definition.version,
    data: validatedData,
  };

  return applyBlockMutation(deps, command, (blocks) => [...blocks, newBlock]);
}

async function applySetPageMeta(deps: Deps, command: SetPageMetaCommand): Promise<ApplyPageCommandResult> {
  const { pageStore, reader } = deps;
  const currentPage = await reader.readAdminPage(command.pageKey);

  if (currentPage.status.kind === "default-backed") {
    if (command.baseRevision !== null) {
      return {
        status: "conflict",
        currentEditorModel: currentPage,
        diagnostics: [createMutationStaleWriteDiagnostic()],
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
      return {
        status: "conflict",
        currentEditorModel: await reader.readAdminPage(command.pageKey),
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
      diagnostics: [createMutationStaleWriteDiagnostic()],
    };
  }

  const hasRuntimeMigrations = currentPage.diagnostics.some(
    (diagnostic: CmsDiagnostic) => isRuntimeMigrationDiagnosticCode(diagnostic.code),
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
    return {
      status: "conflict",
      currentEditorModel: await reader.readAdminPage(command.pageKey),
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

async function applyResetPage(deps: Deps, command: ResetPageCommand): Promise<ApplyPageCommandResult> {
  const { catalog, pageStore, reader } = deps;
  const currentPage = await reader.readAdminPage(command.pageKey);

  if (currentPage.status.kind === "default-backed") {
    if (command.baseRevision !== null) {
      return {
        status: "conflict",
        currentEditorModel: currentPage,
        diagnostics: [createMutationStaleWriteDiagnostic()],
      };
    }
    return {
      status: "saved",
      materialization: "reset",
      editorModel: currentPage,
    };
  }

  if (
    command.baseRevision === null ||
    command.baseRevision !== currentPage.status.revision
  ) {
    return {
      status: "conflict",
      currentEditorModel: currentPage,
      diagnostics: [createMutationStaleWriteDiagnostic()],
    };
  }

  await pageStore.deletePage(command.pageKey);

  return {
    status: "saved",
    materialization: "reset",
    editorModel: defaultBackedPage(catalog, command.pageKey),
  };
}

export function createCmsPageService({
  catalog,
  pageStore,
}: {
  catalog: CmsCatalog;
  pageStore: CmsPageStore;
}): CmsPageService {
  const reader = createPageReader({ catalog, pageStore });
  const deps: Deps = { catalog, pageStore, reader };

  return {
    async listEditablePages() {
      return Promise.all(
        catalog.listPageKeys().map(async (pageKey) => {
          const resolved = await reader.readAdminPage(pageKey);
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
      return reader.readAdminPage(pageKey);
    },
    async readPublicProjection(pageKey, context) {
      return reader.readPublicProjection(pageKey, context);
    },
    async readPublicPage(pageKey, context) {
      return reader.readPublicPage(pageKey, context);
    },
    async readEditorModel(pageKey) {
      return reader.readAdminPage(pageKey);
    },
    async applyPageCommand(command) {
      switch (command.type) {
        case "set-page-meta":
          return applySetPageMeta(deps, command);
        case "set-block-data":
          return applySetBlockData(deps, command);
        case "move-block-up":
          return applyMoveBlockUp(deps, command);
        case "move-block-down":
          return applyMoveBlockDown(deps, command);
        case "delete-block":
          return applyDeleteBlock(deps, command);
        case "add-block":
          return applyAddBlock(deps, command);
        case "reset-page":
          return applyResetPage(deps, command);
      }
    },
  };
}
