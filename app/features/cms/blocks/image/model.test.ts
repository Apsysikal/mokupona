import { describe, expect, test } from "vitest";

import {
  createDefaultImageBlockData,
  DEFAULT_IMAGE_BLOCK_ASSET_SRC,
} from "./model";

describe("image block defaults", () => {
  test("uses the catalog asset that exists in public assets", () => {
    expect(DEFAULT_IMAGE_BLOCK_ASSET_SRC).toBe("/accent-image.png");
  });

  test("creates default image block data with an asset image", () => {
    expect(createDefaultImageBlockData()).toEqual({
      image: {
        kind: "asset",
        src: DEFAULT_IMAGE_BLOCK_ASSET_SRC,
        alt: "",
      },
      variant: "default",
    });
  });
});
