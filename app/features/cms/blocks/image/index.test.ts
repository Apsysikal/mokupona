import { describe, expect, test } from "vitest";

import { imageBlockDefinition } from "./index";

const assetImageData = {
  image: { kind: "asset" as const, src: "/accent-image.png", alt: "" },
  variant: "default" as const,
};

describe("imageBlockDefinition", () => {
  test("extracts uploaded image ids from uploaded image data", () => {
    expect(
      imageBlockDefinition.getUploadedImageIds?.({
        image: {
          kind: "uploaded",
          imageId: "img_456",
          fallbackAssetSrc: "/accent-image.png",
          decorative: true,
        },
        variant: "default",
      }),
    ).toEqual(["img_456"]);
  });

  test("returns no image ids for asset-backed image data", () => {
    expect(imageBlockDefinition.getUploadedImageIds?.(assetImageData)).toEqual(
      [],
    );
  });

  test("returns no image ids when image data is invalid", () => {
    expect(
      imageBlockDefinition.getUploadedImageIds?.({
        image: {
          kind: "uploaded",
          imageId: "",
          fallbackAssetSrc: "/accent-image.png",
          decorative: false,
        },
        variant: "default",
      }),
    ).toEqual([]);
  });
});
