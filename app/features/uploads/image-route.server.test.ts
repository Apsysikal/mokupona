import { afterEach, describe, expect, it, vi } from "vitest";

import { loader } from "~/routes/file.$fileId";

const mocks = vi.hoisted(() => ({
  cacheGet: vi.fn(),
  cachePut: vi.fn(),
  getImageById: vi.fn(),
  transformToWebp: vi.fn(),
  loggerInfo: vi.fn(),
}));

vi.mock("~/features/uploads/file-cache-storage.server", () => ({
  fileStorage: {
    get: mocks.cacheGet,
    put: mocks.cachePut,
  },
  getStorageKey: (id: string) => `file-${id}`,
}));

vi.mock("~/logger.server", () => ({
  logger: { info: mocks.loggerInfo },
}));

vi.mock("~/models/image.server", () => ({
  getImageById: mocks.getImageById,
}));

vi.mock("~/utils/image-transform.server", () => ({
  transformToWebp: mocks.transformToWebp,
}));

function loadImage(query = "") {
  return loader({
    url: `http://localhost/file/image-id${query}`,
    params: { fileId: "image-id" },
  } as unknown as Parameters<typeof loader>[0]);
}

function expectImageHeaders(response: Response) {
  expect(response.headers.get("Content-Type")).toBe("image/webp");
  expect(response.headers.get("Content-Disposition")).toBe(
    'inline; filename="image-id"',
  );
  expect(response.headers.get("Cache-Control")).toBe(
    "public, max-age=31536000, immutable",
  );
  expect(response.headers.get("Content-Length")).not.toBeNull();
  expect(response.headers.get("Transfer-Encoding")).toBeNull();
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("image resource route", () => {
  it.each(["?w=0", "?h=-1", "?w=1.5", "?h=2049"])(
    "rejects an unsafe dimension in %s before consulting the cache",
    async (query) => {
      await expect(loadImage(query)).rejects.toMatchObject({ status: 400 });

      expect(mocks.cacheGet).not.toHaveBeenCalled();
      expect(mocks.transformToWebp).not.toHaveBeenCalled();
    },
  );

  it("serves a cache hit after one lookup with the shared response headers", async () => {
    mocks.cacheGet.mockResolvedValue(
      new File(["cached-image"], "image-id", { type: "image/webp" }),
    );

    const response = await loadImage();

    expect(mocks.cacheGet).toHaveBeenCalledOnce();
    expect(mocks.cacheGet).toHaveBeenCalledWith(
      "file-image-id-undefined-undefined-cover",
    );
    expect(mocks.getImageById).not.toHaveBeenCalled();
    expect(mocks.transformToWebp).not.toHaveBeenCalled();
    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      "Cache hit with: file-image-id-undefined-undefined-cover",
    );
    expectImageHeaders(response);
    await expect(response.text()).resolves.toBe("cached-image");
  });

  it("bounds a cache miss, stores it, and uses the same response builder", async () => {
    const storedFile = new File(["optimized-image"], "image-id", {
      type: "image/webp",
    });
    mocks.cacheGet.mockResolvedValue(null);
    mocks.getImageById.mockResolvedValue({
      id: "image-id",
      blob: new Uint8Array([1, 2, 3]),
    });
    mocks.transformToWebp.mockResolvedValue(Buffer.from("optimized-image"));
    mocks.cachePut.mockResolvedValue(storedFile);

    const response = await loadImage("?w=2048&h=1080&fit=contain");

    expect(mocks.cacheGet).toHaveBeenCalledOnce();
    expect(mocks.getImageById).toHaveBeenCalledWith("image-id");
    expect(mocks.transformToWebp).toHaveBeenCalledWith(
      new Uint8Array([1, 2, 3]),
      { width: 2048, height: 1080, fit: "contain" },
    );
    expect(mocks.cachePut).toHaveBeenCalledOnce();
    expect(mocks.cachePut).toHaveBeenCalledWith(
      "file-image-id-2048-1080-contain",
      expect.objectContaining({ name: "image-id", type: "image/webp" }),
    );
    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      "Cache miss with: file-image-id-2048-1080-contain",
    );
    expectImageHeaders(response);
    await expect(response.text()).resolves.toBe("optimized-image");
  });
});
