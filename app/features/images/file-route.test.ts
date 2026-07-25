import { LazyFile } from "@remix-run/lazy-file";
import { afterEach, describe, expect, it, vi } from "vitest";

import { loader } from "~/routes/file.$fileId";

// The fs storage returns LazyFiles, not Files — the mock must too, or it
// masks Response-body incompatibilities (lazy-file >= 5 stopped implementing
// File, which undici rejects as a body).
function lazyFile(content: string) {
  return new LazyFile([content], "image-id", { type: "image/jpeg" });
}

const mocks = vi.hoisted(() => ({
  getImageById: vi.fn(),
  getLocalImageFile: vi.fn(),
}));

vi.mock("~/models/image.server", () => ({
  getImageById: mocks.getImageById,
}));

vi.mock("~/features/images/providers/local.server", () => ({
  getLocalImageFile: mocks.getLocalImageFile,
}));

const storedImage = {
  id: "image-id",
  contentType: "image/jpeg",
  storageKey: "dinners/uuid",
  version: 12,
};

function loadImage(query = "") {
  return loader({
    url: `http://localhost/file/image-id${query}`,
    params: { fileId: "image-id" },
  } as unknown as Parameters<typeof loader>[0]);
}

function expectImageHeaders(response: Response, contentType: string) {
  expect(response.headers.get("Content-Type")).toBe(contentType);
  expect(response.headers.get("Content-Disposition")).toBe(
    'inline; filename="image-id"',
  );
  expect(response.headers.get("Cache-Control")).toBe(
    "public, max-age=31536000, immutable",
  );
  expect(response.headers.get("Content-Length")).not.toBeNull();
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("image resource route", () => {
  it("404s for an unknown image", async () => {
    mocks.getImageById.mockResolvedValue(null);

    await expect(loadImage()).rejects.toMatchObject({ status: 404 });
  });

  it("302s a provider-stored row to the versioned delivery URL under cloudinary", async () => {
    vi.stubEnv("IMAGE_PROVIDER", "cloudinary");
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "test-cloud");
    mocks.getImageById.mockResolvedValue(storedImage);

    const response = await loadImage();

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "https://res.cloudinary.com/test-cloud/image/upload/f_auto,q_auto/v12/dinners/uuid",
    );
    expect(mocks.getLocalImageFile).not.toHaveBeenCalled();
  });

  it("streams the stored file under the local provider, ignoring legacy transform params", async () => {
    mocks.getImageById.mockResolvedValue(storedImage);
    mocks.getLocalImageFile.mockResolvedValue(lazyFile("stored-bytes"));

    // old published URLs still carry w/h/fit — they must keep serving
    const response = await loadImage("?w=432&h=324&fit=cover");

    expect(mocks.getLocalImageFile).toHaveBeenCalledWith("dinners/uuid");
    expectImageHeaders(response, "image/jpeg");
    await expect(response.text()).resolves.toBe("stored-bytes");
  });

  it("404s when the storage key has no local file (e.g. a cloudinary row read back under local)", async () => {
    mocks.getImageById.mockResolvedValue({
      ...storedImage,
      storageKey: "prod/cloudinary-key",
    });
    mocks.getLocalImageFile.mockResolvedValue(null);

    await expect(loadImage()).rejects.toMatchObject({ status: 404 });
  });

  it("404s a keyless row instead of serving an empty body", async () => {
    mocks.getImageById.mockResolvedValue({
      id: "image-id",
      contentType: "image/jpeg",
      storageKey: null,
      version: null,
    });

    await expect(loadImage()).rejects.toMatchObject({ status: 404 });
  });

  it("does not redirect to cloudinary without a cloud name", async () => {
    vi.stubEnv("IMAGE_PROVIDER", "cloudinary");
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "");
    mocks.getImageById.mockResolvedValue(storedImage);
    mocks.getLocalImageFile.mockResolvedValue(lazyFile("local-fallback"));

    const response = await loadImage();

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("local-fallback");
  });
});
