import { Readable, Writable } from "node:stream";

import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { StoredImage } from "../types";

import { StagedImageFile } from "./p2-parse-time-upload.server";
import {
  createByteLimiter,
  createCloudinaryStreamingStore,
  parseImageFormDataStreaming,
  withStreamedImageForm,
} from "./p5-true-streaming.server";

import { imageFileSchema } from "~/shared/image";

const mocks = vi.hoisted(() => ({ uploadStream: vi.fn() }));

vi.mock("cloudinary", () => ({
  v2: { uploader: { upload_stream: mocks.uploadStream } },
}));

const BOUNDARY = "----prototype5boundary";

const stored: StoredImage = {
  storageKey: "dinners/streamed",
  version: 3,
  width: 640,
  height: 480,
};

const encoder = new TextEncoder();

function filePartHeader(type = "image/png") {
  return encoder.encode(
    `--${BOUNDARY}\r\n` +
      `Content-Disposition: form-data; name="cover"; filename="cover.png"\r\n` +
      `Content-Type: ${type}\r\n\r\n`,
  );
}

function trailingField(title: string) {
  return encoder.encode(
    `\r\n--${BOUNDARY}\r\n` +
      `Content-Disposition: form-data; name="title"\r\n\r\n` +
      `${title}\r\n--${BOUNDARY}--\r\n`,
  );
}

/**
 * A request whose body is emitted in controllable pieces. Only `headers` and
 * `body` are read by the parser, so a stub keeps the test focused on the
 * streaming behaviour rather than on Request/ReadableStream plumbing.
 */
function streamingRequest(
  chunks: (Uint8Array | (() => Promise<Uint8Array>))[],
) {
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const next = chunks.shift();
      if (!next) {
        controller.close();
        return;
      }
      controller.enqueue(typeof next === "function" ? await next() : next);
    },
  });

  return {
    headers: new Headers({
      "content-type": `multipart/form-data; boundary=${BOUNDARY}`,
    }),
    body,
  } as unknown as Request;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

async function collect(stream: Readable) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

describe("createCloudinaryStreamingStore", () => {
  it("pipes an unbounded stream into upload_stream and maps the result", async () => {
    const writes: number[] = [];
    mocks.uploadStream.mockImplementation(
      (
        _options: unknown,
        callback: (error: undefined, result: unknown) => void,
      ) =>
        new Writable({
          write(chunk: Buffer, _encoding, done) {
            writes.push(chunk.length);
            done();
          },
          final(done) {
            callback(undefined, {
              public_id: "dinners/streamed",
              version: 3,
              width: 640,
              height: 480,
            });
            done();
          },
        }),
    );

    const source = Readable.from([
      Buffer.alloc(1024, 1),
      Buffer.alloc(1024, 2),
      Buffer.alloc(1024, 3),
    ]);

    const result = await createCloudinaryStreamingStore("test/dinners")(
      source,
      {
        filename: "cover.png",
        contentType: "image/png",
      },
    );

    expect(result).toEqual(stored);
    // arrived as separate chunks: nothing concatenated the payload first
    expect(writes).toEqual([1024, 1024, 1024]);
  });
});

describe("createByteLimiter", () => {
  it("passes bytes through under the cap", async () => {
    const limiter = createByteLimiter(1024);
    limiter.end(Buffer.alloc(512, 1));
    expect((await collect(limiter)).length).toBe(512);
  });

  it("fails the pipeline as soon as the cap is crossed", async () => {
    const limiter = createByteLimiter(1024);
    limiter.write(Buffer.alloc(1000, 1));
    limiter.write(Buffer.alloc(100, 1));
    await expect(collect(limiter)).rejects.toThrow(/exceeded 1024 bytes/);
  });
});

describe("parseImageFormDataStreaming", () => {
  it("forwards bytes to the provider while the request is still arriving", async () => {
    const firstChunkSeen = deferred<void>();
    const releaseRest = deferred<void>();

    // the body stalls after the first data chunk until the test releases it
    const request = streamingRequest([
      filePartHeader(),
      new Uint8Array(64 * 1024).fill(7),
      async () => {
        await releaseRest.promise;
        return new Uint8Array(64 * 1024).fill(8);
      },
      async () => trailingField("A dinner"),
    ]);

    const store = vi.fn(async (stream: Readable) => {
      let total = 0;
      for await (const chunk of stream) {
        if (total === 0) firstChunkSeen.resolve();
        total += (chunk as Buffer).length;
      }
      return stored;
    });

    const parsing = parseImageFormDataStreaming(request, "cover", store);

    // the provider is already receiving bytes even though the request body has
    // not finished — this is the socket-to-socket property the other
    // prototypes cannot achieve
    await expect(
      Promise.race([
        firstChunkSeen.promise.then(() => "streaming"),
        new Promise((r) => setTimeout(() => r("buffered"), 1000)),
      ]),
    ).resolves.toBe("streaming");

    releaseRest.resolve();
    const result = await parsing;

    expect(result.success).toBe(true);
    expect(result.staged).toEqual([stored]);
  });

  it("puts a stand-in in the FormData that the shared schema accepts", async () => {
    const request = streamingRequest([
      filePartHeader(),
      new Uint8Array(2048).fill(5),
      trailingField("A dinner"),
    ]);

    const result = await parseImageFormDataStreaming(
      request,
      "cover",
      async (stream) => {
        await collect(stream as Readable);
        return stored;
      },
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    const cover = result.formData.get("cover");
    expect(cover).toBeInstanceOf(StagedImageFile);
    expect((cover as StagedImageFile).stored).toEqual(stored);
    expect((cover as File).size).toBe(2048);
    expect(imageFileSchema().safeParse(cover).success).toBe(true);
    expect(result.formData.get("title")).toBe("A dinner");
  });

  it("tears the upload down mid-transfer when the cap is crossed", async () => {
    const request = streamingRequest([
      filePartHeader(),
      new Uint8Array(4 * 1024 * 1024).fill(1),
      trailingField("A dinner"),
    ]);

    const result = await parseImageFormDataStreaming(
      request,
      "cover",
      async (stream) => {
        await collect(stream as Readable);
        return stored;
      },
    );

    expect(result).toMatchObject({
      success: false,
      uploadError: "File cannot be greater than 3MB",
    });
  });

  it("rejects a disallowed MIME type without forwarding any bytes", async () => {
    const request = streamingRequest([
      filePartHeader("application/pdf"),
      new Uint8Array(1024).fill(1),
      trailingField("A dinner"),
    ]);
    const store = vi.fn();

    const result = await parseImageFormDataStreaming(request, "cover", store);

    // the media type is in the part headers, so this check costs nothing
    expect(store).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      success: false,
      uploadError: "File must be a JPEG, PNG or WebP image",
    });
  });
});

describe("withStreamedImageForm", () => {
  const schema = z.object({
    title: z.string().min(1, "Title is required"),
    cover: imageFileSchema(),
  });

  const store = async (stream: Readable) => {
    await collect(stream);
    return stored;
  };

  function request(title: string) {
    return streamingRequest([
      filePartHeader(),
      new Uint8Array(1024).fill(4),
      trailingField(title),
    ]);
  }

  it("commits without re-uploading", async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);

    const result = await withStreamedImageForm(request("A dinner"), {
      fieldName: "cover",
      schema,
      store,
      destroy,
      onSuccess: ({ value }) => (value.cover as StagedImageFile).stored,
    });

    expect(result).toEqual(stored);
    expect(destroy).not.toHaveBeenCalled();
  });

  it("destroys the streamed asset when another field fails validation", async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn();

    const result = await withStreamedImageForm(request(""), {
      fieldName: "cover",
      schema,
      store,
      destroy,
      onSuccess,
    });

    // unavoidable with true streaming: the asset exists before anything could
    // have validated the submission it belongs to
    expect(onSuccess).not.toHaveBeenCalled();
    expect(destroy).toHaveBeenCalledWith("dinners/streamed");
    expect(result).toMatchObject({ status: "error" });
  });
});
