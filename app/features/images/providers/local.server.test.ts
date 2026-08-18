import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { createLocalProvider, getLocalImageFile } from "./local.server";

function testEnv() {
  return {
    IMAGE_UPLOAD_FOLDER: mkdtempSync(`${tmpdir()}${sep}images-test-`),
  } as NodeJS.ProcessEnv;
}

describe("local image provider", () => {
  it("stores a file under a generated folder-scoped key and reads it back", async () => {
    const env = testEnv();
    const provider = createLocalProvider(env);
    const file = new File(["cover-bytes"], "cover.jpg", {
      type: "image/jpeg",
    });

    const stored = await provider.store(file, { folder: "dinners" });

    // key = provider-generated (store() runs before any Image row exists),
    // scoped by folder; no cloudinary-only metadata. The bytes are not a
    // real image, so measuring yields nothing — and never fails the store.
    expect(stored.storageKey).toMatch(/^dinners\/[0-9a-f-]{36}$/);
    expect(stored.version).toBeUndefined();
    expect(stored.width).toBeUndefined();
    expect(stored.blurDataUrl).toBeUndefined();

    const roundTripped = await getLocalImageFile(stored.storageKey, env);
    expect(roundTripped).not.toBeNull();
    await expect(new Response(roundTripped!.stream()).text()).resolves.toBe(
      "cover-bytes",
    );
  });

  it("measures intrinsic dimensions from real image bytes", async () => {
    const env = testEnv();
    const provider = createLocalProvider(env);
    // a bare PNG signature + IHDR header declaring 40×30 — image-size reads
    // dimensions from the header alone, no full decode
    const png = Buffer.from(
      "89504e470d0a1a0a0000000d49484452000000280000001e",
      "hex",
    );
    const file = new File([png], "frame.png", { type: "image/png" });

    const stored = await provider.store(file, { folder: "dinner-gallery" });

    expect(stored.width).toBe(40);
    expect(stored.height).toBe(30);
  });

  it("measures a multi-megabyte image without reading it whole a second time", async () => {
    const env = testEnv();
    const provider = createLocalProvider(env);
    const png = Buffer.concat([
      Buffer.from("89504e470d0a1a0a0000000d49484452000000280000001e", "hex"),
      Buffer.alloc(3 * 1024 * 1024, 0x7a),
    ]);
    const file = new File([png], "big.png", { type: "image/png" });
    const readWhole = vi.spyOn(file, "arrayBuffer");
    const readSlice = vi.spyOn(file, "slice");

    const stored = await provider.store(file, { folder: "dinner-gallery" });

    expect(stored.width).toBe(40);
    expect(stored.height).toBe(30);
    expect(readWhole).not.toHaveBeenCalled();
    expect(readSlice).toHaveBeenCalledTimes(1);
    const [start, end] = readSlice.mock.calls[0] as [number, number];
    expect(start).toBe(0);
    expect(end).toBeLessThanOrEqual(512 * 1024);

    const roundTripped = await getLocalImageFile(stored.storageKey, env);
    expect(roundTripped?.size).toBe(png.byteLength);
  });

  it("generates a fresh key per store, never overwriting", async () => {
    const env = testEnv();
    const provider = createLocalProvider(env);
    const file = () => new File(["x"], "x.png", { type: "image/png" });

    const first = await provider.store(file(), { folder: "board-members" });
    const second = await provider.store(file(), { folder: "board-members" });

    expect(first.storageKey).not.toBe(second.storageKey);
  });

  it("destroy removes the file; a missing key then reads as null", async () => {
    const env = testEnv();
    const provider = createLocalProvider(env);
    const file = new File(["doomed"], "doomed.webp", { type: "image/webp" });

    const { storageKey } = await provider.store(file, { folder: "dinners" });
    await provider.destroy(storageKey);

    await expect(getLocalImageFile(storageKey, env)).resolves.toBeNull();
  });

  it("creates the upload folder on demand", async () => {
    const env = {
      IMAGE_UPLOAD_FOLDER: join(
        mkdtempSync(`${tmpdir()}${sep}images-test-`),
        "nested",
        "uploads",
      ),
    } as NodeJS.ProcessEnv;

    const provider = createLocalProvider(env);
    const stored = await provider.store(
      new File(["made-on-demand"], "a.jpg", { type: "image/jpeg" }),
      { folder: "dinners" },
    );

    await expect(
      getLocalImageFile(stored.storageKey, env),
    ).resolves.not.toBeNull();
  });
});
