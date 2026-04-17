import { describe, expect, test } from "vitest";

import { heroBlockDefinition } from "./index";

const validHeroData = {
  headline: "headline",
  actions: [{ label: "Join", href: "/dinners" }],
  image: { kind: "asset" as const, src: "/hero-image.jpg" },
};

describe("heroBlockDefinition schema", () => {
  test("accepts valid hero data", () => {
    expect(heroBlockDefinition.schema.safeParse(validHeroData).success).toBe(
      true,
    );
  });

  test("does not enforce href membership — accepts arbitrary hrefs", () => {
    const result = heroBlockDefinition.schema.safeParse({
      ...validHeroData,
      actions: [{ label: "Join", href: "/a-href-not-in-any-registry" }],
    });
    expect(result.success).toBe(true);
  });

  test("extracts uploaded image ids from uploaded hero data", () => {
    expect(
      heroBlockDefinition.getUploadedImageIds?.({
        ...validHeroData,
        image: {
          kind: "uploaded",
          imageId: "img_123",
          fallbackAssetSrc: "/hero-image.jpg",
          decorative: true,
        },
      }),
    ).toEqual(["img_123"]);
  });

  test("returns no image ids for asset-backed hero data", () => {
    expect(heroBlockDefinition.getUploadedImageIds?.(validHeroData)).toEqual(
      [],
    );
  });

  test("returns no image ids when hero data is invalid", () => {
    expect(
      heroBlockDefinition.getUploadedImageIds?.({
        headline: "",
        actions: [],
        image: {
          kind: "uploaded",
          imageId: "",
          fallbackAssetSrc: "/hero-image.jpg",
          decorative: false,
        },
      }),
    ).toEqual([]);
  });
});
