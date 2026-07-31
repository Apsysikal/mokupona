import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { FileLike, StagedLookup } from "./p3-disk-staged.server";
import {
  parseImageFormDataStagingToDisk,
  stagedImageSchema,
  withDiskStagedImageForm,
} from "./p3-disk-staged.server";

import { createFsFolderStorage } from "~/shared/fs-file-storage.server";
import { imageFileSchema } from "~/shared/image";

const directories: string[] = [];

function tempStorage() {
  const directory = mkdtempSync(join(tmpdir(), "p3-staging-"));
  directories.push(directory);
  return { directory, storage: createFsFolderStorage(directory) };
}

/**
 * file-storage shards keys into content-hashed directories rather than mirroring
 * the key path, so count the payload files rather than looking for `staging/`.
 */
function stagingEntries(directory: string) {
  return readdirSync(directory, { recursive: true }).filter((entry) =>
    String(entry).endsWith(".dat"),
  );
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function multipartRequest({
  size = 2048,
  type = "image/png",
  title = "A dinner",
}: { size?: number; type?: string; title?: string } = {}) {
  const formData = new FormData();
  formData.set(
    "cover",
    new File([new Uint8Array(size).fill(2)], "cover.png", { type }),
  );
  formData.set("title", title);
  return new Request("http://localhost/admin/dinners/new", {
    method: "POST",
    body: formData,
  });
}

const buildSchema = (lookup: StagedLookup) =>
  z.object({
    title: z.string().min(1, "Title is required"),
    cover: stagedImageSchema(lookup),
  });

describe("why the staged handle cannot live in the FormData", () => {
  it("LazyFile is neither a File nor a Blob, so FormData rejects it", async () => {
    const { storage } = tempStorage();
    await storage.put(
      "k",
      new File([new Uint8Array(16)], "y.png", { type: "image/png" }),
    );
    const lazy = await storage.get("k");

    expect(lazy).not.toBeInstanceOf(File);
    expect(lazy).not.toBeInstanceOf(Blob);

    // this is what breaks the README's `return fileStorage.put(...)` pattern:
    // FormData string-coerces the non-Blob and LazyFile#toString throws
    expect(() => new FormData().append("cover", lazy as never)).toThrow(
      /Cannot convert LazyFile to string/,
    );

    // ...and it would still fail validation even if it got that far
    expect(imageFileSchema().safeParse(lazy).success).toBe(false);
  });
});

describe("parseImageFormDataStagingToDisk", () => {
  it("puts a storage key in the FormData and the bytes on disk", async () => {
    const { directory, storage } = tempStorage();

    const result = await parseImageFormDataStagingToDisk(
      multipartRequest({ size: 4096 }),
      "cover",
      storage,
    );

    expect(result.success).toBe(true);
    const cover = result.success ? result.formData.get("cover") : null;
    expect(typeof cover).toBe("string");
    expect(cover).toMatch(/^staging\//);

    expect(stagingEntries(directory)).toHaveLength(1);
    expect(result.staged[0]?.file.size).toBe(4096);
    expect(result.staged[0]?.file.type).toBe("image/png");
  });

  it("keeps the field present but stages nothing for an empty file input", async () => {
    const { directory, storage } = tempStorage();
    const formData = new FormData();
    formData.set(
      "cover",
      new File([], "", { type: "application/octet-stream" }),
    );
    formData.set("title", "A dinner");

    const result = await parseImageFormDataStagingToDisk(
      new Request("http://localhost/x", { method: "POST", body: formData }),
      "cover",
      storage,
    );

    expect(result.success && result.formData.has("cover")).toBe(true);
    expect(result.staged).toEqual([]);
    expect(stagingEntries(directory)).toHaveLength(0);
  });

  it("rejects a file over the parse ceiling before writing anything", async () => {
    const { directory, storage } = tempStorage();

    const result = await parseImageFormDataStagingToDisk(
      multipartRequest({ size: 5 * 1024 * 1024 }),
      "cover",
      storage,
    );

    expect(result).toMatchObject({
      success: false,
      uploadError: "File cannot be greater than 3MB",
    });
    expect(stagingEntries(directory)).toHaveLength(0);
  });
});

describe("stagedImageSchema", () => {
  const file = (overrides: Partial<FileLike> = {}): FileLike => ({
    name: "cover.png",
    size: 1024,
    type: "image/png",
    stream: () => new ReadableStream(),
    ...overrides,
  });

  const parse = (value: unknown, staged: FileLike | undefined) =>
    stagedImageSchema(() => staged).safeParse(value);

  it("resolves a staged key to the file", () => {
    const staged = file();
    const result = parse("staging/abc", staged);
    expect(result.success && result.data).toBe(staged);
  });

  it("reports the shared messages for each rule", () => {
    expect(parse("", undefined).error?.issues[0]?.message).toBe(
      "You must select a file",
    );
    expect(parse("staging/gone", undefined).error?.issues[0]?.message).toBe(
      "You must select a file",
    );
    expect(
      parse("staging/a", file({ size: 4 * 1024 * 1024 })).error?.issues[0]
        ?.message,
    ).toBe("File cannot be greater than 3MB");
    expect(
      parse("staging/a", file({ type: "application/pdf" })).error?.issues[0]
        ?.message,
    ).toBe("File must be a JPEG, PNG or WebP image");
  });
});

describe("withDiskStagedImageForm", () => {
  it("validates before uploading and sweeps staging after committing", async () => {
    const { directory, storage } = tempStorage();
    const upload = vi.fn().mockResolvedValue({ storageKey: "dinners/x" });

    const result = await withDiskStagedImageForm(multipartRequest(), {
      fieldName: "cover",
      buildSchema,
      storage,
      async onSuccess({ value }) {
        // the bytes are on disk here, not on the heap, and Cloudinary has not
        // been touched until the whole submission proved valid
        expect(value.cover.size).toBe(2048);
        expect(stagingEntries(directory)).toHaveLength(1);
        return upload(value.cover);
      },
    });

    expect(result).toEqual({ storageKey: "dinners/x" });
    expect(upload).toHaveBeenCalledTimes(1);
    expect(stagingEntries(directory)).toHaveLength(0);
  });

  it("sweeps staged files when another field fails validation", async () => {
    const { directory, storage } = tempStorage();
    const onSuccess = vi.fn();

    const result = await withDiskStagedImageForm(
      multipartRequest({ title: "" }),
      { fieldName: "cover", buildSchema, storage, onSuccess },
    );

    expect(onSuccess).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: "error" });
    expect(stagingEntries(directory)).toHaveLength(0);
  });

  it("sweeps staged files when the action throws", async () => {
    const { directory, storage } = tempStorage();

    await expect(
      withDiskStagedImageForm(multipartRequest(), {
        fieldName: "cover",
        buildSchema,
        storage,
        onSuccess: () => {
          throw new Error("db down");
        },
      }),
    ).rejects.toThrow("db down");

    expect(stagingEntries(directory)).toHaveLength(0);
  });

  it("reports the oversize error as a Conform result", async () => {
    const { storage } = tempStorage();
    const onSuccess = vi.fn();

    const result = await withDiskStagedImageForm(
      multipartRequest({ size: 5 * 1024 * 1024 }),
      { fieldName: "cover", buildSchema, storage, onSuccess },
    );

    expect(result).toEqual({
      status: "error",
      error: { cover: ["File cannot be greater than 3MB"] },
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
