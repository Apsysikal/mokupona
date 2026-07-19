import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { withParsedImageForm } from "./image-form-action.server";
import { parseImageFormData } from "./image-upload.server";

vi.mock("./image-upload.server", () => ({
  parseImageFormData: vi.fn(),
}));

const schema = z.object({
  name: z.string({ error: "Name is required" }).min(1, "Name is required"),
});

const request = new Request("http://localhost/upload", { method: "POST" });
const parseImageFormDataMock = vi.mocked(parseImageFormData);

afterEach(() => {
  vi.clearAllMocks();
});

describe("withParsedImageForm", () => {
  it("returns an upload error for the configured field without invoking the callback", async () => {
    parseImageFormDataMock.mockResolvedValue({
      success: false,
      uploadError: "Upload failed",
    });
    const onSuccess = vi.fn();

    const result = await withParsedImageForm(request, {
      fieldName: "cover",
      schema,
      onSuccess,
    });

    expect(result).toEqual({
      status: "error",
      error: { cover: ["Upload failed"] },
    });
    expect(parseImageFormDataMock).toHaveBeenCalledWith(request, "cover");
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("returns Conform validation errors and discards the staged image", async () => {
    const formData = new FormData();
    formData.set("name", "");
    const discardImage = vi.fn().mockResolvedValue(undefined);
    parseImageFormDataMock.mockResolvedValue({
      success: true,
      formData,
      discardImage,
    });
    const onSuccess = vi.fn();

    const result = await withParsedImageForm(request, {
      fieldName: "image",
      schema,
      onSuccess,
    });

    expect(result).toMatchObject({
      status: "error",
      error: { name: ["Name is required"] },
    });
    expect(onSuccess).not.toHaveBeenCalled();
    expect(discardImage).toHaveBeenCalledOnce();
  });

  it("passes the parsed value and original FormData to the callback before cleanup", async () => {
    const formData = new FormData();
    formData.set("name", "Board member");
    const discardImage = vi.fn().mockResolvedValue(undefined);
    parseImageFormDataMock.mockResolvedValue({
      success: true,
      formData,
      discardImage,
    });
    const successResult = { id: "member-id" };
    const onSuccess = vi.fn().mockResolvedValue(successResult);

    const result = await withParsedImageForm(request, {
      fieldName: "image",
      schema,
      onSuccess,
    });

    expect(result).toBe(successResult);
    expect(onSuccess).toHaveBeenCalledWith({
      value: { name: "Board member" },
      formData,
    });
    expect(discardImage).toHaveBeenCalledOnce();
  });

  it("discards the staged image and preserves an error thrown by the callback", async () => {
    const formData = new FormData();
    formData.set("name", "Board member");
    const discardImage = vi.fn().mockResolvedValue(undefined);
    parseImageFormDataMock.mockResolvedValue({
      success: true,
      formData,
      discardImage,
    });
    const callbackError = new Error("Write failed");

    const result = withParsedImageForm(request, {
      fieldName: "image",
      schema,
      onSuccess: () => {
        throw callbackError;
      },
    });

    await expect(result).rejects.toBe(callbackError);
    expect(discardImage).toHaveBeenCalledOnce();
  });
});
