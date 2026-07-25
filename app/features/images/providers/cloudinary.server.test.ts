import { afterEach, describe, expect, it, vi } from "vitest";

import { createCloudinaryProvider } from "./cloudinary.server";

// Dev/CI never talk to Cloudinary: the SDK is fully mocked, upload_stream's
// callback style included.
const mocks = vi.hoisted(() => ({
  config: vi.fn(),
  uploadStream: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock("cloudinary", () => ({
  v2: {
    config: mocks.config,
    uploader: {
      upload_stream: mocks.uploadStream,
      destroy: mocks.destroy,
    },
  },
}));

const env = {
  CLOUDINARY_CLOUD_NAME: "test-cloud",
  CLOUDINARY_API_KEY: "key",
  CLOUDINARY_API_SECRET: "secret",
  CLOUDINARY_FOLDER_PREFIX: "test",
} as NodeJS.ProcessEnv;

const uploadResponse = {
  public_id: "abc123",
  version: 17,
  width: 1200,
  height: 800,
};

function mockUploadSuccess() {
  mocks.uploadStream.mockImplementation(
    (
      _options: unknown,
      callback: (error: undefined, result: typeof uploadResponse) => void,
    ) => ({
      end: () => callback(undefined, uploadResponse),
    }),
  );
}

function mockBlurFetch(ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    arrayBuffer: async () => new TextEncoder().encode("blurred").buffer,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("createCloudinaryProvider", () => {
  it("throws on a missing configuration variable", () => {
    expect(() =>
      createCloudinaryProvider({
        ...env,
        CLOUDINARY_API_SECRET: undefined,
      } as NodeJS.ProcessEnv),
    ).toThrow(/CLOUDINARY_API_SECRET/);
    expect(mocks.config).not.toHaveBeenCalled();
  });

  it("configures the SDK with secure delivery", () => {
    createCloudinaryProvider(env);

    expect(mocks.config).toHaveBeenCalledWith({
      cloud_name: "test-cloud",
      api_key: "key",
      api_secret: "secret",
      secure: true,
    });
  });

  it("stores into the env-prefixed asset folder and returns the response metadata", async () => {
    mockUploadSuccess();
    const fetchMock = mockBlurFetch();
    const provider = createCloudinaryProvider(env);

    const stored = await provider.store(
      new File(["bytes"], "cover.jpg", { type: "image/jpeg" }),
      { folder: "dinners" },
    );

    expect(mocks.uploadStream).toHaveBeenCalledWith(
      { resource_type: "image", asset_folder: "test/dinners" },
      expect.any(Function),
    );
    // the blur placeholder is fetched from the freshly uploaded, versioned asset
    expect(fetchMock).toHaveBeenCalledWith(
      "https://res.cloudinary.com/test-cloud/image/upload/w_100,q_auto,f_webp,e_blur:1000/v17/abc123",
    );
    expect(stored).toEqual({
      storageKey: "abc123",
      version: 17,
      width: 1200,
      height: 800,
      blurDataUrl: `data:image/webp;base64,${Buffer.from("blurred").toString("base64")}`,
    });
  });

  it("still stores when the blur placeholder fetch fails", async () => {
    mockUploadSuccess();
    mockBlurFetch(false);
    const provider = createCloudinaryProvider(env);

    const stored = await provider.store(
      new File(["bytes"], "cover.jpg", { type: "image/jpeg" }),
      { folder: "dinners" },
    );

    expect(stored.storageKey).toBe("abc123");
    expect(stored.blurDataUrl).toBeUndefined();
  });

  it("rejects when the upload reports an error", async () => {
    mocks.uploadStream.mockImplementation(
      (
        _options: unknown,
        callback: (error: Error, result: undefined) => void,
      ) => ({
        end: () => callback(new Error("quota exceeded"), undefined),
      }),
    );
    const provider = createCloudinaryProvider(env);

    await expect(
      provider.store(new File(["bytes"], "cover.jpg"), { folder: "dinners" }),
    ).rejects.toThrow("quota exceeded");
  });

  it("destroys by public_id with CDN invalidation", async () => {
    mocks.destroy.mockResolvedValue({ result: "ok" });
    const provider = createCloudinaryProvider(env);

    await provider.destroy("abc123");

    expect(mocks.destroy).toHaveBeenCalledWith("abc123", { invalidate: true });
  });
});
