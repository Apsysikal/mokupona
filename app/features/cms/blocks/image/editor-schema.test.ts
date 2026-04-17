import { describe, expect, test } from "vitest";

import {
  applyImageBlockEditorValue,
  createImageBlockEditorFormSchema,
  getImageBlockEditorDefaultValue,
} from "./editor-schema";
import type { ImageBlockType } from "./model";

function makeImageData(
  image: ImageBlockType["data"]["image"],
): ImageBlockType["data"] {
  return {
    image,
    variant: "default",
  };
}

describe("image editor schema image behavior", () => {
  test("requires accessibility choice and alt text for descriptive replacement", () => {
    const schema = createImageBlockEditorFormSchema();
    const parsed = schema.safeParse({
      variant: "default",
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

  test("asset-backed images do not preselect replacement accessibility", () => {
    const defaults = getImageBlockEditorDefaultValue(
      makeImageData({ kind: "asset", src: "/accent-image.png", alt: "" }),
    );

    expect(defaults.imageAccessibility).toBe("");
  });

  test("default form values expose keep action and uploaded accessibility state", () => {
    const defaults = getImageBlockEditorDefaultValue(
      makeImageData({
        kind: "uploaded",
        imageId: "img_123",
        fallbackAssetSrc: "/accent-image.png",
        decorative: false,
        alt: "A plated dinner",
      }),
    );

    expect(defaults.imageAction).toBe("keep");
    expect(defaults.imageAccessibility).toBe("descriptive");
    expect(defaults.imageAlt).toBe("A plated dinner");
  });

  test("reverts uploaded image to asset with explicit empty alt on remove", () => {
    const next = applyImageBlockEditorValue(
      makeImageData({
        kind: "uploaded",
        imageId: "img_123",
        fallbackAssetSrc: "/accent-image.png",
        decorative: false,
        alt: "A plated dinner",
      }),
      {
        variant: "default",
        imageAction: "remove",
      },
    );

    expect(next.image).toEqual({
      kind: "asset",
      src: "/accent-image.png",
      alt: "",
    });
  });

  test("apply preserves variant field alongside image changes", () => {
    const next = applyImageBlockEditorValue(
      makeImageData({ kind: "asset", src: "/accent-image.png", alt: "" }),
      {
        variant: "full-width",
        imageAction: "replace",
        imageAccessibility: "decorative",
      },
      { uploadedImageId: "img_123" },
    );

    expect(next.variant).toBe("full-width");
    expect(next.image).toEqual({
      kind: "uploaded",
      imageId: "img_123",
      fallbackAssetSrc: "/accent-image.png",
      decorative: true,
    });
  });
});
