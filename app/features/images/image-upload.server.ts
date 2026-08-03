import type { FileUpload } from "@remix-run/form-data-parser";
import {
  MaxFilesExceededError,
  MaxFileSizeExceededError,
  parseFormData,
} from "@remix-run/form-data-parser";

import { IMAGE_SIZE_ERROR, MAX_STAGED_IMAGE_BYTES } from "~/shared/image";

// The parse ceiling is deliberately higher than the schema's user-facing
// limit so near-boundary files reach the canonical Zod validation. Files
// above it are rejected mid-parse with the same policy-owned error message.
const MAX_FILES = 1;

export type ImageUploadSuccess = {
  success: true;
  formData: FormData;
};

export type ImageUploadError = {
  success: false;
  uploadError: string;
};

export type ImageUploadResult = ImageUploadSuccess | ImageUploadError;

/**
 * Parse a multipart/form-data request that may contain a single image upload.
 *
 * - Handles file-size and file-count errors internally, returning a typed
 *   result instead of throwing.
 * - The upload stays an in-memory `FileUpload` on the returned FormData;
 *   persisting it is the caller's job (the image provider stores the file,
 *   the owning model persists the returned scalars), never this module's.
 *
 * @param fieldName The multipart field name that carries the file (e.g. "cover", "image").
 * @param maxFiles How many files the field may carry. Defaults to 1 (the
 *   cover/portrait forms); the gallery admin pages raise it and read the
 *   uploads back with `formData.getAll(fieldName)`.
 */
export async function parseImageFormData(
  request: Request,
  fieldName: string,
  maxFiles: number = MAX_FILES,
): Promise<ImageUploadResult> {
  const uploadHandler = (fileUpload: FileUpload) => {
    if (fileUpload.fieldName === fieldName) {
      return fileUpload;
    }
  };

  try {
    const formData = await parseFormData(
      request,
      { maxFileSize: MAX_STAGED_IMAGE_BYTES, maxFiles },
      uploadHandler,
    );
    return { success: true, formData };
  } catch (error) {
    if (error instanceof MaxFileSizeExceededError) {
      return { success: false, uploadError: IMAGE_SIZE_ERROR };
    }
    if (error instanceof MaxFilesExceededError) {
      return {
        success: false,
        uploadError:
          maxFiles === 1
            ? "You can only upload one file"
            : `You can only upload ${maxFiles} files at a time`,
      };
    }
    throw error;
  }
}
