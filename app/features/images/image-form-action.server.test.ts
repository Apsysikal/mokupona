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
    // maxFiles is forwarded verbatim; unset means the parser's own default
    expect(parseImageFormDataMock).toHaveBeenCalledWith(
      request,
      "cover",
      undefined,
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("returns Conform validation errors without invoking the callback", async () => {
    const formData = new FormData();
    formData.set("name", "");
    parseImageFormDataMock.mockResolvedValue({
      success: true,
      formData,
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
  });

  it("passes the parsed value and original FormData to the callback", async () => {
    const formData = new FormData();
    formData.set("name", "Board member");
    parseImageFormDataMock.mockResolvedValue({
      success: true,
      formData,
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
  });

  it("preserves an error thrown by the callback", async () => {
    const formData = new FormData();
    formData.set("name", "Board member");
    parseImageFormDataMock.mockResolvedValue({
      success: true,
      formData,
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
  });
});
