import type { FileUpload } from "@remix-run/form-data-parser";
import {
  MaxFilesExceededError,
  MaxFileSizeExceededError,
  parseFormData,
} from "@remix-run/form-data-parser";

import { IMAGE_SIZE_ERROR, MAX_STAGED_IMAGE_BYTES } from "~/shared/image";

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

export async function parseImageFormData(
  request: Request,
  fieldName: string,
): Promise<ImageUploadResult> {
  const uploadHandler = (fileUpload: FileUpload) => {
    if (fileUpload.fieldName === fieldName) {
      return fileUpload;
    }
  };

  try {
    const formData = await parseFormData(
      request,
      { maxFileSize: MAX_STAGED_IMAGE_BYTES, maxFiles: MAX_FILES },
      uploadHandler,
    );
    return { success: true, formData };
  } catch (error) {
    if (error instanceof MaxFileSizeExceededError) {
      return { success: false, uploadError: IMAGE_SIZE_ERROR };
    }
    if (error instanceof MaxFilesExceededError) {
      return { success: false, uploadError: "You can only upload one file" };
    }
    throw error;
  }
}
