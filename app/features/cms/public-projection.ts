import type {
  BlockInstance,
  CmsCatalog,
  PageKey,
  PublicProjection,
  PublicProjectionContext,
} from "./catalog";
import {
  createPagePublicFallbackDefaultsDiagnostic,
  createPagePublicOmittedBrokenBlocksDiagnostic,
  isRecoverableBlockDiagnosticCode,
  mergeCmsDiagnostics,
} from "./diagnostics";
import type { ResolvedPage } from "./page-service.server";

function hasValidRequiredLeadingBlocks(
  catalog: CmsCatalog,
  pageKey: PageKey,
  blocks: readonly BlockInstance[],
): boolean {
  const requiredLeading = catalog.getPageRule(pageKey).requiredLeadingBlockTypes;
  if (!requiredLeading || requiredLeading.length === 0) {
    return true;
  }
  return requiredLeading.every(
    (requiredType, index) => blocks[index]?.type === requiredType,
  );
}

export function computePublicProjection(
  resolvedPage: ResolvedPage,
  catalog: CmsCatalog,
  context: PublicProjectionContext,
): PublicProjection {
  const { pageKey, pageSnapshot, diagnostics, status } = resolvedPage;

  if (status.kind === "default-backed") {
    const projection = catalog.projectPublic(pageSnapshot, context);
    return {
      ...projection,
      diagnostics: mergeCmsDiagnostics(projection.diagnostics, diagnostics),
    };
  }

  const omitDiagnostics = diagnostics.filter((diagnostic) =>
    isRecoverableBlockDiagnosticCode(diagnostic.code),
  );
  const omittedBlockIndexes = new Set(
    omitDiagnostics.flatMap((diagnostic) =>
      typeof diagnostic.blockIndex === "number" ? [diagnostic.blockIndex] : [],
    ),
  );
  const publicBlocks = pageSnapshot.blocks.filter(
    (_, index) => !omittedBlockIndexes.has(index),
  );

  if (!hasValidRequiredLeadingBlocks(catalog, pageKey, publicBlocks)) {
    const fallbackSnapshot = catalog.readPageSnapshot(pageKey);
    const projection = catalog.projectPublic(fallbackSnapshot, context);
    return {
      ...projection,
      diagnostics: mergeCmsDiagnostics(
        projection.diagnostics,
        diagnostics,
        [createPagePublicFallbackDefaultsDiagnostic()],
      ),
    };
  }

  const projection = catalog.projectPublic(
    { ...pageSnapshot, blocks: publicBlocks },
    context,
  );
  const publicDiagnostics = mergeCmsDiagnostics(
    projection.diagnostics,
    diagnostics,
  );
  if (publicBlocks.length !== pageSnapshot.blocks.length) {
    return {
      ...projection,
      diagnostics: mergeCmsDiagnostics(publicDiagnostics, [
        createPagePublicOmittedBrokenBlocksDiagnostic(),
      ]),
    };
  }
  return { ...projection, diagnostics: publicDiagnostics };
}
