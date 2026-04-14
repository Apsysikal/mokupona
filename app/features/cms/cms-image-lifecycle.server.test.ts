import { describe, expect, test, vi } from "vitest";

import type { BlockInstance } from "./catalog";
import {
  collectUploadedHeroImageIdsFromBlocks,
  getRemovedUploadedHeroImageIds,
  deleteCmsImagesIfUnreferenced,
} from "./cms-image-lifecycle.server";

describe("cms image lifecycle", () => {
  test("collects uploaded hero image ids from page blocks", () => {
    const blocks: BlockInstance[] = [
      {
        type: "hero",
        version: 1,
        data: {
          headline: "hero",
          actions: [{ label: "Join", href: "/dinners" }],
          image: {
            kind: "uploaded",
            imageId: "img_123",
            fallbackAssetSrc: "/hero-image.jpg",
            decorative: true,
          },
        },
      },
      {
        type: "text-section",
        version: 1,
        data: { headline: "x", body: "y", variant: "plain" },
      },
    ];

    expect([...collectUploadedHeroImageIdsFromBlocks(blocks)]).toEqual([
      "img_123",
    ]);
  });

  test("deletes candidate image when no references remain", async () => {
    const prisma = {
      pageBlock: {
        count: vi.fn().mockResolvedValue(0),
      },
      event: {
        count: vi.fn().mockResolvedValue(0),
      },
      image: {
        count: vi.fn().mockResolvedValue(0),
        delete: vi.fn().mockResolvedValue(undefined),
      },
    };

    await deleteCmsImagesIfUnreferenced({
      prisma: prisma as never,
      imageIds: ["img_123"],
    });

    expect(prisma.image.delete).toHaveBeenCalledWith({
      where: { id: "img_123" },
    });
  });

  test("finds uploaded hero images removed by a replace or remove edit", () => {
    const previousBlocks: BlockInstance[] = [
      {
        pageBlockId: "hero-1",
        type: "hero",
        version: 1,
        data: {
          headline: "hero",
          actions: [{ label: "Join", href: "/dinners" }],
          image: {
            kind: "uploaded",
            imageId: "img_old",
            fallbackAssetSrc: "/hero-image.jpg",
            decorative: true,
          },
        },
      },
    ];
    const nextBlocks: BlockInstance[] = [
      {
        pageBlockId: "hero-1",
        type: "hero",
        version: 1,
        data: {
          headline: "hero",
          actions: [{ label: "Join", href: "/dinners" }],
          image: {
            kind: "uploaded",
            imageId: "img_new",
            fallbackAssetSrc: "/hero-image.jpg",
            decorative: true,
          },
        },
      },
    ];

    expect(getRemovedUploadedHeroImageIds(previousBlocks, nextBlocks)).toEqual([
      "img_old",
    ]);
  });

  test("finds uploaded hero images removed when the block disappears", () => {
    const previousBlocks: BlockInstance[] = [
      {
        pageBlockId: "hero-1",
        type: "hero",
        version: 1,
        data: {
          headline: "hero",
          actions: [{ label: "Join", href: "/dinners" }],
          image: {
            kind: "uploaded",
            imageId: "img_old",
            fallbackAssetSrc: "/hero-image.jpg",
            decorative: true,
          },
        },
      },
      {
        pageBlockId: "text-1",
        type: "text-section",
        version: 1,
        data: { headline: "x", body: "y", variant: "plain" },
      },
    ];

    expect(getRemovedUploadedHeroImageIds(previousBlocks, [])).toEqual([
      "img_old",
    ]);
  });

  test("finds uploaded image-block images removed when the block disappears", () => {
    const previousBlocks: BlockInstance[] = [
      {
        pageBlockId: "image-1",
        type: "image",
        version: 1,
        data: {
          image: {
            kind: "uploaded",
            imageId: "img_old",
            fallbackAssetSrc: "/accent-image.jpg",
            decorative: true,
          },
          variant: "default",
        },
      },
    ];

    expect(getRemovedUploadedHeroImageIds(previousBlocks, [])).toEqual([
      "img_old",
    ]);
  });

  test("does not delete candidate image when still referenced by a page block", async () => {
    const prisma = {
      pageBlock: {
        count: vi.fn().mockResolvedValue(1),
      },
      event: {
        count: vi.fn().mockResolvedValue(0),
      },
      image: {
        count: vi.fn().mockResolvedValue(0),
        delete: vi.fn().mockResolvedValue(undefined),
      },
    };

    await deleteCmsImagesIfUnreferenced({
      prisma: prisma as never,
      imageIds: ["img_123"],
    });

    expect(prisma.image.delete).not.toHaveBeenCalled();
  });
});
