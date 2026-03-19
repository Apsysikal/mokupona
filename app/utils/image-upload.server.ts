import { randomUUID } from "node:crypto";

import type { FileUpload } from "@remix-run/form-data-parser";
import {
  FormDataParseError,
  MaxFilesExceededError,
  MaxFileSizeExceededError,
  parseFormData,
} from "@remix-run/form-data-parser";

import { fileStorage, getStorageKey } from "./dinner-image-storage.server";

import { prisma } from "~/db.server";

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
   * Persist the uploaded image as a standalone Image record and clean up the
   * temp file. Returns the new image ID.
   */
  persistImage(file: File): Promise<string>;
  /**
   * Remove the temp file from disk without persisting it.
   * Safe to call when no file was uploaded (no-op in that case).
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
 * - Returns bound `persistImage` and `discardImage` helpers pre-wired to the
 *   request's unique temp file, so callers never manage storage keys directly.
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

  async function persistImage(file: File): Promise<string> {
    const image = await prisma.image.create({
      data: {
        contentType: file.type,
        blob: Buffer.from(await file.arrayBuffer()),
      },
    });
    await discardImage();
    return image.id;
  }

  try {
    const formData = await parseFormData(
      request,
      { maxFileSize: MAX_FILE_SIZE, maxFiles: MAX_FILES },
      uploadHandler,
    );
    return { success: true, formData, persistImage, discardImage };
  } catch (error) {
    // Clean up any partial write before returning an error result.
    await discardImage();
    if (
      error instanceof MaxFileSizeExceededError ||
      (error instanceof FormDataParseError &&
        "cause" in error &&
        error.cause instanceof MaxFileSizeExceededError)
    ) {
      return { success: false, uploadError: "File cannot be greater than 3MB" };
    }
    if (
      error instanceof MaxFilesExceededError ||
      (error instanceof FormDataParseError &&
        "cause" in error &&
        error.cause instanceof MaxFilesExceededError)
    ) {
      return { success: false, uploadError: "You can only upload one file" };
    }
    throw error;
  }
}
