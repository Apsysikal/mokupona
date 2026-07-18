import { randomUUID } from "node:crypto";

import type { FileUpload } from "@remix-run/form-data-parser";
import {
  MaxFilesExceededError,
  MaxFileSizeExceededError,
  parseFormData,
} from "@remix-run/form-data-parser";

import { createFsTempStorage } from "~/shared/fs-file-storage.server";

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

// The upload handler streams to a temp file up to 4 MB so the file is available
// for Zod refinement. The schema enforces the real 3 MB user-facing limit and
// produces the canonical "File cannot be greater than 3MB" error for 3–4 MB
// files. Files exceeding 4 MB are rejected here (before disk I/O completes)
// and report the same user-facing message since the advertised limit is 3 MB.
const MAX_FILE_SIZE = 1024 * 1024 * 4;
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
      { maxFileSize: MAX_FILE_SIZE, maxFiles: MAX_FILES },
      uploadHandler,
    );
    return { success: true, formData, discardImage };
  } catch (error) {
    // Clean up any partial write before returning an error result.
    await discardImage();
    if (error instanceof MaxFileSizeExceededError) {
      return { success: false, uploadError: "File cannot be greater than 3MB" };
    }
    if (error instanceof MaxFilesExceededError) {
      return { success: false, uploadError: "You can only upload one file" };
    }
    throw error;
  }
}
