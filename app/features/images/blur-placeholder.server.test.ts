import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// getBlurDataUrl keeps a module-level per-boot cache; import a fresh module
// per test so cache state can't leak between them.
async function importFresh() {
  vi.resetModules();
  return import("./blur-placeholder.server");
}

function stubFetch(ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    arrayBuffer: async () => new TextEncoder().encode("tiny-webp").buffer,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const env = { CLOUDINARY_CLOUD_NAME: "test-cloud" } as NodeJS.ProcessEnv;

beforeEach(() => {
  stubFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchBlurDataUrl", () => {
  it("encodes the blurred variant as a webp data URL", async () => {
    const { fetchBlurDataUrl } = await importFresh();
    const fetchMock = stubFetch();

    const dataUrl = await fetchBlurDataUrl({
      cloudName: "test-cloud",
      publicId: "abc123",
      version: 4,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://res.cloudinary.com/test-cloud/image/upload/w_100,q_auto,f_webp,e_blur:1000/v4/abc123",
    );
    expect(dataUrl).toBe(
      `data:image/webp;base64,${Buffer.from("tiny-webp").toString("base64")}`,
    );
  });

  it("omits the version segment when none is given", async () => {
    const { fetchBlurDataUrl } = await importFresh();
    const fetchMock = stubFetch();

    await fetchBlurDataUrl({
      cloudName: "test-cloud",
      publicId: "static/hero-image",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://res.cloudinary.com/test-cloud/image/upload/w_100,q_auto,f_webp,e_blur:1000/static/hero-image",
    );
  });

  it("returns null instead of throwing on fetch failures", async () => {
    const { fetchBlurDataUrl } = await importFresh();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(
      fetchBlurDataUrl({ cloudName: "test-cloud", publicId: "abc123" }),
    ).resolves.toBeNull();
  });

  it("returns null on a non-ok response", async () => {
    const { fetchBlurDataUrl } = await importFresh();
    stubFetch(false);

    await expect(
      fetchBlurDataUrl({ cloudName: "test-cloud", publicId: "abc123" }),
    ).resolves.toBeNull();
  });
});

describe("getBlurDataUrl (static assets)", () => {
  it("fetches once per public_id and serves repeats from the cache", async () => {
    const { getBlurDataUrl } = await importFresh();
    const fetchMock = stubFetch();

    const first = await getBlurDataUrl("static/hero-image", env);
    const second = await getBlurDataUrl("static/hero-image", env);
    await getBlurDataUrl("static/accent-image", env);

    expect(first).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("resolves null without fetching when no cloud name is configured", async () => {
    const { getBlurDataUrl } = await importFresh();
    const fetchMock = stubFetch();

    await expect(
      getBlurDataUrl("static/hero-image", {} as NodeJS.ProcessEnv),
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
