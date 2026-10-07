import { describe, expect, it, vi } from "vitest";

import { loggerStub } from "../../../test/logger-stub";

import {
  createImageStorageProvider,
  destroyImages,
  storeImages,
} from "./image-storage.server";

const mocks = vi.hoisted(() => ({
  createLocalProvider: vi.fn(() => ({ kind: "local" })),
  createCloudinaryProvider: vi.fn(() => ({ kind: "cloudinary" })),
}));

vi.mock("./providers/local.server", () => ({
  createLocalProvider: mocks.createLocalProvider,
}));
vi.mock("./providers/cloudinary.server", () => ({
  createCloudinaryProvider: mocks.createCloudinaryProvider,
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

    await destroyImages(["events/a", null, undefined, "board-members/b"], {
      store: vi.fn(),
      destroy,
    });

    expect(destroy).toHaveBeenCalledTimes(2);
    expect(destroy).toHaveBeenNthCalledWith(1, "events/a");
    expect(destroy).toHaveBeenNthCalledWith(2, "board-members/b");
  });

  it("logs and continues when a destroy fails — the DB commit already happened", async () => {
    const destroy = vi
      .fn()
      .mockRejectedValueOnce(new Error("cloudinary down"))
      .mockResolvedValueOnce(undefined);

    await expect(
      destroyImages(["events/a", "events/b"], {
        store: vi.fn(),
        destroy,
      }),
    ).resolves.toBeUndefined();

    expect(destroy).toHaveBeenCalledTimes(2);
    expect(loggerStub.warn).toHaveBeenCalledWith(
      expect.objectContaining({ storageKey: "events/a" }),
      "Failed to destroy stored image after DB commit",
    );
  });
});

describe("storeImages", () => {
  function file(name: string) {
    return new File(["x"], name, { type: "image/jpeg" });
  }

  it("keeps the siblings of a failed store, settled in input order", async () => {
    const store = vi
      .fn()
      .mockResolvedValueOnce({ storageKey: "event-gallery/a" })
      .mockRejectedValueOnce(new Error("cloudinary 503"))
      .mockResolvedValueOnce({ storageKey: "event-gallery/c" });

    const results = await storeImages(
      [file("a.jpg"), file("b.jpg"), file("c.jpg")],
      "event-gallery",
      { store, destroy: vi.fn() },
    );

    expect(results).toEqual([
      { status: "fulfilled", value: { storageKey: "event-gallery/a" } },
      { status: "rejected", reason: new Error("cloudinary 503") },
      { status: "fulfilled", value: { storageKey: "event-gallery/c" } },
    ]);
    expect(loggerStub.warn).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: "b.jpg", folder: "event-gallery" }),
      "Failed to store image",
    );
  });

  it("stores nothing for an empty batch", async () => {
    const store = vi.fn();

    await expect(
      storeImages([], "event-gallery", { store, destroy: vi.fn() }),
    ).resolves.toEqual([]);
    expect(store).not.toHaveBeenCalled();
  });
});
