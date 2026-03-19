import type { FileUpload } from "@remix-run/form-data-parser";
import {
  FormDataParseError,
  MaxFilesExceededError,
  MaxFileSizeExceededError,
  parseFormData,
} from "@remix-run/form-data-parser";

import { fileStorage, getStorageKey } from "./dinner-image-storage.server";

import { prisma } from "~/db.server";

const MAX_FILE_SIZE = 1024 * 1024 * 4; // 4 MB upload ceiling (schema validates ≤ 3 MB)
const MAX_FILES = 1;

const TEMP_IMAGE_ID = "temporary-key";

export type EventFormDataResult =
  | { success: true; formData: FormData }
  | { success: false; uploadError: string };

/**
 * Parse a multipart/form-data request that may contain a cover image upload.
 *
 * Handles file-size and file-count errors internally and returns a typed
 * result instead of throwing, so callers never need to deal with
 * `MaxFileSizeExceededError` or `MaxFilesExceededError` directly.
 */
export async function parseEventFormData(
  request: Request,
): Promise<EventFormDataResult> {
  const uploadHandler = async (fileUpload: FileUpload) => {
    if (fileUpload.fieldName === "cover") {
      const storageKey = getStorageKey(TEMP_IMAGE_ID);
      await fileStorage.set(storageKey, fileUpload);
      return fileUpload;
    }
  };

  try {
    const formData = await parseFormData(
      request,
      { maxFileSize: MAX_FILE_SIZE, maxFiles: MAX_FILES },
      uploadHandler,
    );
    return { success: true, formData };
  } catch (error) {
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

/**
 * Persist an uploaded cover image to the database and clean up the temp file.
 *
 * Returns the new image ID, ready to be linked to an Event record.
 */
export async function persistEventCoverImage(cover: File): Promise<string> {
  const image = await prisma.image.create({
    data: {
      contentType: cover.type,
      blob: Buffer.from(await cover.arrayBuffer()),
    },
  });
  await fileStorage.remove(getStorageKey(TEMP_IMAGE_ID));
  return image.id;
}

/**
 * Remove the temporary cover image from disk without persisting it.
 *
 * Call this when form validation fails after a file was already uploaded,
 * so that stale temp files are not left behind.
 */
export async function discardTempEventImage(): Promise<void> {
  await fileStorage.remove(getStorageKey(TEMP_IMAGE_ID));
}
