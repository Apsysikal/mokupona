import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { StoredImage } from "../types";

import {
  StagedImageFile,
  parseImageFormDataUploadingDuringParse,
  withParseTimeUploadedImageForm,
} from "./p2-parse-time-upload.server";

import { imageFileSchema } from "~/shared/image";

function pngBytes(size: number) {
  return new Uint8Array(size).fill(1);
}

/** A multipart request whose file part precedes the text parts, as a real form posts. */
function multipartRequest({
  size = 1024,
  type = "image/png",
  title = "A dinner",
}: { size?: number; type?: string; title?: string } = {}) {
  const formData = new FormData();
  formData.set("cover", new File([pngBytes(size)], "cover.png", { type }));
  formData.set("title", title);
  return new Request("http://localhost/admin/dinners/new", {
    method: "POST",
    body: formData,
  });
}

const stored: StoredImage = {
  storageKey: "dinners/abc123",
  version: 7,
  width: 800,
  height: 600,
};

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  cover: imageFileSchema(),
});

describe("StagedImageFile", () => {
  it("passes the unchanged imageFileSchema while holding no bytes", () => {
    const staged = new StagedImageFile(stored, {
      name: "cover.png",
      type: "image/png",
      size: 2048,
    });

    expect(staged).toBeInstanceOf(File);
    expect(staged.size).toBe(2048);
    expect(imageFileSchema().safeParse(staged).success).toBe(true);
  });

  it("survives a FormData round trip by reference", () => {
    const staged = new StagedImageFile(stored, {
      name: "cover.png",
      type: "image/png",
      size: 2048,
    });
    const formData = new FormData();
    formData.set("cover", staged);

    // FormData re-wraps a plain Blob but stores a File as-is, which is what
    // lets the provider result ride along to the action
    const roundTripped = formData.get("cover");
    expect(roundTripped).toBe(staged);
    expect((roundTripped as StagedImageFile).stored).toEqual(stored);
  });
});

describe("parseImageFormDataUploadingDuringParse", () => {
  it("uploads while parsing and replaces the payload with the stand-in", async () => {
    const store = vi.fn().mockResolvedValue(stored);

    const result = await parseImageFormDataUploadingDuringParse(
      multipartRequest({ size: 4096 }),
      "cover",
      store,
    );

    expect(result.success).toBe(true);
    expect(store).toHaveBeenCalledTimes(1);
    expect(result.staged).toEqual([stored]);

    const cover = result.success ? result.formData.get("cover") : null;
    expect(cover).toBeInstanceOf(StagedImageFile);
    expect((cover as StagedImageFile).size).toBe(4096);
    // the bytes are gone from the FormData, only the metadata remains
    expect(await (cover as File).arrayBuffer()).toEqual(new ArrayBuffer(0));
  });

  it("uploads before the rest of the form has been parsed", async () => {
    const order: string[] = [];
    const store = vi.fn().mockImplementation(async () => {
      order.push("upload");
      return stored;
    });

    const result = await parseImageFormDataUploadingDuringParse(
      multipartRequest(),
      "cover",
      store,
    );
    order.push("parse-complete");

    // this ordering is the prototype's central risk: the asset exists before
    // anything has validated the submission it belongs to
    expect(order).toEqual(["upload", "parse-complete"]);
    expect(result.success && result.formData.get("title")).toBe("A dinner");
  });

  it("does not upload a file the schema will reject anyway", async () => {
    const store = vi.fn().mockResolvedValue(stored);

    const result = await parseImageFormDataUploadingDuringParse(
      multipartRequest({ type: "application/pdf" }),
      "cover",
      store,
    );

    expect(store).not.toHaveBeenCalled();
    expect(result.staged).toEqual([]);
    // the original upload is passed through so Zod owns the error message
    expect(result.success && result.formData.get("cover")).toBeInstanceOf(File);
  });

  it("rejects a file over the parse ceiling without invoking the store", async () => {
    const store = vi.fn().mockResolvedValue(stored);

    const result = await parseImageFormDataUploadingDuringParse(
      multipartRequest({ size: 5 * 1024 * 1024 }),
      "cover",
      store,
    );

    expect(result).toMatchObject({
      success: false,
      uploadError: "File cannot be greater than 3MB",
    });
    expect(store).not.toHaveBeenCalled();
  });
});

describe("withParseTimeUploadedImageForm", () => {
  it("hands the provider result to onSuccess without re-uploading", async () => {
    const store = vi.fn().mockResolvedValue(stored);
    const destroy = vi.fn().mockResolvedValue(undefined);

    const result = await withParseTimeUploadedImageForm(multipartRequest(), {
      fieldName: "cover",
      schema,
      store,
      destroy,
      onSuccess: ({ value }) => (value.cover as StagedImageFile).stored,
    });

    expect(result).toEqual(stored);
    expect(store).toHaveBeenCalledTimes(1);
    expect(destroy).not.toHaveBeenCalled();
  });

  it("destroys the staged asset when validation fails on another field", async () => {
    const store = vi.fn().mockResolvedValue(stored);
    const destroy = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn();

    const result = await withParseTimeUploadedImageForm(
      multipartRequest({ title: "" }),
      { fieldName: "cover", schema, store, destroy, onSuccess },
    );

    expect(onSuccess).not.toHaveBeenCalled();
    expect(destroy).toHaveBeenCalledWith("dinners/abc123");
    expect(result).toMatchObject({ status: "error" });
  });

  it("destroys the staged asset when the database write throws", async () => {
    const store = vi.fn().mockResolvedValue(stored);
    const destroy = vi.fn().mockResolvedValue(undefined);

    await expect(
      withParseTimeUploadedImageForm(multipartRequest(), {
        fieldName: "cover",
        schema,
        store,
        destroy,
        onSuccess: () => {
          throw new Error("db down");
        },
      }),
    ).rejects.toThrow("db down");

    expect(destroy).toHaveBeenCalledWith("dinners/abc123");
  });
});
