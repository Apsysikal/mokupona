import { UnknownBlockTypeError } from "./catalog";
import type {
  BlockInstance,
  CmsCatalog,
  PageKey,
  PageSnapshot,
  Provenance,
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
  mergeCmsDiagnostics,
  type CmsDiagnostic,
} from "./diagnostics";
import type { PageStatus } from "./page-status";
import type {
  CmsPageStore,
  PublicPageView,
  ResolvedPage,
  ResolvedPublicPage,
} from "./page-service.server";

// ── Internal structural types ─────────────────────────────────────────────────

type KeptEntry = {
  kind: "kept";
  block: BlockInstance;
  includeInPublic: true;
};

type AdminOnlyEntry = {
  kind: "admin-only";
  block: BlockInstance;
  includeInPublic: false;
  reason: CmsDiagnostic;
};

type DroppedEntry = {
  kind: "dropped";
  original: BlockInstance;
  includeInPublic: false;
  reason: CmsDiagnostic;
};

export type BlockEntry = KeptEntry | AdminOnlyEntry | DroppedEntry;

type NormalizedOutcome =
  | { kind: "normalized"; entries: BlockEntry[] }
  | {
      kind: "public-fallback-defaults";
      entries: BlockEntry[];
      fallbackBlocks: BlockInstance[];
      reason: CmsDiagnostic;
    };

type NormalizedPage = {
  pageKey: PageKey;
  status: PageStatus;
  meta: { title: string; description: string; provenance: Provenance };
  outcome: NormalizedOutcome;
  diagnostics: readonly CmsDiagnostic[];
};

// ── Public interface ──────────────────────────────────────────────────────────

export type PageReader = {
  readAdminPage(pageKey: PageKey): Promise<ResolvedPage>;
  readPublicPage(
    pageKey: PageKey,
    context: PublicProjectionContext,
  ): Promise<ResolvedPublicPage>;
  readPublicProjection(
    pageKey: PageKey,
    context: PublicProjectionContext,
  ): Promise<PublicProjection>;
};

// ── Private helpers ───────────────────────────────────────────────────────────

function hasValidRequiredLeadingBlocks(
  catalog: CmsCatalog,
  pageKey: PageKey,
  blocks: readonly BlockInstance[],
): boolean {
  const requiredLeading = catalog.getPageRule(pageKey).requiredLeadingBlockTypes;
  if (!requiredLeading || requiredLeading.length === 0) return true;
  return requiredLeading.every(
    (requiredType, index) => blocks[index]?.type === requiredType,
  );
}

function resolvedPageFromNormalized(normalized: NormalizedPage): ResolvedPage {
  const adminBlocks = normalized.outcome.entries
    .filter(
      (e): e is KeptEntry | AdminOnlyEntry =>
        e.kind === "kept" || e.kind === "admin-only",
    )
    .map((e) => e.block);

  return {
    pageKey: normalized.pageKey,
    status: normalized.status,
    pageSnapshot: {
      pageKey: normalized.pageKey,
      provenance: normalized.meta.provenance,
      title: normalized.meta.title,
      description: normalized.meta.description,
      blocks: adminBlocks,
    },
    diagnostics: normalized.diagnostics,
  };
}

async function buildNormalizedPage(
  catalog: CmsCatalog,
  pageStore: CmsPageStore,
  pageKey: PageKey,
): Promise<NormalizedPage> {
  const persistedPage = await pageStore.readPage(pageKey);

  if (!persistedPage) {
    const snapshot = catalog.readPageSnapshot(pageKey);
    const entries: BlockEntry[] = snapshot.blocks.map((block) => ({
      kind: "kept",
      block,
      includeInPublic: true,
    }));
    return {
      pageKey,
      status: { kind: "default-backed", revision: null },
      meta: {
        title: snapshot.title,
        description: snapshot.description,
        provenance: "default",
      },
      outcome: { kind: "normalized", entries },
      diagnostics: [],
    };
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

  const diagnostics: CmsDiagnostic[] = [];
  if (migratedSnapshot.migrated) {
    diagnostics.push(createPageMigratedDiagnostic(pageKey));
  }

  const entries: BlockEntry[] = [];
  const allowedBlockTypes = new Set(
    catalog.getPageRule(pageKey).allowedBlockTypes,
  );

  for (const [index, block] of migratedSnapshot.snapshot.blocks.entries()) {
    const clonedBlock = structuredClone(block);
    let definition;

    try {
      definition = catalog.getBlockDefinition(clonedBlock.type);
    } catch (error) {
      if (!(error instanceof UnknownBlockTypeError)) throw error;
      const reason = createBlockUnsupportedTypeDiagnostic({
        pageKey,
        blockType: clonedBlock.type,
        blockIndex: index,
      });
      diagnostics.push(reason);
      entries.push({ kind: "admin-only", block: clonedBlock, includeInPublic: false, reason });
      continue;
    }

    if (!allowedBlockTypes.has(clonedBlock.type)) {
      const reason = createBlockDisallowedTypeDiagnostic({
        pageKey,
        blockType: clonedBlock.type,
        blockIndex: index,
      });
      diagnostics.push(reason);
      entries.push({ kind: "admin-only", block: clonedBlock, includeInPublic: false, reason });
      continue;
    }

    let normalizedBlock = clonedBlock;
    let migratedFromVersion: number | null = null;

    if (normalizedBlock.version !== definition.version) {
      const migration = definition.migrate?.({
        fromVersion: normalizedBlock.version,
        data: normalizedBlock.data,
      });

      if (!migration || migration.version !== definition.version) {
        const reason = createBlockUnsupportedVersionDiagnostic({
          pageKey,
          blockType: normalizedBlock.type,
          blockIndex: index,
          fromVersion: normalizedBlock.version,
          toVersion: definition.version,
        });
        diagnostics.push(reason);
        entries.push({ kind: "admin-only", block: normalizedBlock, includeInPublic: false, reason });
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
      const reason = createBlockBrokenDataDiagnostic({
        pageKey,
        blockType: normalizedBlock.type,
        blockIndex: index,
      });
      diagnostics.push(reason);
      entries.push({ kind: "admin-only", block: clonedBlock, includeInPublic: false, reason });
      continue;
    }

    const validatedBlock: BlockInstance = { ...normalizedBlock, data: result.data };

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

    entries.push({ kind: "kept", block: validatedBlock, includeInPublic: true });
  }

  const publicBlocks = entries
    .filter((e): e is KeptEntry => e.kind === "kept")
    .map((e) => e.block);

  if (!hasValidRequiredLeadingBlocks(catalog, pageKey, publicBlocks)) {
    const fallbackSnapshot = catalog.readPageSnapshot(pageKey);
    const reason = createPagePublicFallbackDefaultsDiagnostic();
    diagnostics.push(reason);
    return {
      pageKey,
      status: { kind: "persisted", revision: persistedPage.revision },
      meta: {
        title: migratedSnapshot.snapshot.title,
        description: migratedSnapshot.snapshot.description,
        provenance: "persisted",
      },
      outcome: {
        kind: "public-fallback-defaults",
        entries,
        fallbackBlocks: fallbackSnapshot.blocks,
        reason,
      },
      diagnostics,
    };
  }

  return {
    pageKey,
    status: { kind: "persisted", revision: persistedPage.revision },
    meta: {
      title: migratedSnapshot.snapshot.title,
      description: migratedSnapshot.snapshot.description,
      provenance: "persisted",
    },
    outcome: { kind: "normalized", entries },
    diagnostics,
  };
}

function buildPublicProjection(
  normalized: NormalizedPage,
  catalog: CmsCatalog,
  context: PublicProjectionContext,
): PublicProjection {
  const { pageKey, outcome, status } = normalized;

  if (status.kind === "default-backed") {
    const snapshot = catalog.readPageSnapshot(pageKey);
    const projection = catalog.projectPublic(snapshot, context);
    return {
      ...projection,
      diagnostics: mergeCmsDiagnostics(projection.diagnostics, normalized.diagnostics),
    };
  }

  if (outcome.kind === "public-fallback-defaults") {
    const fallbackSnapshot = catalog.readPageSnapshot(pageKey);
    const projection = catalog.projectPublic(fallbackSnapshot, context);
    return {
      ...projection,
      diagnostics: mergeCmsDiagnostics(projection.diagnostics, normalized.diagnostics),
    };
  }

  const adminBlocks = outcome.entries
    .filter((e): e is KeptEntry | AdminOnlyEntry => e.kind !== "dropped")
    .map((e) => e.block);

  const publicBlocks = outcome.entries
    .filter((e): e is KeptEntry => e.kind === "kept")
    .map((e) => e.block);

  const publicSnapshot: PageSnapshot = {
    pageKey,
    provenance: normalized.meta.provenance,
    title: normalized.meta.title,
    description: normalized.meta.description,
    blocks: publicBlocks,
  };

  const projection = catalog.projectPublic(publicSnapshot, context);
  const mergedDiagnostics = mergeCmsDiagnostics(
    projection.diagnostics,
    normalized.diagnostics,
  );

  if (publicBlocks.length !== adminBlocks.length) {
    return {
      ...projection,
      diagnostics: mergeCmsDiagnostics(mergedDiagnostics, [
        createPagePublicOmittedBrokenBlocksDiagnostic(),
      ]),
    };
  }

  return { ...projection, diagnostics: mergedDiagnostics };
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createPageReader({
  catalog,
  pageStore,
}: {
  catalog: CmsCatalog;
  pageStore: CmsPageStore;
}): PageReader {
  return {
    async readAdminPage(pageKey) {
      const normalized = await buildNormalizedPage(catalog, pageStore, pageKey);
      return resolvedPageFromNormalized(normalized);
    },

    async readPublicPage(pageKey, context) {
      const normalized = await buildNormalizedPage(catalog, pageStore, pageKey);
      const projection = buildPublicProjection(normalized, catalog, context);
      const resolved = resolvedPageFromNormalized(normalized);
      const publicView: PublicPageView = { meta: projection.meta, blocks: projection.blocks };
      return { public: publicView, resolved };
    },

    async readPublicProjection(pageKey, context) {
      const normalized = await buildNormalizedPage(catalog, pageStore, pageKey);
      return buildPublicProjection(normalized, catalog, context);
    },
  };
}
