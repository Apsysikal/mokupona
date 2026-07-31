import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

import type { UploadApiOptions, UploadApiResponse } from "cloudinary";
import { v2 as cloudinary } from "cloudinary";

/**
 * PROTOTYPE 1 — stream handoff.
 *
 * Keeps today's ordering (parse → validate → upload) and changes only *how*
 * the bytes reach Cloudinary: the `File` is piped into `upload_stream` instead
 * of being flattened into a `Buffer` first.
 *
 * Today's provider does:
 *
 *     const buffer = Buffer.from(await file.arrayBuffer());
 *     stream.end(buffer);
 *
 * which materialises the payload twice more on top of the copy the multipart
 * parser is already holding (`arrayBuffer()` concatenates the part's chunk
 * list, `Buffer.from` copies that result). Piping the file's stream hands the
 * existing chunks to the socket as they are read, so peak heap for the upload
 * step drops from ~3x the file size to ~1x plus a chunk.
 *
 * This does NOT make the upload "streaming" end to end — see the prototypes
 * README: `form-data-parser` has already buffered the whole part before the
 * upload handler runs. It is the cheap, behaviour-preserving slice of that
 * problem.
 */
export function uploadFileStream(
  file: File,
  options: UploadApiOptions,
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const target = cloudinary.uploader.upload_stream(
      options,
      (error, result) =>
        result ? resolve(result) : reject(error ?? new Error("Upload failed")),
    );

    // Readable.fromWeb wants the node:stream/web flavour of ReadableStream;
    // at runtime File#stream() already returns exactly that object.
    const source = Readable.fromWeb(
      file.stream() as unknown as NodeReadableStream<Uint8Array>,
    );

    source.on("error", reject);
    source.pipe(target).on("error", reject);
  });
}
