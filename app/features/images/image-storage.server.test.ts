import { describe, expect, it, vi } from "vitest";

import {
  createImageStorageProvider,
  destroyImages,
} from "./image-storage.server";

// Selection must stay hermetic: both provider factories are mocked, the test
// asserts only the routing/invariant behavior of the picker.
const mocks = vi.hoisted(() => ({
  createLocalProvider: vi.fn(() => ({ kind: "local" })),
  createCloudinaryProvider: vi.fn(() => ({ kind: "cloudinary" })),
  warn: vi.fn(),
}));

vi.mock("./providers/local.server", () => ({
  createLocalProvider: mocks.createLocalProvider,
}));
vi.mock("./providers/cloudinary.server", () => ({
  createCloudinaryProvider: mocks.createCloudinaryProvider,
}));
vi.mock("~/logger.server", () => ({
  logger: { warn: mocks.warn },
}));

describe("createImageStorageProvider", () => {
  it("defaults to the local provider when IMAGE_PROVIDER is unset", () => {
    const provider = createImageStorageProvider({} as NodeJS.ProcessEnv);

    expect(provider).toEqual({ kind: "local" });
  });

  it("selects the cloudinary provider when configured", () => {
    const env = { IMAGE_PROVIDER: "cloudinary" } as NodeJS.ProcessEnv;

    const provider = createImageStorageProvider(env);

    expect(provider).toEqual({ kind: "cloudinary" });
    expect(mocks.createCloudinaryProvider).toHaveBeenCalledWith(env);
  });

  it("rejects an unknown provider name", () => {
    expect(() =>
      createImageStorageProvider({
        IMAGE_PROVIDER: "s3",
      } as NodeJS.ProcessEnv),
    ).toThrow('Unknown IMAGE_PROVIDER "s3"');
  });
});

describe("destroyImages", () => {
  it("destroys each captured key, skipping nulls from legacy rows", async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);

    await destroyImages(["dinners/a", null, undefined, "board-members/b"], {
      store: vi.fn(),
      destroy,
    });

    expect(destroy).toHaveBeenCalledTimes(2);
    expect(destroy).toHaveBeenNthCalledWith(1, "dinners/a");
    expect(destroy).toHaveBeenNthCalledWith(2, "board-members/b");
  });

  it("logs and continues when a destroy fails — the DB commit already happened", async () => {
    const destroy = vi
      .fn()
      .mockRejectedValueOnce(new Error("cloudinary down"))
      .mockResolvedValueOnce(undefined);

    await expect(
      destroyImages(["dinners/a", "dinners/b"], {
        store: vi.fn(),
        destroy,
      }),
    ).resolves.toBeUndefined();

    expect(destroy).toHaveBeenCalledTimes(2);
    expect(mocks.warn).toHaveBeenCalledWith(
      "Failed to destroy stored image after DB commit",
      expect.objectContaining({ storageKey: "dinners/a" }),
    );
  });
});
