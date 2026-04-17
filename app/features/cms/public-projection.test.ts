import { describe, expect, test } from "vitest";

import {
  createCmsCatalog,
  defineBlockDefinition,
  definePageDefinition,
  type BlockInstance,
  type CmsCatalog,
  type PageSnapshot,
} from "./catalog";
import { cmsDiagnosticCodes, type CmsDiagnostic } from "./diagnostics";
import type { ResolvedPage } from "./page-service.server";
import { computePublicProjection } from "./public-projection";
import { siteCmsCatalog } from "./site-catalog";

function makePersistedPage(
  pageKey: string,
  blocks: BlockInstance[],
  diagnostics: CmsDiagnostic[] = [],
  overrides: Partial<PageSnapshot> = {},
): ResolvedPage {
  return {
    pageKey,
    status: { kind: "persisted", revision: 1 },
    pageSnapshot: {
      pageKey,
      provenance: "persisted",
      title: "Persisted Title",
      description: "Persisted Description",
      blocks,
      ...overrides,
    },
    diagnostics,
  };
}

function makeDefaultBackedPage(pageKey: string): ResolvedPage {
  return {
    pageKey,
    status: { kind: "default-backed", revision: null },
    pageSnapshot: siteCmsCatalog.readPageSnapshot(pageKey),
    diagnostics: [],
  };
}

const context = { pathname: "/" };
const homeDefaults = siteCmsCatalog.readPageSnapshot("home");

describe("computePublicProjection", () => {
  test("default-backed page projects directly from its snapshot", () => {
    const resolved = makeDefaultBackedPage("home");
    const result = computePublicProjection(resolved, siteCmsCatalog, context);

    expect(result.blocks).toEqual(homeDefaults.blocks);
    expect(result.diagnostics).toHaveLength(0);
  });

  test("default-backed page merges resolved diagnostics into result", () => {
    const diagnostic: CmsDiagnostic = {
      code: cmsDiagnosticCodes.pageMigrated,
      message: "page was migrated",
    };
    const resolved: ResolvedPage = {
      ...makeDefaultBackedPage("home"),
      diagnostics: [diagnostic],
    };

    const result = computePublicProjection(resolved, siteCmsCatalog, context);

    expect(result.diagnostics).toContainEqual(diagnostic);
  });

  test("persisted page with no broken blocks projects all blocks unchanged", () => {
    const defaultBlocks = homeDefaults.blocks;
    const resolved = makePersistedPage("home", defaultBlocks);

    const result = computePublicProjection(resolved, siteCmsCatalog, context);

    expect(result.blocks).toHaveLength(defaultBlocks.length);
    expect(result.diagnostics).toHaveLength(0);
  });

  test("broken block at non-leading index is omitted and pagePublicOmittedBrokenBlocks is added", () => {
    const heroBlock = homeDefaults.blocks[0];
    const brokenBlock = {
      type: "text-section",
      version: 1,
      data: {},
    } as unknown as BlockInstance;
    const brokenDiagnostic: CmsDiagnostic = {
      code: cmsDiagnosticCodes.blockBrokenData,
      message: "block broken",
      blockType: "text-section",
      blockIndex: 1,
    };

    const resolved = makePersistedPage(
      "home",
      [heroBlock, brokenBlock],
      [brokenDiagnostic],
    );

    const result = computePublicProjection(resolved, siteCmsCatalog, context);

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].type).toBe("hero");
    expect(
      result.diagnostics.some(
        (d) => d.code === cmsDiagnosticCodes.pagePublicOmittedBrokenBlocks,
      ),
    ).toBe(true);
  });

  test("broken block at required leading index triggers fallback to defaults", () => {
    const brokenHero = {
      type: "hero",
      version: 1,
      data: {},
    } as unknown as BlockInstance;
    const brokenDiagnostic: CmsDiagnostic = {
      code: cmsDiagnosticCodes.blockBrokenData,
      message: "hero data invalid",
      blockType: "hero",
      blockIndex: 0,
    };

    const resolved = makePersistedPage("home", [brokenHero], [brokenDiagnostic]);

    const result = computePublicProjection(resolved, siteCmsCatalog, context);

    expect(result.blocks).toEqual(homeDefaults.blocks);
    expect(
      result.diagnostics.some(
        (d) => d.code === cmsDiagnosticCodes.pagePublicFallbackDefaults,
      ),
    ).toBe(true);
  });

  test("pagePublicFallbackDefaults is not duplicated when already in resolved diagnostics", () => {
    const brokenHero = {
      type: "hero",
      version: 1,
      data: {},
    } as unknown as BlockInstance;
    const diagnostics: CmsDiagnostic[] = [
      {
        code: cmsDiagnosticCodes.blockBrokenData,
        message: "hero data invalid",
        blockType: "hero",
        blockIndex: 0,
      },
      {
        code: cmsDiagnosticCodes.pagePublicFallbackDefaults,
        message:
          "Persisted page structure is invalid for public rendering. Falling back to default page content.",
      },
    ];

    const resolved = makePersistedPage("home", [brokenHero], diagnostics);

    const result = computePublicProjection(resolved, siteCmsCatalog, context);

    expect(
      result.diagnostics.filter(
        (d) => d.code === cmsDiagnosticCodes.pagePublicFallbackDefaults,
      ),
    ).toHaveLength(1);
  });

  test("misordered blocks that pass normalization but violate leading rule trigger fallback", () => {
    const defaultBlocks = homeDefaults.blocks;
    const textBlock = defaultBlocks.find((b) => b.type === "text-section");
    const heroBlock = defaultBlocks[0];

    if (!textBlock) throw new Error("no text-section block in home defaults");

    const resolved = makePersistedPage("home", [textBlock, heroBlock]);

    const result = computePublicProjection(resolved, siteCmsCatalog, context);

    expect(result.blocks).toEqual(homeDefaults.blocks);
    expect(
      result.diagnostics.some(
        (d) => d.code === cmsDiagnosticCodes.pagePublicFallbackDefaults,
      ),
    ).toBe(true);
  });

  test("unsupported block type is omitted from public output", () => {
    const heroBlock = homeDefaults.blocks[0];
    const legacyBlock = {
      type: "legacy-cta",
      version: 1,
      data: {},
    } as unknown as BlockInstance;
    const diagnostics: CmsDiagnostic[] = [
      {
        code: cmsDiagnosticCodes.blockUnsupportedType,
        message: "unsupported",
        blockType: "legacy-cta",
        blockIndex: 1,
      },
    ];

    const resolved = makePersistedPage(
      "home",
      [heroBlock, legacyBlock],
      diagnostics,
    );

    const result = computePublicProjection(resolved, siteCmsCatalog, context);

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].type).toBe("hero");
    expect(
      result.diagnostics.some(
        (d) => d.code === cmsDiagnosticCodes.blockUnsupportedType,
      ),
    ).toBe(true);
    expect(
      result.diagnostics.some(
        (d) => d.code === cmsDiagnosticCodes.pagePublicOmittedBrokenBlocks,
      ),
    ).toBe(true);
  });

  test("migration diagnostics from resolved page pass through to result", () => {
    const defaultBlocks = homeDefaults.blocks;
    const migrationDiagnostic: CmsDiagnostic = {
      code: cmsDiagnosticCodes.blockMigrated,
      message: "migrated",
      blockType: "hero",
      blockIndex: 0,
      fromVersion: 1,
      toVersion: 2,
    };

    const resolved = makePersistedPage("home", defaultBlocks, [
      migrationDiagnostic,
    ]);

    const result = computePublicProjection(resolved, siteCmsCatalog, context);

    expect(result.diagnostics).toContainEqual(migrationDiagnostic);
  });

  test("preserves diagnostics emitted by catalog.projectPublic", () => {
    const catalogDiagnostic: CmsDiagnostic = {
      code: cmsDiagnosticCodes.pageMigrated,
      message: "catalog diagnostic",
    };
    const catalogWithDiagnostic: CmsCatalog = {
      ...siteCmsCatalog,
      projectPublic(snapshot, ctx) {
        const projection = siteCmsCatalog.projectPublic(snapshot, ctx);
        return {
          ...projection,
          diagnostics: [...projection.diagnostics, catalogDiagnostic],
        };
      },
    };

    const resolved = makeDefaultBackedPage("home");
    const result = computePublicProjection(
      resolved,
      catalogWithDiagnostic,
      context,
    );

    expect(result.diagnostics).toContainEqual(catalogDiagnostic);
  });

  test("does not add pagePublicOmittedBrokenBlocks when all blocks are valid", () => {
    const defaultBlocks = homeDefaults.blocks;
    const resolved = makePersistedPage("home", defaultBlocks);

    const result = computePublicProjection(resolved, siteCmsCatalog, context);

    expect(
      result.diagnostics.some(
        (d) => d.code === cmsDiagnosticCodes.pagePublicOmittedBrokenBlocks,
      ),
    ).toBe(false);
  });

  test("page with no requiredLeadingBlockTypes renders partial blocks without fallback", () => {
    const { blocks: pageDefaults } = siteCmsCatalog.readPageSnapshot("home");
    const noRulesCatalog = createCmsCatalog({
      blocks: [
        siteCmsCatalog.getBlockDefinition("hero"),
        siteCmsCatalog.getBlockDefinition("text-section"),
      ],
      pages: [
        definePageDefinition({
          pageKey: "home",
          defaults: {
            title: "fallback",
            description: "fallback",
            blocks: [
              {
                type: "hero",
                version: 1,
                data: pageDefaults[0].data,
              },
            ],
          },
          rules: { allowedBlockTypes: ["hero", "text-section"] },
        }),
      ],
    });

    const brokenDiagnostic: CmsDiagnostic = {
      code: cmsDiagnosticCodes.blockBrokenData,
      message: "broken",
      blockType: "text-section",
      blockIndex: 1,
    };
    const resolved = makePersistedPage(
      "home",
      [pageDefaults[0], { type: "text-section", version: 1, data: {} } as unknown as BlockInstance],
      [brokenDiagnostic],
    );

    const result = computePublicProjection(resolved, noRulesCatalog, context);

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].type).toBe("hero");
    expect(
      result.diagnostics.some(
        (d) => d.code === cmsDiagnosticCodes.pagePublicFallbackDefaults,
      ),
    ).toBe(false);
    expect(
      result.diagnostics.some(
        (d) => d.code === cmsDiagnosticCodes.pagePublicOmittedBrokenBlocks,
      ),
    ).toBe(true);
  });
});
