import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DirectUploadField } from "./p4-direct-upload-field";
import type { DirectUploadTicket } from "./p4-signed-direct.server";

const ticket: DirectUploadTicket = {
  uploadUrl: "https://api.cloudinary.com/v1_1/test-cloud/image/upload",
  apiKey: "key",
  timestamp: 1_700_000_000,
  signature: "signed",
  assetFolder: "test/dinners",
};

const cloudinaryResponse = {
  public_id: "abc123",
  version: 42,
  signature: "response-signature",
  width: 1200,
  height: 800,
  bytes: 512 * 1024,
  format: "png",
  resource_type: "image",
  asset_folder: "test/dinners",
};

function renderField(uploader?: typeof fetch) {
  const view = render(
    <form data-testid="form">
      <DirectUploadField name="cover" ticket={ticket} uploader={uploader} />
    </form>,
  );

  const form = screen.getByTestId("form") as HTMLFormElement;
  const fileInput = form.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;

  return { ...view, form, fileInput };
}

/**
 * Passing `files` through `fireEvent.change` does not populate the input's file
 * list in happy-dom — `FormData` then yields an empty `File`, which still
 * satisfies `instanceof` and would make these assertions vacuous. Assign the
 * list first, then dispatch.
 */
function selectFile(input: HTMLInputElement, file: File) {
  (input as unknown as { files: File[] }).files = [file];
  fireEvent.change(input);
}

const imageFile = () =>
  new File([new Uint8Array(2048).fill(1)], "cover.png", { type: "image/png" });

/** What the browser would actually post for this form right now. */
function submittedValue(form: HTMLFormElement) {
  return new FormData(form).get("cover");
}

describe("DirectUploadField — baseline (no JS / pre-hydration)", () => {
  // The markup below is exactly what a scripting-disabled browser receives and
  // submits, so asserting on it is the real test of the no-JS path — nothing
  // in this component's behaviour can run there.
  const markup = renderToStaticMarkup(
    <DirectUploadField name="cover" ticket={ticket} />,
  );

  it("serves an enabled file input under the field name", () => {
    expect(markup).toContain('type="file"');
    expect(markup).toContain('name="cover"');
    // not disabled → the browser posts the bytes to our own action
    expect(/<input[^>]*type="file"[^>]*disabled/.test(markup)).toBe(false);
  });

  it("serves the descriptor field disabled, so it is never submitted", () => {
    const hidden = /<input[^>]*type="hidden"[^>]*>/.exec(markup)?.[0] ?? "";
    expect(hidden).toContain('name="cover"');
    expect(hidden).toContain("disabled");
  });

  it("posts the file when a disabled hidden field sits beside it", () => {
    // pins the mechanism the whole swap relies on: disabled controls are
    // excluded from submission, so exactly one of the two inputs is posted.
    // The uploader never settles, so the field stays in its pre-upload state.
    const pending = vi.fn(() => new Promise<Response>(() => {}));
    const { form, fileInput } = renderField(pending as unknown as typeof fetch);
    expect(fileInput.disabled).toBe(false);

    selectFile(fileInput, imageFile());

    const value = submittedValue(form);
    expect(value).toBeInstanceOf(File);
    expect((value as File).name).toBe("cover.png");
  });
});

describe("DirectUploadField — enhanced path", () => {
  it("uploads to Cloudinary and posts the descriptor instead of the bytes", async () => {
    const uploader = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => cloudinaryResponse,
    }) as unknown as typeof fetch;

    const { form, fileInput } = renderField(uploader);
    selectFile(fileInput, imageFile());

    await waitFor(() => expect(fileInput.disabled).toBe(true));

    // the bytes went to Cloudinary, not to our action
    const value = submittedValue(form);
    expect(typeof value).toBe("string");
    expect(JSON.parse(value as string)).toEqual(cloudinaryResponse);
    expect(new FormData(form).getAll("cover")).toHaveLength(1);
  });

  it("sends the signed ticket params Cloudinary requires", async () => {
    const uploader = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => cloudinaryResponse,
    }) as unknown as typeof fetch;

    const { fileInput } = renderField(uploader);
    selectFile(fileInput, imageFile());

    await waitFor(() => expect(uploader).toHaveBeenCalled());

    const [url, init] = vi.mocked(uploader).mock.calls[0]!;
    expect(url).toBe(ticket.uploadUrl);

    const body = (init as RequestInit).body as FormData;
    expect(body.get("api_key")).toBe("key");
    expect(body.get("timestamp")).toBe("1700000000");
    expect(body.get("signature")).toBe("signed");
    // must match the signed params or Cloudinary rejects it
    expect(body.get("asset_folder")).toBe("test/dinners");
    expect(body.get("file")).toBeInstanceOf(File);
  });
});

describe("DirectUploadField — degradation", () => {
  it("falls back to posting the file when Cloudinary is unreachable", async () => {
    const uploader = vi
      .fn()
      .mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const { form, fileInput } = renderField(uploader);
    selectFile(fileInput, imageFile());

    await waitFor(() =>
      expect(screen.getByTestId("direct-upload-status")).toHaveTextContent(
        /will be sent with the form/i,
      ),
    );

    // the enhancement failed, so the baseline is still in place — the file
    // input was never disabled and the bytes post to our own action
    expect(fileInput.disabled).toBe(false);
    const value = submittedValue(form);
    expect(value).toBeInstanceOf(File);
    expect((value as File).name).toBe("cover.png");
    expect((value as File).size).toBe(2048);
  });

  it("falls back when Cloudinary rejects the upload", async () => {
    const uploader = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    }) as unknown as typeof fetch;

    const { form, fileInput } = renderField(uploader);
    selectFile(fileInput, imageFile());

    await waitFor(() =>
      expect(screen.getByTestId("direct-upload-status")).toHaveTextContent(
        /will be sent with the form/i,
      ),
    );

    expect(fileInput.disabled).toBe(false);
    const value = submittedValue(form);
    expect(value).toBeInstanceOf(File);
    expect((value as File).size).toBe(2048);
  });
});
