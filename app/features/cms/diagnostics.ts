export const cmsDiagnosticCodes = {
  blockDisallowedType: "block/disallowed-type",
  blockBrokenData: "block/broken-data",
  blockMigrated: "block/migrated",
  blockUnsupportedType: "block/unsupported-type",
  blockUnsupportedVersion: "block/unsupported-version",
  pageMigrated: "page/migrated",
  pagePublicOmittedBrokenBlocks: "page/public-omitted-broken-blocks",
  pagePublicFallbackDefaults: "page/public-fallback-defaults",
  mutationStaleWrite: "mutation/stale-write",
} as const;

export type CmsDiagnosticCode =
  (typeof cmsDiagnosticCodes)[keyof typeof cmsDiagnosticCodes];

export type CmsDiagnostic = {
  code: CmsDiagnosticCode;
  message: string;
  blockType?: string;
  blockIndex?: number;
  fromVersion?: number;
  toVersion?: number;
};

export function getCmsDiagnosticIdentity(diagnostic: CmsDiagnostic): string {
  return [
    diagnostic.code,
    diagnostic.blockType ?? "",
    diagnostic.blockIndex ?? "",
    diagnostic.fromVersion ?? "",
    diagnostic.toVersion ?? "",
  ].join("|");
}

export function mergeCmsDiagnostics(
  ...diagnosticCollections: readonly (readonly CmsDiagnostic[])[]
): CmsDiagnostic[] {
  const merged: CmsDiagnostic[] = [];
  const seen = new Set<string>();
  for (const diagnostics of diagnosticCollections) {
    for (const diagnostic of diagnostics) {
      const key = getCmsDiagnosticIdentity(diagnostic);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      merged.push(diagnostic);
    }
  }

  return merged;
}

const pagePublicFallbackDefaultsMessage =
  "Persisted page structure is invalid for public rendering. Falling back to default page content.";
const pagePublicOmittedBrokenBlocksMessage =
  "Some persisted blocks were omitted from public rendering because they are unsupported or broken.";

export function createPagePublicFallbackDefaultsDiagnostic(): CmsDiagnostic {
  return {
    code: cmsDiagnosticCodes.pagePublicFallbackDefaults,
    message: pagePublicFallbackDefaultsMessage,
  };
}

export function createPagePublicOmittedBrokenBlocksDiagnostic(): CmsDiagnostic {
  return {
    code: cmsDiagnosticCodes.pagePublicOmittedBrokenBlocks,
    message: pagePublicOmittedBrokenBlocksMessage,
  };
}

export function createBlockUnsupportedTypeDiagnostic(input: {
  pageKey: string;
  blockType: string;
  blockIndex: number;
}): CmsDiagnostic {
  return {
    code: cmsDiagnosticCodes.blockUnsupportedType,
    message: `Persisted block "${input.blockType}" on page "${input.pageKey}" is no longer supported. Keep it editable in admin and omit it from public.`,
    blockType: input.blockType,
    blockIndex: input.blockIndex,
  };
}

export function createBlockDisallowedTypeDiagnostic(input: {
  pageKey: string;
  blockType: string;
  blockIndex: number;
}): CmsDiagnostic {
  return {
    code: cmsDiagnosticCodes.blockDisallowedType,
    message: `Persisted block "${input.blockType}" on page "${input.pageKey}" is no longer allowed on this page. Keep it editable in admin and omit it from public.`,
    blockType: input.blockType,
    blockIndex: input.blockIndex,
  };
}

export function createBlockUnsupportedVersionDiagnostic(input: {
  pageKey: string;
  blockType: string;
  blockIndex: number;
  fromVersion: number;
  toVersion: number;
}): CmsDiagnostic {
  return {
    code: cmsDiagnosticCodes.blockUnsupportedVersion,
    message: `Persisted block "${input.blockType}" on page "${input.pageKey}" has unsupported version ${input.fromVersion}. Keep it editable in admin and omit it from public.`,
    blockType: input.blockType,
    blockIndex: input.blockIndex,
    fromVersion: input.fromVersion,
    toVersion: input.toVersion,
  };
}

export function createBlockBrokenDataDiagnostic(input: {
  pageKey: string;
  blockType: string;
  blockIndex: number;
}): CmsDiagnostic {
  return {
    code: cmsDiagnosticCodes.blockBrokenData,
    message: `Persisted block "${input.blockType}" on page "${input.pageKey}" has invalid data. Keep it editable in admin and omit it from public.`,
    blockType: input.blockType,
    blockIndex: input.blockIndex,
  };
}

export function createBlockMigratedDiagnostic(input: {
  pageKey: string;
  blockType: string;
  blockIndex: number;
  fromVersion: number;
  toVersion: number;
}): CmsDiagnostic {
  return {
    code: cmsDiagnosticCodes.blockMigrated,
    message: `Persisted block "${input.blockType}" on page "${input.pageKey}" was migrated from version ${input.fromVersion} to ${input.toVersion}.`,
    blockType: input.blockType,
    blockIndex: input.blockIndex,
    fromVersion: input.fromVersion,
    toVersion: input.toVersion,
  };
}

export function createPageMigratedDiagnostic(pageKey: string): CmsDiagnostic {
  return {
    code: cmsDiagnosticCodes.pageMigrated,
    message: `Persisted page "${pageKey}" was migrated at read time.`,
  };
}

export function createMutationStaleWriteDiagnostic(): CmsDiagnostic {
  return {
    code: cmsDiagnosticCodes.mutationStaleWrite,
    message:
      "Page changed since last load. Refreshed with current values — please review and save again.",
  };
}

export const runtimeMigrationDiagnosticCodes = [
  cmsDiagnosticCodes.blockMigrated,
  cmsDiagnosticCodes.pageMigrated,
] as const satisfies readonly CmsDiagnosticCode[];
const runtimeMigrationDiagnosticCodeSet = new Set<CmsDiagnosticCode>(
  runtimeMigrationDiagnosticCodes,
);

const adminOnlyBlockDiagnosticCodeSet = new Set<CmsDiagnosticCode>([
  cmsDiagnosticCodes.blockDisallowedType,
  cmsDiagnosticCodes.blockBrokenData,
  cmsDiagnosticCodes.blockUnsupportedType,
  cmsDiagnosticCodes.blockUnsupportedVersion,
]);

export function isRuntimeMigrationDiagnosticCode(
  code: CmsDiagnosticCode,
): boolean {
  return runtimeMigrationDiagnosticCodeSet.has(code);
}

export function isAdminOnlyBlockDiagnosticCode(
  code: CmsDiagnosticCode,
): boolean {
  return adminOnlyBlockDiagnosticCodeSet.has(code);
}
