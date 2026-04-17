import { describe, expect, test } from "vitest";

import {
  createCmsCatalog,
  definePageDefinition,
  type BlockInstance,
  type CmsCatalog,
} from "./catalog";
import { cmsDiagnosticCodes } from "./diagnostics";
import { createPageReader } from "./page-reader.server";
import type { CmsPageStore, PersistedPageRecord } from "./page-service.server";
import { siteCmsCatalog } from "./site-catalog";

function makePageStore(
  record: PersistedPageRecord | null,
): Pick<CmsPageStore, "readPage"> & CmsPageStore {
  return {
    async readPage() {
      return record ? structuredClone(record) : null;
    },
    async materializePage() {
      throw new Error("not implemented");
    },
    async updatePageMeta() {
      throw new Error("not implemented");
    },
    async updatePage() {
      throw new Error("not implemented");
    },
    async deletePage() {
      throw new Error("not implemented");
    },
  };
}

const context = { pathname: "/" };
const homeDefaults = siteCmsCatalog.readPageSnapshot("home");

describe("createPageReader", () => {
  describe("readAdminPage", () => {
    test("default-backed page returns catalog snapshot with no diagnostics", async () => {
      const reader = createPageReader({
        catalog: siteCmsCatalog,
        pageStore: makePageStore(null),
      });

      const result = await reader.readAdminPage("home");

      expect(result.status).toEqual({ kind: "default-backed", revision: null });
      expect(result.pageSnapshot.provenance).toBe("default");
      expect(result.pageSnapshot.blocks).toEqual(homeDefaults.blocks);
      expect(result.diagnostics).toHaveLength(0);
    });

    test("persisted page with unknown block type keeps block in admin with blockUnsupportedType diagnostic", async () => {
      const reader = createPageReader({
        catalog: siteCmsCatalog,
        pageStore: makePageStore({
          pageKey: "home",
          revision: 1,
          title: "T",
          description: "D",
          blocks: [
            homeDefaults.blocks[0],
            { type: "legacy-cta", version: 1, data: {} } as unknown as BlockInstance,
          ],
        }),
      });

      const result = await reader.readAdminPage("home");

      expect(result.pageSnapshot.blocks).toHaveLength(2);
      expect(result.pageSnapshot.blocks[1].type).toBe("legacy-cta");
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          code: cmsDiagnosticCodes.blockUnsupportedType,
          blockType: "legacy-cta",
          blockIndex: 1,
        }),
      );
    });

    test("persisted page with disallowed block type keeps block in admin with blockDisallowedType diagnostic", async () => {
      const heroData = homeDefaults.blocks[0].data;
      const constrainedCatalog = createCmsCatalog({
        blocks: [
          siteCmsCatalog.getBlockDefinition("hero"),
          siteCmsCatalog.getBlockDefinition("text-section"),
        ],
        pages: [
          definePageDefinition({
            pageKey: "home",
            defaults: { title: "T", description: "D", blocks: [{ type: "hero", version: 1, data: heroData }] },
            rules: { allowedBlockTypes: ["hero"], requiredLeadingBlockTypes: ["hero"] },
          }),
        ],
      });
      const reader = createPageReader({
        catalog: constrainedCatalog,
        pageStore: makePageStore({
          pageKey: "home",
          revision: 1,
          title: "T",
          description: "D",
          blocks: [
            { type: "hero", version: 1, data: heroData },
            { type: "text-section", version: 1, data: { headline: "h", body: "b", variant: "plain" } },
          ],
        }),
      });

      const result = await reader.readAdminPage("home");

      expect(result.pageSnapshot.blocks).toHaveLength(2);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({ code: cmsDiagnosticCodes.blockDisallowedType }),
      );
    });

    test("persisted page with block at lower version and working migrator keeps block and emits blockMigrated", async () => {
      const migratedData = homeDefaults.blocks[0].data;
      const migratingCatalog: CmsCatalog = {
        ...siteCmsCatalog,
        getBlockDefinition(blockType) {
          const def = siteCmsCatalog.getBlockDefinition(blockType);
          if (blockType !== "hero") return def;
          return {
            ...def,
            version: 2 as const,
            migrate({ fromVersion }: { fromVersion: number; data: unknown }) {
              if (fromVersion === 1) return { version: 2 as const, data: migratedData };
              return null;
            },
          } as typeof def;
        },
      };
      const reader = createPageReader({
        catalog: migratingCatalog,
        pageStore: makePageStore({
          pageKey: "home",
          revision: 1,
          title: "T",
          description: "D",
          blocks: [{ type: "hero", version: 1, data: homeDefaults.blocks[0].data }],
        }),
      });

      const result = await reader.readAdminPage("home");

      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          code: cmsDiagnosticCodes.blockMigrated,
          blockType: "hero",
          fromVersion: 1,
          toVersion: 2,
        }),
      );
      expect(result.pageSnapshot.blocks[0].version).toBe(2);
    });

    test("persisted page with block at lower version and no migrator keeps block in admin with blockUnsupportedVersion", async () => {
      const v2Catalog: CmsCatalog = {
        ...siteCmsCatalog,
        getBlockDefinition(blockType) {
          const def = siteCmsCatalog.getBlockDefinition(blockType);
          if (blockType !== "hero") return def;
          return { ...def, version: 2 as const, migrate: undefined } as typeof def;
        },
      };
      const reader = createPageReader({
        catalog: v2Catalog,
        pageStore: makePageStore({
          pageKey: "home",
          revision: 1,
          title: "T",
          description: "D",
          blocks: [{ type: "hero", version: 1, data: homeDefaults.blocks[0].data }],
        }),
      });

      const result = await reader.readAdminPage("home");

      expect(result.pageSnapshot.blocks).toHaveLength(1);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          code: cmsDiagnosticCodes.blockUnsupportedVersion,
          blockType: "hero",
        }),
      );
    });

    test("persisted page with schema-invalid block data keeps block in admin with blockBrokenData", async () => {
      const reader = createPageReader({
        catalog: siteCmsCatalog,
        pageStore: makePageStore({
          pageKey: "home",
          revision: 1,
          title: "T",
          description: "D",
          blocks: [{ type: "hero", version: 1, data: {} } as unknown as BlockInstance],
        }),
      });

      const result = await reader.readAdminPage("home");

      expect(result.pageSnapshot.blocks).toHaveLength(1);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({ code: cmsDiagnosticCodes.blockBrokenData, blockType: "hero" }),
      );
    });

    test("persisted page with public blocks violating requiredLeadingBlockTypes emits pagePublicFallbackDefaults", async () => {
      const reader = createPageReader({
        catalog: siteCmsCatalog,
        pageStore: makePageStore({
          pageKey: "home",
          revision: 1,
          title: "T",
          description: "D",
          blocks: [{ type: "hero", version: 1, data: {} } as unknown as BlockInstance],
        }),
      });

      const result = await reader.readAdminPage("home");

      expect(result.pageSnapshot.blocks).toHaveLength(1);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({ code: cmsDiagnosticCodes.pagePublicFallbackDefaults }),
      );
    });

    test("page-level migration emits pageMigrated and applies migrated blocks", async () => {
      const migratingPageCatalog: CmsCatalog = {
        ...siteCmsCatalog,
        migratePageSnapshot({ snapshot }) {
          const migrated = { ...snapshot, blocks: homeDefaults.blocks };
          return { snapshot: migrated, migrated: true };
        },
      };
      const reader = createPageReader({
        catalog: migratingPageCatalog,
        pageStore: makePageStore({
          pageKey: "home",
          revision: 1,
          title: "T",
          description: "D",
          blocks: [],
        }),
      });

      const result = await reader.readAdminPage("home");

      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({ code: cmsDiagnosticCodes.pageMigrated }),
      );
    });
  });

  describe("readPublicPage", () => {
    test("default-backed page serves catalog defaults publicly", async () => {
      const reader = createPageReader({
        catalog: siteCmsCatalog,
        pageStore: makePageStore(null),
      });

      const result = await reader.readPublicPage("home", context);

      expect(result.public.blocks).toEqual(homeDefaults.blocks);
      expect(result.resolved.status).toEqual({ kind: "default-backed", revision: null });
    });

    test("admin-only block is omitted from public and pagePublicOmittedBrokenBlocks is added", async () => {
      const reader = createPageReader({
        catalog: siteCmsCatalog,
        pageStore: makePageStore({
          pageKey: "home",
          revision: 1,
          title: "T",
          description: "D",
          blocks: [
            homeDefaults.blocks[0],
            { type: "text-section", version: 1, data: {} } as unknown as BlockInstance,
          ],
        }),
      });

      const result = await reader.readPublicPage("home", context);

      expect(result.public.blocks).toHaveLength(1);
      expect(result.public.blocks[0].type).toBe("hero");
      expect(result.resolved.pageSnapshot.blocks).toHaveLength(2);
    });

    test("public-fallback-defaults uses catalog defaults publicly but admin keeps persisted entries", async () => {
      const reader = createPageReader({
        catalog: siteCmsCatalog,
        pageStore: makePageStore({
          pageKey: "home",
          revision: 1,
          title: "T",
          description: "D",
          blocks: [{ type: "hero", version: 1, data: {} } as unknown as BlockInstance],
        }),
      });

      const result = await reader.readPublicPage("home", context);

      expect(result.public.blocks).toEqual(homeDefaults.blocks);
      expect(result.resolved.pageSnapshot.blocks).toHaveLength(1);
      expect(result.resolved.diagnostics).toContainEqual(
        expect.objectContaining({ code: cmsDiagnosticCodes.pagePublicFallbackDefaults }),
      );
    });
  });

  describe("readPublicProjection", () => {
    test("default-backed page returns catalog projection diagnostics merged with page diagnostics", async () => {
      const catalogDiag = { code: cmsDiagnosticCodes.pageMigrated, message: "from catalog" } as const;
      const catalog: CmsCatalog = {
        ...siteCmsCatalog,
        projectPublic(snapshot, ctx) {
          const proj = siteCmsCatalog.projectPublic(snapshot, ctx);
          return { ...proj, diagnostics: [...proj.diagnostics, catalogDiag] };
        },
      };
      const reader = createPageReader({ catalog, pageStore: makePageStore(null) });

      const result = await reader.readPublicProjection("home", context);

      expect(result.diagnostics).toContainEqual(catalogDiag);
    });

    test("persisted page with admin-only blocks includes pagePublicOmittedBrokenBlocks in projection", async () => {
      const reader = createPageReader({
        catalog: siteCmsCatalog,
        pageStore: makePageStore({
          pageKey: "home",
          revision: 1,
          title: "T",
          description: "D",
          blocks: [
            homeDefaults.blocks[0],
            { type: "legacy-cta", version: 1, data: {} } as unknown as BlockInstance,
          ],
        }),
      });

      const result = await reader.readPublicProjection("home", context);

      expect(result.blocks).toHaveLength(1);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({ code: cmsDiagnosticCodes.pagePublicOmittedBrokenBlocks }),
      );
    });

    test("misordered blocks violating requiredLeadingBlockTypes triggers public fallback, not just omission", async () => {
      const textBlock = homeDefaults.blocks.find((b) => b.type === "text-section");
      if (!textBlock) throw new Error("no text-section in home defaults");

      const reader = createPageReader({
        catalog: siteCmsCatalog,
        pageStore: makePageStore({
          pageKey: "home",
          revision: 1,
          title: "T",
          description: "D",
          blocks: [textBlock, homeDefaults.blocks[0]],
        }),
      });

      const result = await reader.readPublicProjection("home", context);

      expect(result.blocks).toEqual(homeDefaults.blocks);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({ code: cmsDiagnosticCodes.pagePublicFallbackDefaults }),
      );
      expect(result.diagnostics.filter((d) => d.code === cmsDiagnosticCodes.pagePublicFallbackDefaults)).toHaveLength(1);
    });
  });
});
