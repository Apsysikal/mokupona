import { describe, expect, test } from "vitest";

import {
  applyImageSlot,
  hydrateImageSlot,
  imageSlotSchema,
  refineImageSlot,
  type ManagedImage,
} from "./image-action";

const assetImage: ManagedImage = { kind: "asset", src: "/hero-image.jpg" };
const uploadedDecorativeImage: ManagedImage = {
  kind: "uploaded",
  imageId: "img_123",
  fallbackAssetSrc: "/hero-image.jpg",
  decorative: true,
  alt: undefined,
};
const uploadedDescriptiveImage: ManagedImage = {
  kind: "uploaded",
  imageId: "img_123",
  fallbackAssetSrc: "/hero-image.jpg",
  decorative: false,
  alt: "A plated dinner",
};

describe("imageSlotSchema", () => {
  test("requires accessibility choice when replacing", () => {
    const schema = imageSlotSchema().superRefine((value, ctx) =>
      refineImageSlot(ctx, value),
    );
    const result = schema.safeParse({
      imageAction: "replace",
      imageAccessibility: "",
      imageAlt: "",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(
      result.error.issues.some((i) => i.path[0] === "imageAccessibility"),
    ).toBe(true);
  });

  test("requires alt text when replacing with descriptive accessibility", () => {
    const schema = imageSlotSchema().superRefine((value, ctx) =>
      refineImageSlot(ctx, value),
    );
    const result = schema.safeParse({
      imageAction: "replace",
      imageAccessibility: "descriptive",
      imageAlt: "",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((i) => i.path[0] === "imageAlt")).toBe(
      true,
    );
  });

  test("decorative replacement without alt passes validation", () => {
    const schema = imageSlotSchema().superRefine((value, ctx) =>
      refineImageSlot(ctx, value),
    );
    const result = schema.safeParse({
      imageAction: "replace",
      imageAccessibility: "decorative",
      imageAlt: "",
    });

    expect(result.success).toBe(true);
  });

  test("keep action skips validation", () => {
    const schema = imageSlotSchema().superRefine((value, ctx) =>
      refineImageSlot(ctx, value),
    );
    const result = schema.safeParse({
      imageAction: "keep",
      imageAccessibility: "",
      imageAlt: "",
    });

    expect(result.success).toBe(true);
  });

  test("remove action skips validation", () => {
    const schema = imageSlotSchema().superRefine((value, ctx) =>
      refineImageSlot(ctx, value),
    );
    const result = schema.safeParse({
      imageAction: "remove",
      imageAccessibility: "",
      imageAlt: "",
    });

    expect(result.success).toBe(true);
  });
});

describe("hydrateImageSlot", () => {
  test("asset image yields empty accessibility and keep action", () => {
    const shape = hydrateImageSlot(assetImage);

    expect(shape.imageAction).toBe("keep");
    expect(shape.imageAccessibility).toBe("");
    expect(shape.imageAlt).toBe("");
  });

  test("uploaded decorative image yields decorative accessibility", () => {
    const shape = hydrateImageSlot(uploadedDecorativeImage);

    expect(shape.imageAction).toBe("keep");
    expect(shape.imageAccessibility).toBe("decorative");
    expect(shape.imageAlt).toBe("");
  });

  test("uploaded descriptive image yields descriptive accessibility with alt", () => {
    const shape = hydrateImageSlot(uploadedDescriptiveImage);

    expect(shape.imageAction).toBe("keep");
    expect(shape.imageAccessibility).toBe("descriptive");
    expect(shape.imageAlt).toBe("A plated dinner");
  });
});

describe("applyImageSlot", () => {
  test("replace with uploaded id builds uploaded image from asset", () => {
    const result = applyImageSlot(
      assetImage,
      { imageAction: "replace", imageAccessibility: "decorative" },
      { uploadedImageId: "img_new" },
    );

    expect(result).toEqual({
      kind: "uploaded",
      imageId: "img_new",
      fallbackAssetSrc: "/hero-image.jpg",
      decorative: true,
    });
  });

  test("replace with uploaded id builds descriptive uploaded image", () => {
    const result = applyImageSlot(
      assetImage,
      {
        imageAction: "replace",
        imageAccessibility: "descriptive",
        imageAlt: "Fresh pasta",
      },
      { uploadedImageId: "img_new" },
    );

    expect(result).toEqual({
      kind: "uploaded",
      imageId: "img_new",
      fallbackAssetSrc: "/hero-image.jpg",
      decorative: false,
      alt: "Fresh pasta",
    });
  });

  test("replace without uploadedImageId is a no-op", () => {
    const result = applyImageSlot(
      assetImage,
      { imageAction: "replace", imageAccessibility: "decorative" },
      {},
    );

    expect(result).toBe(assetImage);
  });

  test("remove uploaded image reverts to fallback asset", () => {
    const result = applyImageSlot(
      uploadedDescriptiveImage,
      { imageAction: "remove" },
      {},
    );

    expect(result).toEqual({
      kind: "asset",
      src: "/hero-image.jpg",
    });
  });

  test("remove asset image is a no-op", () => {
    const result = applyImageSlot(assetImage, { imageAction: "remove" }, {});

    expect(result).toBe(assetImage);
  });

  test("keep uploaded image updates accessibility metadata", () => {
    const result = applyImageSlot(
      uploadedDescriptiveImage,
      { imageAction: "keep", imageAccessibility: "decorative" },
      {},
    );

    expect(result).toEqual({
      kind: "uploaded",
      imageId: "img_123",
      fallbackAssetSrc: "/hero-image.jpg",
      decorative: true,
    });
  });

  test("keep asset image is a no-op", () => {
    const result = applyImageSlot(
      assetImage,
      { imageAction: "keep", imageAccessibility: "decorative" },
      {},
    );

    expect(result).toBe(assetImage);
  });

  test("keep uploaded without accessibility choice is a no-op", () => {
    const result = applyImageSlot(
      uploadedDescriptiveImage,
      { imageAction: "keep" },
      {},
    );

    expect(result).toBe(uploadedDescriptiveImage);
  });
});
