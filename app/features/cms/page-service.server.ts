import type {
  BlockInstance,
  CmsCatalog,
  PageKey,
  PageSnapshot,
} from "./catalog";

export type Revision = number;

export type Diagnostic =
  | {
      code: "page/default-backed";
      severity: "info";
    }
  | {
      code: "page/persisted";
      severity: "info";
    };

export type PageStatus =
  | {
      kind: "default-backed";
      provenance: "default";
      revision: null;
    }
  | {
      kind: "persisted";
      provenance: "persisted";
      revision: Revision;
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

export type CmsPageStore = {
  readPage(pageKey: PageKey): Promise<PersistedPageRecord | null>;
  writePage(input: {
    expectedRevision: Revision | null;
    page: Omit<PersistedPageRecord, "revision">;
  }): Promise<
    | {
        status: "saved";
        materialization: "created" | "updated";
        persistedPage: PersistedPageRecord;
      }
    | {
        status: "conflict";
        persistedPage: PersistedPageRecord | null;
      }
  >;
};

export type PageCommand = {
  type: "set-page-meta";
  pageKey: PageKey;
  baseRevision: Revision | null;
  title: string;
  description: string;
};

export type ApplyPageCommandResult = {
  status: "saved";
  materialization: "created" | "updated";
  editorModel: EditorModel;
};

export type CmsPageService = {
  listEditablePages(): Promise<readonly EditablePageSummary[]>;
  readPage(pageKey: PageKey): Promise<ResolvedPage>;
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
  const toEditorModel = ({
    pageKey,
    pageSnapshot,
    status,
    diagnostics,
  }: {
    pageKey: PageKey;
    pageSnapshot: PageSnapshot;
    status: PageStatus;
    diagnostics: readonly Diagnostic[];
  }): EditorModel => ({
    pageKey,
    status,
    pageSnapshot,
    diagnostics,
  });

  const toEditablePageSummary = ({
    pageKey,
    pageSnapshot,
    status,
    diagnostics,
  }: {
    pageKey: PageKey;
    pageSnapshot: PageSnapshot;
    status: PageStatus;
    diagnostics: readonly Diagnostic[];
  }): EditablePageSummary => ({
    pageKey,
    title: pageSnapshot.title,
    status,
    diagnostics,
  });

  const readResolvedPage = async (
    pageKey: PageKey,
  ): Promise<{
    pageSnapshot: PageSnapshot;
    status: PageStatus;
    diagnostics: readonly Diagnostic[];
  }> => {
    const persistedPage = await pageStore.readPage(pageKey);

    if (!persistedPage) {
      return {
        status: {
          kind: "default-backed",
          provenance: "default",
          revision: null,
        },
        pageSnapshot: catalog.readPageSnapshot(pageKey),
        diagnostics: [
          {
            code: "page/default-backed",
            severity: "info",
          },
        ],
      };
    }

    return {
      status: {
        kind: "persisted",
        provenance: "persisted",
        revision: persistedPage.revision,
      },
      pageSnapshot: {
        pageKey,
        provenance: "persisted",
        title: persistedPage.title,
        description: persistedPage.description,
        blocks: structuredClone(persistedPage.blocks),
      },
      diagnostics: [
        {
          code: "page/persisted",
          severity: "info",
        },
      ],
    };
  };

  return {
    async listEditablePages() {
      return Promise.all(
        catalog.listPageKeys().map(async (pageKey) =>
          toEditablePageSummary({
            pageKey,
            ...(await readResolvedPage(pageKey)),
          }),
        ),
      );
    },
    async readPage(pageKey) {
      return {
        pageKey,
        ...(await readResolvedPage(pageKey)),
      };
    },
    async readEditorModel(pageKey) {
      return toEditorModel({
        pageKey,
        ...(await readResolvedPage(pageKey)),
      });
    },
    async applyPageCommand(command) {
      const currentPage = await readResolvedPage(command.pageKey);
      const writeResult = await pageStore.writePage({
        expectedRevision: command.baseRevision,
        page: {
          pageKey: command.pageKey,
          title: command.title,
          description: command.description,
          blocks: currentPage.pageSnapshot.blocks,
        },
      });

      if (writeResult.status === "conflict") {
        throw new Error("Page revision conflict");
      }

      return {
        status: "saved",
        materialization: writeResult.materialization,
        editorModel: toEditorModel({
          pageKey: command.pageKey,
          status: {
            kind: "persisted",
            provenance: "persisted",
            revision: writeResult.persistedPage.revision,
          },
          pageSnapshot: {
            pageKey: command.pageKey,
            provenance: "persisted",
            title: writeResult.persistedPage.title,
            description: writeResult.persistedPage.description,
            blocks: structuredClone(writeResult.persistedPage.blocks),
          },
          diagnostics: [
            {
              code: "page/persisted",
              severity: "info",
            },
          ],
        }),
      };
    },
  };
}
