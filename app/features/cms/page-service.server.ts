import type {
  BlockInstance,
  CmsCatalog,
  PageKey,
  PageSnapshot,
  PublicProjection,
  PublicProjectionContext,
} from "./catalog";
import type { PageStatus, Revision } from "./page-status";

export { formatPageStatus } from "./page-status";
export type { PageStatus, Revision } from "./page-status";

export type Diagnostic = never;

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
};

export type PageCommand = {
  type: "set-page-meta";
  pageKey: PageKey;
  baseRevision: Revision | null;
  title: string;
  description: string;
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
  const readResolvedPage = async (pageKey: PageKey): Promise<ResolvedPage> => {
    const persistedPage = await pageStore.readPage(pageKey);

    if (!persistedPage) {
      return {
        pageKey,
        status: { kind: "default-backed", revision: null },
        pageSnapshot: catalog.readPageSnapshot(pageKey),
        diagnostics: [],
      };
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

  return {
    async listEditablePages() {
      return Promise.all(
        catalog.listPageKeys().map(async (pageKey) => {
          const resolved = await readResolvedPage(pageKey);
          return {
            pageKey,
            title: resolved.pageSnapshot.title,
            status: resolved.status,
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
    },
  };
}
