import { describe, expect, it } from "vitest";

import {
  getImageUrl,
  IMAGE_SIZE_ERROR,
  IMAGE_TYPE_ERROR,
  imageFileSchema,
  type ImageProviderConfig,
} from "./image";

const localConfig: ImageProviderConfig = {
  imageProvider: "local",
  cloudinaryCloudName: null,
};

const cloudinaryConfig: ImageProviderConfig = {
  imageProvider: "cloudinary",
  cloudinaryCloudName: "test-cloud",
};

const dbImage = {
  id: "img-1",
  storageKey: "abc123",
  version: 42,
};

describe("getImageUrl — local provider", () => {
  it("serves DB images from the resource route, dropping transforms", () => {
    expect(getImageUrl(dbImage, localConfig)).toBe("/file/img-1");
    expect(getImageUrl(dbImage, localConfig, { width: 432, height: 324 })).toBe(
      "/file/img-1",
    );
  });

  it("serves a locally stored row (no cloud name) from the resource route", () => {
    expect(
      getImageUrl({ id: "img-1", storageKey: "dinners/uuid" }, localConfig),
    ).toBe("/file/img-1");
  });
});

describe("getImageUrl — cloudinary provider", () => {
  it("builds a versioned delivery URL with f_auto,q_auto and no crop by default", () => {
    expect(getImageUrl(dbImage, cloudinaryConfig)).toBe(
      "https://res.cloudinary.com/test-cloud/image/upload/f_auto,q_auto/v42/abc123",
    );
  });

  it.each([
    [{ width: 432, height: 324 }, "f_auto,q_auto,c_fill,g_auto,w_432,h_324"],
    [
      { width: 432, height: 324, fit: "cover" as const },
      "f_auto,q_auto,c_fill,g_auto,w_432,h_324",
    ],
    [
      { width: 432, height: 324, fit: "contain" as const },
      "f_auto,q_auto,c_fit,w_432,h_324",
    ],
    [
      { width: 432, height: 324, fit: "fill" as const },
      "f_auto,q_auto,c_scale,w_432,h_324",
    ],
    [{ width: 648 }, "f_auto,q_auto,c_fill,g_auto,w_648"],
    [{ height: 480 }, "f_auto,q_auto,c_fill,g_auto,h_480"],
  ])("maps transform options %o", (options, transform) => {
    expect(getImageUrl(dbImage, cloudinaryConfig, options)).toBe(
      `https://res.cloudinary.com/test-cloud/image/upload/${transform}/v42/abc123`,
    );
  });

  it("omits the version segment when the row has none", () => {
    expect(
      getImageUrl({ id: "img-1", storageKey: "abc123" }, cloudinaryConfig),
    ).toBe(
      "https://res.cloudinary.com/test-cloud/image/upload/f_auto,q_auto/abc123",
    );
  });

  it("falls back to the resource route for a not-yet-backfilled row", () => {
    // phase 1 interim: blob-only rows keep serving through /file/:fileId
    expect(
      getImageUrl({ id: "img-1", storageKey: null }, cloudinaryConfig),
    ).toBe("/file/img-1");
  });
});

describe("getImageUrl — static public_id-only assets", () => {
  it("uses cloudinary regardless of the provider when a cloud name exists", () => {
    // delivery needs no credentials; static assets render from the CDN even
    // while IMAGE_PROVIDER is still local (pre-cutover prod, local dev)
    expect(
      getImageUrl(
        { storageKey: "static/hero-image" },
        { imageProvider: "local", cloudinaryCloudName: "test-cloud" },
        { width: 864 },
      ),
    ).toBe(
      "https://res.cloudinary.com/test-cloud/image/upload/f_auto,q_auto,c_fill,g_auto,w_864/static/hero-image",
    );
  });

  it("renders nothing without a cloud name (offline dev hero)", () => {
    expect(getImageUrl({ storageKey: "static/hero-image" }, localConfig)).toBe(
      "",
    );
  });
});

describe("imageFileSchema", () => {
  const schema = imageFileSchema();

  function upload(bytes: number, type = "image/jpeg") {
    return new File([new Uint8Array(bytes)], "upload.jpg", { type });
  }

  function firstError(file: File) {
    const result = schema.safeParse(file);
    return result.success ? null : result.error.issues[0]?.message;
  }

  it.each(["image/jpeg", "image/png", "image/webp"])(
    "accepts a small %s upload",
    (type) => {
      expect(schema.safeParse(upload(10, type)).success).toBe(true);
    },
  );

  it("rejects an empty file", () => {
    expect(firstError(upload(0))).toBe("You must select a file");
  });

  it("rejects a file over the 3MB cap", () => {
    expect(firstError(upload(3 * 1024 * 1024 + 1))).toBe(IMAGE_SIZE_ERROR);
  });

  it.each(["image/gif", "image/svg+xml", "application/pdf", ""])(
    "rejects the %s MIME type server-side",
    (type) => {
      // uploads are forwarded to a third-party provider now — the allowlist
      // is a real gate, not just the input's accept attribute
      expect(firstError(upload(10, type))).toBe(IMAGE_TYPE_ERROR);
    },
  );
});
