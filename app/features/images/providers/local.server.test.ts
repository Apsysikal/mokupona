import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";

import { describe, expect, it } from "vitest";

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
    // scoped by folder; no cloudinary-only metadata
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
