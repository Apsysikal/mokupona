import { describe, expect, test } from "vitest";

import {
  createBlockBrokenDataDiagnostic,
  createBlockDisallowedTypeDiagnostic,
  createBlockMigratedDiagnostic,
  createBlockUnsupportedTypeDiagnostic,
  createBlockUnsupportedVersionDiagnostic,
  createPageMigratedDiagnostic,
  cmsDiagnosticCodes,
  createPagePublicFallbackDefaultsDiagnostic,
  createPagePublicOmittedBrokenBlocksDiagnostic,
  getCmsDiagnosticIdentity,
  isAdminOnlyBlockDiagnosticCode,
  isRuntimeMigrationDiagnosticCode,
  mergeCmsDiagnostics,
} from "./diagnostics";

describe("cms diagnostics helpers", () => {
  test("classifies runtime migration diagnostics", () => {
    expect(
      isRuntimeMigrationDiagnosticCode(cmsDiagnosticCodes.pageMigrated),
    ).toBe(true);
    expect(
      isRuntimeMigrationDiagnosticCode(cmsDiagnosticCodes.blockMigrated),
    ).toBe(true);
    expect(
      isRuntimeMigrationDiagnosticCode(cmsDiagnosticCodes.blockBrokenData),
    ).toBe(false);
  });

  test("classifies admin-only block diagnostics", () => {
    expect(
      isAdminOnlyBlockDiagnosticCode(cmsDiagnosticCodes.blockBrokenData),
    ).toBe(true);
    expect(
      isAdminOnlyBlockDiagnosticCode(cmsDiagnosticCodes.blockUnsupportedType),
    ).toBe(true);
    expect(
      isAdminOnlyBlockDiagnosticCode(cmsDiagnosticCodes.pageMigrated),
    ).toBe(false);
  });

  test("builds typed page recovery diagnostics with stable codes", () => {
    expect(createPagePublicFallbackDefaultsDiagnostic()).toEqual({
      code: cmsDiagnosticCodes.pagePublicFallbackDefaults,
      message:
        "Persisted page structure is invalid for public rendering. Falling back to default page content.",
    });
    expect(createPagePublicOmittedBrokenBlocksDiagnostic()).toEqual({
      code: cmsDiagnosticCodes.pagePublicOmittedBrokenBlocks,
      message:
        "Some persisted blocks were omitted from public rendering because they are unsupported or broken.",
    });
  });

  test("builds typed block and page migration diagnostics with stable metadata", () => {
    expect(
      createBlockUnsupportedTypeDiagnostic({
        pageKey: "home",
        blockType: "legacy",
        blockIndex: 2,
      }),
    ).toEqual({
      code: cmsDiagnosticCodes.blockUnsupportedType,
      message:
        'Persisted block "legacy" on page "home" is no longer supported. Keep it editable in admin and omit it from public.',
      blockType: "legacy",
      blockIndex: 2,
    });

    expect(
      createBlockDisallowedTypeDiagnostic({
        pageKey: "home",
        blockType: "legacy",
        blockIndex: 2,
      }),
    ).toEqual({
      code: cmsDiagnosticCodes.blockDisallowedType,
      message:
        'Persisted block "legacy" on page "home" is no longer allowed on this page. Keep it editable in admin and omit it from public.',
      blockType: "legacy",
      blockIndex: 2,
    });

    expect(
      createBlockUnsupportedVersionDiagnostic({
        pageKey: "home",
        blockType: "hero",
        blockIndex: 0,
        fromVersion: 1,
        toVersion: 2,
      }),
    ).toEqual({
      code: cmsDiagnosticCodes.blockUnsupportedVersion,
      message:
        'Persisted block "hero" on page "home" has unsupported version 1. Keep it editable in admin and omit it from public.',
      blockType: "hero",
      blockIndex: 0,
      fromVersion: 1,
      toVersion: 2,
    });

    expect(
      createBlockBrokenDataDiagnostic({
        pageKey: "home",
        blockType: "hero",
        blockIndex: 0,
      }),
    ).toEqual({
      code: cmsDiagnosticCodes.blockBrokenData,
      message:
        'Persisted block "hero" on page "home" has invalid data. Keep it editable in admin and omit it from public.',
      blockType: "hero",
      blockIndex: 0,
    });

    expect(
      createBlockMigratedDiagnostic({
        pageKey: "home",
        blockType: "hero",
        blockIndex: 0,
        fromVersion: 1,
        toVersion: 2,
      }),
    ).toEqual({
      code: cmsDiagnosticCodes.blockMigrated,
      message:
        'Persisted block "hero" on page "home" was migrated from version 1 to 2.',
      blockType: "hero",
      blockIndex: 0,
      fromVersion: 1,
      toVersion: 2,
    });

    expect(createPageMigratedDiagnostic("home")).toEqual({
      code: cmsDiagnosticCodes.pageMigrated,
      message: 'Persisted page "home" was migrated at read time.',
    });
  });

  test("creates stable identity independent of message text", () => {
    const base = {
      code: cmsDiagnosticCodes.blockUnsupportedVersion,
      message: "first message",
      blockType: "hero",
      blockIndex: 0,
      fromVersion: 1,
      toVersion: 2,
    } as const;

    expect(getCmsDiagnosticIdentity(base)).toBe(
      getCmsDiagnosticIdentity({ ...base, message: "second message" }),
    );
  });

  test("merges diagnostics by stable identity while preserving first occurrence order", () => {
    const duplicateByIdentity = {
      code: cmsDiagnosticCodes.blockUnsupportedVersion,
      message: "duplicate with different wording",
      blockType: "hero",
      blockIndex: 0,
      fromVersion: 1,
      toVersion: 2,
    } as const;
    const unique = {
      code: cmsDiagnosticCodes.pagePublicFallbackDefaults,
      message: "fallback",
    } as const;

    expect(
      mergeCmsDiagnostics(
        [
          {
            code: cmsDiagnosticCodes.blockUnsupportedVersion,
            message: "original wording",
            blockType: "hero",
            blockIndex: 0,
            fromVersion: 1,
            toVersion: 2,
          },
        ],
        [duplicateByIdentity, unique],
      ),
    ).toEqual([
      {
        code: cmsDiagnosticCodes.blockUnsupportedVersion,
        message: "original wording",
        blockType: "hero",
        blockIndex: 0,
        fromVersion: 1,
        toVersion: 2,
      },
      unique,
    ]);
  });
});
