import { randomUUID } from "node:crypto";

import type { FileUpload } from "@remix-run/form-data-parser";
import {
  MaxFilesExceededError,
  MaxFileSizeExceededError,
  parseFormData,
} from "@remix-run/form-data-parser";

import { createFsTempStorage } from "~/shared/fs-file-storage.server";
import { IMAGE_SIZE_ERROR, MAX_STAGED_IMAGE_BYTES } from "~/shared/image";

// Staged-upload storage: IMAGE_UPLOAD_FOLDER when configured (production),
// otherwise a per-process temp directory.
const fileStorage = createFsTempStorage({
  dir: process.env.IMAGE_UPLOAD_FOLDER,
});

// The event-specific key prefix lives here, at the uploads/event boundary —
// the storage primitive itself is key-agnostic.
function getStorageKey(id: string) {
  return `dinner-${id}-cover`;
}

// The staging ceiling is deliberately higher than the schema's user-facing
// limit so near-boundary files reach the canonical Zod validation. Files above
// the staging ceiling are rejected before disk I/O completes with the same
// policy-owned error message.
const MAX_FILES = 1;

export type ImageUploadSuccess = {
  success: true;
  formData: FormData;
  /**
   * Remove the temp file from disk without persisting it.
   * Safe to call when no file was uploaded (no-op in that case), and
   * idempotent — call it from a `finally` so the staged file is removed on
   * success and on any thrown error alike.
   */
  discardImage(): Promise<void>;
};

export type ImageUploadError = {
  success: false;
  uploadError: string;
};

export type ImageUploadResult = ImageUploadSuccess | ImageUploadError;

/**
 * Parse a multipart/form-data request that may contain a single image upload.
 *
 * - Generates a unique temporary key per request so concurrent uploads never
 *   collide on the filesystem.
 * - Handles file-size and file-count errors internally, returning a typed
 *   result instead of throwing.
 * - Returns a bound `discardImage` helper pre-wired to the request's unique
 *   temp file, so callers never manage storage keys directly. Persisting the
 *   bytes is the model layer's job (`fileToImageData` into the owning
 *   transaction), never this module's.
 *
 * @param fieldName The multipart field name that carries the file (e.g. "cover", "image").
 */
export async function parseImageFormData(
  request: Request,
  fieldName: string,
): Promise<ImageUploadResult> {
  const tempId = randomUUID();
  let fileWasWritten = false;

  const uploadHandler = async (fileUpload: FileUpload) => {
    if (fileUpload.fieldName === fieldName) {
      await fileStorage.set(getStorageKey(tempId), fileUpload);
      fileWasWritten = true;
      return fileUpload;
    }
  };

  async function discardImage(): Promise<void> {
    if (fileWasWritten) {
      fileWasWritten = false;
      await fileStorage.remove(getStorageKey(tempId));
    }
  }

  try {
    const formData = await parseFormData(
      request,
      { maxFileSize: MAX_STAGED_IMAGE_BYTES, maxFiles: MAX_FILES },
      uploadHandler,
    );
    return { success: true, formData, discardImage };
  } catch (error) {
    // Clean up any partial write before returning an error result.
    await discardImage();
    if (error instanceof MaxFileSizeExceededError) {
      return { success: false, uploadError: IMAGE_SIZE_ERROR };
    }
    if (error instanceof MaxFilesExceededError) {
      return { success: false, uploadError: "You can only upload one file" };
    }
    throw error;
  }
}
