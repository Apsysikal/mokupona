import { describe, expect, test, vi } from "vitest";

import type { BlockInstance } from "./catalog";
import {
  collectUploadedImageIds,
  deleteCmsImagesIfUnreferenced,
  discardOrphanedUploadedImage,
  reconcileCmsImageLifecycle,
} from "./cms-image-lifecycle.server";
import { siteCmsCatalog } from "./site-catalog";

describe("cms image lifecycle", () => {
  test("collects uploaded image ids from block definitions", () => {
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
        type: "image",
        version: 1,
        data: {
          image: {
            kind: "uploaded",
            imageId: "img_456",
            fallbackAssetSrc: "/accent-image.png",
            decorative: true,
          },
          variant: "default",
        },
      },
      {
        type: "text-section",
        version: 1,
        data: { headline: "x", body: "y", variant: "plain" },
      },
    ];

    expect([...collectUploadedImageIds(blocks, siteCmsCatalog)]).toEqual([
      "img_123",
      "img_456",
    ]);
  });

  test("returns no image ids when block data is invalid", () => {
    const blocks: BlockInstance[] = [
      {
        type: "hero",
        version: 1,
        data: {
          headline: "",
          actions: [],
          image: {
            kind: "uploaded",
            imageId: "",
            fallbackAssetSrc: "/hero-image.jpg",
            decorative: false,
          },
        },
      },
    ];

    expect([...collectUploadedImageIds(blocks, siteCmsCatalog)]).toEqual([]);
  });

  test("reconciles removed uploaded images after a replace edit", async () => {
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

    await reconcileCmsImageLifecycle({
      previousBlocks,
      nextBlocks,
      prisma: prisma as never,
      catalog: siteCmsCatalog,
    });

    expect(prisma.image.delete).toHaveBeenCalledWith({
      where: { id: "img_old" },
    });
  });

  test("ignores blocks whose definitions do not declare uploaded image ids", async () => {
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

    await reconcileCmsImageLifecycle({
      previousBlocks: [
        {
          pageBlockId: "text-1",
          type: "text-section",
          version: 1,
          data: { headline: "x", body: "y", variant: "plain" },
        },
      ],
      nextBlocks: [],
      prisma: prisma as never,
      catalog: siteCmsCatalog,
    });

    expect(prisma.pageBlock.count).not.toHaveBeenCalled();
    expect(prisma.image.delete).not.toHaveBeenCalled();
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

  test("discards orphaned uploaded images", async () => {
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

    await discardOrphanedUploadedImage({
      imageId: "img_123",
      prisma: prisma as never,
    });

    expect(prisma.image.delete).toHaveBeenCalledWith({
      where: { id: "img_123" },
    });
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
