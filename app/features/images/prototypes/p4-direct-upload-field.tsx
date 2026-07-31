import { useRef, useState } from "react";

import type { DirectUploadTicket } from "./p4-signed-direct.server";

/**
 * PROTOTYPE 4, client half — the progressive enhancement for direct uploads.
 *
 * The baseline is an ordinary `<input type="file">`. With scripting off, or
 * before hydration, or if anything about the direct upload fails, the file
 * posts as multipart to our own action exactly as it does today. Nothing here
 * is required for the form to work.
 *
 * The enhancement: once a file is chosen, upload it straight to Cloudinary with
 * the signed ticket, then swap what the form submits — the hidden descriptor
 * field is enabled and the file input is disabled, so the browser posts a short
 * string instead of megabytes of image. Both inputs share the field name, so
 * Conform sees one field and reports errors on it either way.
 *
 * `disabled` is what makes the swap work: disabled controls are excluded from
 * form submission, so exactly one of the two inputs is ever posted. That is
 * also the fallback mechanism — on any upload failure we simply leave the file
 * input enabled and the server-side path runs.
 */

type UploadState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "uploaded"; descriptor: string }
  | { status: "failed"; message: string };

export interface DirectUploadFieldProps {
  /** Shared by both inputs so Conform treats them as one field. */
  name: string;
  id?: string;
  ticket: DirectUploadTicket;
  accept?: string;
  /** Injectable for tests; defaults to the platform fetch. */
  uploader?: typeof fetch;
}

export function DirectUploadField({
  name,
  id,
  ticket,
  accept = "image/jpeg,image/png,image/webp",
  uploader = fetch,
}: DirectUploadFieldProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ status: "idle" });

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      setState({ status: "idle" });
      return;
    }

    setState({ status: "uploading" });

    const body = new FormData();
    body.set("file", file);
    body.set("api_key", ticket.apiKey);
    body.set("timestamp", String(ticket.timestamp));
    body.set("signature", ticket.signature);
    // must match the signed params exactly or Cloudinary rejects the upload
    body.set("asset_folder", ticket.assetFolder);

    try {
      const response = await uploader(ticket.uploadUrl, {
        method: "POST",
        body,
      });
      if (!response.ok)
        throw new Error(`Cloudinary responded ${response.status}`);

      const result = await response.json();
      setState({ status: "uploaded", descriptor: JSON.stringify(result) });
    } catch {
      // Degrade to the baseline: the file input stays enabled, so submitting
      // posts the bytes to our own action and the server-side path handles it.
      setState({
        status: "failed",
        message:
          "Could not upload directly — the file will be sent with the form.",
      });
    }
  }

  const uploaded = state.status === "uploaded";

  return (
    <>
      <input
        ref={fileInput}
        type="file"
        name={name}
        id={id}
        accept={accept}
        onChange={handleChange}
        // disabled only once Cloudinary has the bytes, so the payload is not
        // posted twice; every other state leaves the baseline intact
        disabled={uploaded}
      />

      <input
        type="hidden"
        name={name}
        value={uploaded ? state.descriptor : ""}
        disabled={!uploaded}
        readOnly
      />

      <p aria-live="polite" data-testid="direct-upload-status">
        {state.status === "uploading" ? "Uploading…" : null}
        {state.status === "failed" ? state.message : null}
      </p>
    </>
  );
}
