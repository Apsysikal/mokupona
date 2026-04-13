import { describe, expect, test, vi } from "vitest";

import type { BlockInstance } from "./catalog";
import {
  collectUploadedHeroImageIdsFromBlocks,
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
