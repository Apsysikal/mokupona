import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { SubmissionResult } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import type { FileUpload } from "@remix-run/form-data-parser";
import {
  MaxFilesExceededError,
  MaxFileSizeExceededError,
  parseFormData,
} from "@remix-run/form-data-parser";
import { z } from "zod";
import type { $ZodType, output } from "zod/v4/core";

import { createFsFolderStorage } from "~/shared/fs-file-storage.server";
import {
  IMAGE_SIZE_ERROR,
  IMAGE_TYPE_ERROR,
  MAX_IMAGE_BYTES,
  MAX_STAGED_IMAGE_BYTES,
  VALID_IMAGE_TYPES,
} from "~/shared/image";

/**
 * PROTOTYPE 3 — stage to disk, validate the staged handle, then upload.
 *
 * The upload handler writes each part into `file-storage` and the bytes leave
 * the heap immediately; validation and the Cloudinary upload both work off the
 * disk-backed handle. This keeps today's "validate before you upload" ordering
 * (so there is no orphaned-asset problem like prototype 2 has) while still
 * getting the payload out of memory before the slow part of the request.
 *
 * Two things had to change to make it work, and both are the reason this
 * prototype is worth reading:
 *
 * 1. `file-storage` returns a `LazyFile`, which is not an `instanceof File`,
 *    so `imageFileSchema()` rejects it outright.
 * 2. Worse, a `LazyFile` cannot go into `FormData` at all. It is not a `Blob`
 *    either, so `FormData.append` falls back to string coercion and
 *    `LazyFile#toString` throws. This means the pattern the form-data-parser
 *    README suggests — `return fileStorage.put(key, fileUpload)` from an
 *    upload handler — does not work on Node. `toBlob()` would satisfy FormData
 *    but reads the whole file back into memory, defeating the point.
 *
 * So the handler returns the storage *key* (a string, which FormData is happy
 * to hold) and the staged handles travel beside the FormData in a lookup. The
 * schema resolves the key back to a file and then applies the ordinary rules,
 * which keeps the Conform error shape identical to every other field.
 */

const STAGING_FOLDER = join(tmpdir(), "mokupona-upload-staging");

/** The subset of `File` this prototype needs from a staged upload. */
export interface FileLike {
  readonly name: string;
  readonly size: number;
  readonly type: string;
  stream(): ReadableStream<Uint8Array>;
}

export type StagedLookup = (storageKey: string) => FileLike | undefined;

/**
 * The staged-upload counterpart to `imageFileSchema()`: same rules, same
 * messages, but it resolves a storage key handed over by the upload handler
 * instead of validating an in-memory `File`.
 */
export function stagedImageSchema(lookup: StagedLookup) {
  return z
    .string({ error: "You must select a file" })
    .transform((storageKey, ctx): FileLike => {
      const file = storageKey ? lookup(storageKey) : undefined;

      if (!file || file.size === 0) {
        ctx.addIssue({ code: "custom", message: "You must select a file" });
        return z.NEVER;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        ctx.addIssue({ code: "custom", message: IMAGE_SIZE_ERROR });
        return z.NEVER;
      }
      if (!VALID_IMAGE_TYPES.includes(file.type)) {
        ctx.addIssue({ code: "custom", message: IMAGE_TYPE_ERROR });
        return z.NEVER;
      }

      return file;
    });
}

export interface StagedUpload {
  storageKey: string;
  file: FileLike;
}

export type DiskStagedParseResult =
  | { success: true; formData: FormData; staged: StagedUpload[] }
  | { success: false; uploadError: string; staged: StagedUpload[] };

type Storage = ReturnType<typeof createFsFolderStorage>;

export async function parseImageFormDataStagingToDisk(
  request: Request,
  fieldName: string,
  storage: Storage,
): Promise<DiskStagedParseResult> {
  const staged: StagedUpload[] = [];

  const uploadHandler = async (fileUpload: FileUpload) => {
    if (fileUpload.fieldName !== fieldName) return;

    // An unfilled file input still arrives as an empty part. Keep the field
    // present in the FormData (edit actions distinguish "omitted" from
    // "submitted blank") but do not spend a disk write on nothing.
    if (fileUpload.size === 0) return "";

    const storageKey = `staging/${randomUUID()}`;
    await storage.put(storageKey, fileUpload);
    // read back the stored handle: metadata now, bytes only when streamed
    const file = (await storage.get(storageKey)) as FileLike | null;
    if (file) staged.push({ storageKey, file });

    // a string, not the LazyFile itself — see the note at the top of the file
    return storageKey;
  };

  try {
    const formData = await parseFormData(
      request,
      { maxFileSize: MAX_STAGED_IMAGE_BYTES, maxFiles: 1 },
      uploadHandler,
    );
    return { success: true, formData, staged };
  } catch (error) {
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
    throw error;
  }
}

type DiskStagedFormOptions<Schema extends $ZodType, Result> = {
  fieldName: string;
  /** Built with `stagedImageSchema(lookup)` for the staged field. */
  buildSchema(lookup: StagedLookup): Schema;
  storage?: Storage;
  onSuccess(args: {
    value: output<Schema>;
    formData: FormData;
  }): Result | Promise<Result>;
};

/**
 * Parse → stage to disk → validate against the staged handles → commit, and
 * sweep the staging directory on every exit path.
 */
export async function withDiskStagedImageForm<Schema extends $ZodType, Result>(
  request: Request,
  {
    fieldName,
    buildSchema,
    storage,
    onSuccess,
  }: DiskStagedFormOptions<Schema, Result>,
): Promise<Result | SubmissionResult> {
  const resolvedStorage = storage ?? createFsFolderStorage(STAGING_FOLDER);

  const sweep = async (staged: StagedUpload[]) => {
    for (const { storageKey } of staged) {
      // a failed sweep leaves a temp file behind; it must never mask the
      // outcome the caller is about to return
      try {
        await resolvedStorage.remove(storageKey);
      } catch {
        // ignored
      }
    }
  };

  const parseResult = await parseImageFormDataStagingToDisk(
    request,
    fieldName,
    resolvedStorage,
  );

  if (!parseResult.success) {
    await sweep(parseResult.staged);
    return {
      status: "error",
      error: { [fieldName]: [parseResult.uploadError] },
    } satisfies SubmissionResult;
  }

  const { formData, staged } = parseResult;
  const byKey = new Map(
    staged.map(({ storageKey, file }) => [storageKey, file]),
  );

  try {
    const submission = parseWithZod(formData, {
      schema: buildSchema((storageKey) => byKey.get(storageKey)),
    });
    if (submission.status !== "success") return submission.reply();

    return await onSuccess({ value: submission.value, formData });
  } finally {
    // staging is scratch space, never the system of record: by this point the
    // bytes are either in Cloudinary or the submission failed
    await sweep(staged);
  }
}
