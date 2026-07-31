import { Readable, Transform } from "node:stream";

import type { SubmissionResult } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import busboy from "busboy";
import { v2 as cloudinary } from "cloudinary";
import type { $ZodType, output } from "zod/v4/core";

import type { StoredImage } from "../types";

import { StagedImageFile } from "./p2-parse-time-upload.server";

import {
  IMAGE_SIZE_ERROR,
  IMAGE_TYPE_ERROR,
  MAX_IMAGE_BYTES,
  VALID_IMAGE_TYPES,
} from "~/shared/image";

/**
 * PROTOTYPE 5 — true socket-to-Cloudinary streaming.
 *
 * The other prototypes work within `form-data-parser`, which buffers each part
 * in full before handing it over. This one answers the obvious follow-up: if
 * Cloudinary's sink really does stream, can we forward bytes straight from the
 * request socket without ever holding the file?
 *
 * Yes — but not with `form-data-parser`. Cloudinary is not the constraint:
 * `upload_stream` returns a `Transform` that passes chunks through untouched
 * into an `https.request`, and the SDK sets no `Content-Length`, so the upload
 * goes out chunked and the payload size need not be known up front. The
 * blocker is purely the multipart parser, so this prototype swaps it for
 * `busboy`, which emits each file as a `Readable` while the request is still
 * arriving.
 *
 * The tension this exposes is the real lesson, and it is not a busboy quirk —
 * it is inherent to streaming: **you cannot enforce a size limit before you
 * start uploading, because you do not know the size until the stream ends.**
 * The best available is enforcement *during* the transfer: count bytes as they
 * pass and tear the upload down the moment the cap is crossed. Anything the
 * schema cannot judge from the headers alone is likewise a post-hoc check, so
 * every failure path here compensates by destroying whatever reached
 * Cloudinary.
 *
 * That is the trade: constant memory regardless of file size, paid for with an
 * orphan-cleanup obligation and a partial asset that briefly exists.
 */

/** Opens a streaming upload; resolves once the provider has the whole object. */
export type StreamingStoreFn = (
  stream: Readable,
  metadata: { filename: string; contentType: string },
) => Promise<StoredImage>;

export type DestroyFn = (storageKey: string) => Promise<void>;

/**
 * The Cloudinary end of the pipe, showing that the provider genuinely accepts
 * an unbounded stream: `upload_stream` returns a `Transform` that forwards
 * chunks into an `https.request` untouched, and the SDK sets no
 * `Content-Length`, so the request goes out chunked and the size need not be
 * known in advance.
 */
export function createCloudinaryStreamingStore(
  assetFolder: string,
): StreamingStoreFn {
  return (stream) =>
    new Promise((resolve, reject) => {
      const target = cloudinary.uploader.upload_stream(
        { resource_type: "image", asset_folder: assetFolder },
        (error, result) =>
          result
            ? resolve({
                storageKey: result.public_id,
                version: result.version,
                width: result.width,
                height: result.height,
              })
            : reject(error ?? new Error("Upload failed")),
      );

      stream.on("error", (error) => {
        // abort the in-flight request so a truncated asset is not committed
        target.destroy();
        reject(error);
      });

      stream.pipe(target);
    });
}

export class MaxStreamedSizeExceededError extends Error {
  constructor(limit: number) {
    super(`File exceeded ${limit} bytes mid-stream`);
    this.name = "MaxStreamedSizeExceededError";
  }
}

/**
 * Counts bytes as they pass and fails the pipeline the moment the cap is
 * crossed, so an oversize upload is cut off mid-transfer instead of being
 * discovered after the fact.
 */
export function createByteLimiter(limit: number): Transform {
  let total = 0;

  return new Transform({
    transform(chunk: Buffer, _encoding, next) {
      total += chunk.length;
      if (total > limit) {
        next(new MaxStreamedSizeExceededError(limit));
        return;
      }
      next(null, chunk);
    },
  });
}

export type StreamingParseResult =
  | { success: true; formData: FormData; staged: StoredImage[] }
  | { success: false; uploadError: string; staged: StoredImage[] };

/**
 * Parse the request with busboy, forwarding the target file field straight to
 * the provider while the remaining fields are collected into a `FormData` that
 * Conform and Zod can validate exactly as they do today.
 */
export function parseImageFormDataStreaming(
  request: Request,
  fieldName: string,
  store: StreamingStoreFn,
): Promise<StreamingParseResult> {
  const contentType = request.headers.get("content-type") ?? "";
  const body = request.body;

  if (!body) {
    return Promise.resolve({
      success: false,
      uploadError: "You must select a file",
      staged: [],
    });
  }

  return new Promise((resolve, reject) => {
    const parser = busboy({ headers: { "content-type": contentType } });
    const formData = new FormData();
    const staged: StoredImage[] = [];
    const uploads: Promise<void>[] = [];

    let uploadError: string | undefined;
    let settled = false;

    const fail = (message: string) => {
      uploadError ??= message;
    };

    parser.on("field", (name, value) => {
      formData.append(name, value);
    });

    parser.on("file", (name, stream, info) => {
      if (name !== fieldName) {
        stream.resume(); // drain: an unconsumed part stalls the parser
        return;
      }

      // The MIME type is in the part headers, so this one check *can* happen
      // before any bytes are forwarded. Size cannot — hence the limiter.
      if (!VALID_IMAGE_TYPES.includes(info.mimeType)) {
        fail(IMAGE_TYPE_ERROR);
        stream.resume();
        return;
      }

      const limiter = createByteLimiter(MAX_IMAGE_BYTES);

      // Tearing down the limiter is not enough: busboy is still writing this
      // part into it, and an undrained part stalls the parser so `close` never
      // fires. Detach and drain the remainder so parsing can reach the end of
      // the request and report the error.
      limiter.on("error", () => {
        stream.unpipe(limiter);
        stream.resume();
      });

      const limited = stream.pipe(limiter);
      let bytes = 0;
      stream.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
      });

      uploads.push(
        store(limited, {
          filename: info.filename,
          contentType: info.mimeType,
        })
          .then((result) => {
            staged.push(result);
            formData.append(
              name,
              new StagedImageFile(result, {
                name: info.filename,
                type: info.mimeType,
                size: bytes,
              }),
            );
          })
          .catch((error: unknown) => {
            // a torn-down upload may still have created a partial asset, so
            // the caller must sweep whatever landed in `staged`
            fail(
              error instanceof MaxStreamedSizeExceededError
                ? IMAGE_SIZE_ERROR
                : "Upload failed",
            );
          }),
      );
    });

    parser.on("error", (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(error);
    });

    parser.on("close", () => {
      void Promise.all(uploads).then(() => {
        if (settled) return;
        settled = true;
        resolve(
          uploadError
            ? { success: false, uploadError, staged }
            : { success: true, formData, staged },
        );
      });
    });

    Readable.fromWeb(body as never).pipe(parser);
  });
}

type StreamingFormOptions<Schema extends $ZodType, Result> = {
  fieldName: string;
  schema: Schema;
  store: StreamingStoreFn;
  destroy: DestroyFn;
  onSuccess(args: {
    value: output<Schema>;
    formData: FormData;
  }): Result | Promise<Result>;
};

/**
 * Same contract as `withParsedImageForm`, so routes and the no-JS form are
 * unaffected — only the memory profile and the cleanup obligation differ.
 */
export async function withStreamedImageForm<Schema extends $ZodType, Result>(
  request: Request,
  {
    fieldName,
    schema,
    store,
    destroy,
    onSuccess,
  }: StreamingFormOptions<Schema, Result>,
): Promise<Result | SubmissionResult> {
  const rollback = async (staged: StoredImage[]) => {
    for (const { storageKey } of staged) {
      try {
        await destroy(storageKey);
      } catch {
        // best effort: never mask the outcome being returned
      }
    }
  };

  const parseResult = await parseImageFormDataStreaming(
    request,
    fieldName,
    store,
  );

  if (!parseResult.success) {
    await rollback(parseResult.staged);
    return {
      status: "error",
      error: { [fieldName]: [parseResult.uploadError] },
    } satisfies SubmissionResult;
  }

  const { formData, staged } = parseResult;
  const submission = parseWithZod(formData, { schema });

  if (submission.status !== "success") {
    await rollback(staged);
    return submission.reply();
  }

  try {
    return await onSuccess({ value: submission.value, formData });
  } catch (error) {
    await rollback(staged);
    throw error;
  }
}
