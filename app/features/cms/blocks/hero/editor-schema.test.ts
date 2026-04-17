import { describe, expect, test } from "vitest";

import {
  applyHeroBlockEditorValue,
  createHeroBlockEditorFormSchema,
  getHeroBlockEditorDefaultValue,
} from "./editor-schema";
import type { HeroBlockType } from "./model";

import { createLinkTargetRegistry } from "~/features/cms/link-targets";

const linkTargetRegistry = createLinkTargetRegistry([
  { key: "dinners", label: "Dinners", href: "/dinners" },
]);

function makeHeroData(
  image: HeroBlockType["data"]["image"],
): HeroBlockType["data"] {
  return {
    eyebrow: "eyebrow",
    headline: "headline",
    description: "description",
    actions: [{ label: "Join", href: "/dinners" }],
    image,
  };
}

describe("hero editor schema image behavior", () => {
  test("requires accessibility choice and alt text for descriptive replacement", () => {
    const schema = createHeroBlockEditorFormSchema(linkTargetRegistry);
    const parsed = schema.safeParse({
      eyebrow: "eyebrow",
      headline: "headline",
      description: "description",
      actions: [{ label: "Join", href: "/dinners" }],
      imageAction: "replace",
      imageAccessibility: "descriptive",
      imageAlt: "",
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(
      parsed.error.issues.some((issue) => issue.path[0] === "imageAlt"),
    ).toBe(true);
  });

  test("asset-backed heroes do not preselect replacement accessibility", () => {
    const defaults = getHeroBlockEditorDefaultValue(
      makeHeroData({ kind: "asset", src: "/hero-image.jpg" }),
      linkTargetRegistry,
    );

    expect(defaults.imageAccessibility).toBe("");
  });

  test("default form values expose keep action and uploaded accessibility state", () => {
    const defaults = getHeroBlockEditorDefaultValue(
      makeHeroData({
        kind: "uploaded",
        imageId: "img_123",
        fallbackAssetSrc: "/hero-image.jpg",
        decorative: false,
        alt: "A plated dinner",
      }),
      linkTargetRegistry,
    );

    expect(defaults.imageAction).toBe("keep");
    expect(defaults.imageAccessibility).toBe("descriptive");
    expect(defaults.imageAlt).toBe("A plated dinner");
  });

  test("recovers malformed persisted hero data when applying editor values", () => {
    const next = applyHeroBlockEditorValue({} as HeroBlockType["data"], {
      eyebrow: "eyebrow",
      headline: "Recovered hero headline",
      description: "description",
      actions: [{ label: "Join", href: "/dinners" }],
      imageAction: "keep",
      imageAccessibility: undefined,
      imageAlt: "",
    });

    expect(next.image).toEqual({
      kind: "asset",
      src: "/hero-image.jpg",
    });
    expect(next.actions).toEqual([{ label: "Join", href: "/dinners" }]);
    expect(next.headline).toBe("Recovered hero headline");
  });

  test("rejects hrefs not in registry", () => {
    const schema = createHeroBlockEditorFormSchema(linkTargetRegistry);
    const parsed = schema.safeParse({
      eyebrow: "",
      headline: "headline",
      description: "",
      actions: [{ label: "Join", href: "/not-a-registered-href" }],
      imageAction: "keep",
      imageAccessibility: "",
      imageAlt: "",
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(
      parsed.error.issues.some((issue) => issue.path.includes("href")),
    ).toBe(true);
  });

  test("apply preserves hero-specific fields alongside image changes", () => {
    const next = applyHeroBlockEditorValue(
      makeHeroData({ kind: "asset", src: "/hero-image.jpg" }),
      {
        eyebrow: "new eyebrow",
        headline: "new headline",
        description: "new description",
        actions: [{ label: "Join", href: "/dinners" }],
        imageAction: "replace",
        imageAccessibility: "decorative",
      },
      { uploadedImageId: "img_123" },
    );

    expect(next.eyebrow).toBe("new eyebrow");
    expect(next.headline).toBe("new headline");
    expect(next.description).toBe("new description");
    expect(next.image).toEqual({
      kind: "uploaded",
      imageId: "img_123",
      fallbackAssetSrc: "/hero-image.jpg",
      decorative: true,
    });
  });
});
