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
    expect(parsed.error.issues.some((issue) => issue.path[0] === "imageAlt")).toBe(
      true,
    );
  });

  test("builds an uploaded decorative image when replacing with upload", () => {
    const next = applyHeroBlockEditorValue(
      makeHeroData({ kind: "asset", src: "/hero-image.jpg" }),
      {
        eyebrow: "eyebrow",
        headline: "new headline",
        description: "new description",
        actions: [{ label: "Join", href: "/dinners" }],
        imageAction: "replace",
        imageAccessibility: "decorative",
        imageAlt: "",
      },
      { uploadedImageId: "img_123" },
    );

    expect(next.image).toEqual({
      kind: "uploaded",
      imageId: "img_123",
      fallbackAssetSrc: "/hero-image.jpg",
      decorative: true,
    });
  });

  test("reverts uploaded image back to default asset on remove action", () => {
    const next = applyHeroBlockEditorValue(
      makeHeroData({
        kind: "uploaded",
        imageId: "img_123",
        fallbackAssetSrc: "/hero-image.jpg",
        decorative: false,
        alt: "A plated dinner",
      }),
      {
        eyebrow: "eyebrow",
        headline: "headline",
        description: "description",
        actions: [{ label: "Join", href: "/dinners" }],
        imageAction: "remove",
        imageAccessibility: "decorative",
        imageAlt: "",
      },
    );

    expect(next.image).toEqual({
      kind: "asset",
      src: "/hero-image.jpg",
    });
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
});
