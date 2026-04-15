import { describe, expect, test } from "vitest";

import { cmsDiagnosticCodes } from "./diagnostics";
import { derivePageBanners } from "./admin-page-banners";

describe("derivePageBanners", () => {
  test("returns default-backed banner before first materialization", () => {
    expect(
      derivePageBanners({
        status: { kind: "default-backed", revision: null },
        diagnostics: [],
      }),
    ).toEqual([
      "This page is still using code defaults. Your first successful save will materialize persisted CMS content.",
    ]);
  });

  test("returns recoverable-content and fallback banners for persisted recovery states", () => {
    expect(
      derivePageBanners({
        status: { kind: "persisted", revision: 12 },
        diagnostics: [
          {
            code: cmsDiagnosticCodes.blockUnsupportedType,
            message: "unsupported block",
            blockType: "legacy",
            blockIndex: 1,
          },
          {
            code: cmsDiagnosticCodes.pagePublicFallbackDefaults,
            message: "public fallback",
          },
        ],
      }),
    ).toEqual([
      "Persisted content includes unsupported or broken blocks. They remain visible here for recovery.",
      "Public rendering recovered to defaults because persisted structure is invalid. Fix persisted blocks to heal the page.",
    ]);
  });
});
