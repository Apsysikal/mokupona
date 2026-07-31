import type { SubmissionResult } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import type { FileUpload } from "@remix-run/form-data-parser";
import {
  MaxFilesExceededError,
  MaxFileSizeExceededError,
  parseFormData,
} from "@remix-run/form-data-parser";
import type { $ZodType, output } from "zod/v4/core";

import type { StoredImage } from "../types";

import {
  IMAGE_SIZE_ERROR,
  MAX_IMAGE_BYTES,
  MAX_STAGED_IMAGE_BYTES,
  VALID_IMAGE_TYPES,
} from "~/shared/image";

/**
 * PROTOTYPE 2 — upload during parsing ("parse-time upload").
 *
 * The upload handler ships the bytes to Cloudinary the moment the part is
 * available, and puts a *stand-in* `File` in the FormData that carries the
 * provider result. The payload is released as soon as Cloudinary ACKs, instead
 * of being held across Zod validation and the database write.
 *
 * Two things make this work without touching the existing schema:
 *
 * 1. `FormData` stores a `File` subclass by reference — it does not re-wrap it
 *    (verified in the accompanying test), so `instanceof` checks still pass.
 * 2. `size` is an ordinary getter on `File`, so the stand-in can report the
 *    real byte count while holding no bytes. `imageFileSchema()` therefore
 *    validates the stand-in unchanged.
 *
 * The cost is ordering: the upload handler runs *before* the rest of the form
 * is parsed (also verified in the test), so an upload can succeed for a
 * submission that later fails validation. Every non-success path below must
 * therefore destroy what it staged — this design trades an orphan-cleanup
 * obligation for earlier memory release.
 */

export type StoreFn = (file: File) => Promise<StoredImage>;
export type DestroyFn = (storageKey: string) => Promise<void>;

/**
 * The value left in `FormData` in place of the uploaded bytes: a real `File`
 * (so `z.instanceof(File)` passes) that reports the uploaded size and type but
 * holds an empty body, plus the provider result the action needs.
 */
export class StagedImageFile extends File {
  readonly stored: StoredImage;
  readonly #size: number;

  constructor(
    stored: StoredImage,
    metadata: { name: string; type: string; size: number },
  ) {
    super([], metadata.name, { type: metadata.type });
    this.stored = stored;
    this.#size = metadata.size;
  }

  override get size(): number {
    return this.#size;
  }
}

export type ParseTimeUploadResult =
  | { success: true; formData: FormData; staged: StoredImage[] }
  | { success: false; uploadError: string; staged: StoredImage[] };

/**
 * Mirror the cheap half of `imageFileSchema()` so obviously-invalid files are
 * never uploaded. The schema stays the single source of truth for the message
 * the user sees: when a pre-check fails we hand the original `FileUpload`
 * through untouched and let Zod produce the canonical error.
 */
function shouldUpload(fileUpload: FileUpload): boolean {
  if (fileUpload.size === 0 || fileUpload.size > MAX_IMAGE_BYTES) return false;
  return VALID_IMAGE_TYPES.includes(fileUpload.type);
}

export async function parseImageFormDataUploadingDuringParse(
  request: Request,
  fieldName: string,
  store: StoreFn,
): Promise<ParseTimeUploadResult> {
  const staged: StoredImage[] = [];

  const uploadHandler = async (fileUpload: FileUpload) => {
    if (fileUpload.fieldName !== fieldName) return;
    if (!shouldUpload(fileUpload)) return fileUpload;

    const stored = await store(fileUpload);
    staged.push(stored);

    return new StagedImageFile(stored, {
      name: fileUpload.name,
      type: fileUpload.type,
      size: fileUpload.size,
    });
  };

  try {
    const formData = await parseFormData(
      request,
      { maxFileSize: MAX_STAGED_IMAGE_BYTES, maxFiles: 1 },
      uploadHandler,
    );
    return { success: true, formData, staged };
  } catch (error) {
    // A later part can blow a limit after the file already uploaded, so the
    // staged list travels with the error for the caller to clean up.
    if (error instanceof MaxFileSizeExceededError) {
      return { success: false, uploadError: IMAGE_SIZE_ERROR, staged };
    }
    if (error instanceof MaxFilesExceededError) {
      return {
        success: false,
        uploadError: "You can only upload one file",
        staged,
      };
    }
    throw Object.assign(error as Error, { staged });
  }
}

type ParseTimeFormOptions<Schema extends $ZodType, Result> = {
  fieldName: string;
  schema: Schema;
  store: StoreFn;
  destroy: DestroyFn;
  onSuccess(args: {
    value: output<Schema>;
    formData: FormData;
  }): Result | Promise<Result>;
};

/**
 * The `withParsedImageForm` equivalent for this prototype. Everything that is
 * not a successful commit rolls the staged asset back.
 */
export async function withParseTimeUploadedImageForm<
  Schema extends $ZodType,
  Result,
>(
  request: Request,
  {
    fieldName,
    schema,
    store,
    destroy,
    onSuccess,
  }: ParseTimeFormOptions<Schema, Result>,
): Promise<Result | SubmissionResult> {
  const rollback = async (staged: StoredImage[]) => {
    for (const { storageKey } of staged) {
      // best effort: a failed rollback must not mask the original outcome
      await destroy(storageKey).catch(() => {});
    }
  };

  const uploadResult = await parseImageFormDataUploadingDuringParse(
    request,
    fieldName,
    store,
  );

  if (!uploadResult.success) {
    await rollback(uploadResult.staged);
    return {
      status: "error",
      error: { [fieldName]: [uploadResult.uploadError] },
    } satisfies SubmissionResult;
  }

  const { formData, staged } = uploadResult;
  const submission = parseWithZod(formData, { schema });

  if (submission.status !== "success") {
    await rollback(staged);
    return submission.reply();
  }

  try {
    return await onSuccess({ value: submission.value, formData });
  } catch (error) {
    // the row never committed, so the asset would otherwise be orphaned
    await rollback(staged);
    throw error;
  }
}
