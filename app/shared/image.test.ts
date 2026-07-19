import { describe, expect, it } from "vitest";

import { getImageUrl, type ImageProviderConfig } from "./image";

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
