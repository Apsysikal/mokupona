import { Readable } from "node:stream";

import type { FileUpload } from "@remix-run/form-data-parser";
import { parseFormData } from "@remix-run/form-data-parser";
import busboy from "busboy";
import { describe, expect, it } from "vitest";

/**
 * The question this file answers: `form-data-parser` reads the request body
 * incrementally rather than buffering it like `request.formData()` does — so if
 * we link its stream through to Cloudinary's stream, is the whole thing
 * streamable without the payload ever being resident?
 *
 * No. Both halves of that sentence are true and they do not connect:
 *
 * - `form-data-parser` genuinely streams the request body *in*. It pulls
 *   chunks off `request.body` as they arrive.
 * - But it **accumulates** those chunks into the part's `content` array and only
 *   yields the part once the closing boundary is seen. The upload handler is
 *   not called until the file is complete and resident.
 *
 * So the stream you get from `fileUpload.stream()` sits *downstream* of the
 * buffer, not upstream of it. Piping it into Cloudinary does move bytes in
 * chunks — which is why prototype 1 is still worth doing, it avoids two extra
 * full-size copies — but the file was already in memory before you got the
 * chance. There is no earlier point to link the two streams together, because
 * your code does not run any earlier.
 *
 * The test below runs the identical scenario through both parsers: a request
 * whose body stalls partway through the file part. The difference is the whole
 * answer.
 */

const BOUNDARY = "----comparisonboundary";
const FIRST_HALF = 64 * 1024;
const SECOND_HALF = 64 * 1024;

const encoder = new TextEncoder();

/**
 * A multipart body that emits the first half of the file, then blocks until the
 * returned `release` is called, then emits the rest and the closing boundary.
 */
function stallingBody() {
  let release!: () => void;
  const stalled = new Promise<void>((resolve) => {
    release = resolve;
  });

  const pieces: (Uint8Array | (() => Promise<Uint8Array>))[] = [
    encoder.encode(
      `--${BOUNDARY}\r\n` +
        `Content-Disposition: form-data; name="cover"; filename="cover.png"\r\n` +
        `Content-Type: image/png\r\n\r\n`,
    ),
    new Uint8Array(FIRST_HALF).fill(7),
    async () => {
      await stalled;
      return new Uint8Array(SECOND_HALF).fill(8);
    },
    async () => encoder.encode(`\r\n--${BOUNDARY}--\r\n`),
  ];

  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const next = pieces.shift();
      if (!next) {
        controller.close();
        return;
      }
      controller.enqueue(typeof next === "function" ? await next() : next);
    },
  });

  const request = {
    headers: new Headers({
      "content-type": `multipart/form-data; boundary=${BOUNDARY}`,
    }),
    body,
  } as unknown as Request;

  return { request, release };
}

/** Resolves to "yes" if `signal` settles first, "no" after a generous wait. */
function settledFirst(signal: Promise<unknown>) {
  return Promise.race([
    signal.then(() => "yes"),
    new Promise((resolve) => setTimeout(() => resolve("no"), 750)),
  ]);
}

describe("does the upload handler see bytes before the request finishes?", () => {
  it("form-data-parser: no — the handler is not called until the part is complete", async () => {
    const { request, release } = stallingBody();

    let handlerCalled = false;
    let sizeWhenCalled = -1;
    let resolveCalled!: () => void;
    const called = new Promise<void>((resolve) => {
      resolveCalled = resolve;
    });

    const parsing = parseFormData(
      request,
      { maxFileSize: 1024 * 1024, maxFiles: 1 },
      (fileUpload: FileUpload) => {
        handlerCalled = true;
        sizeWhenCalled = fileUpload.size;
        resolveCalled();
        return fileUpload;
      },
    );

    // the body is stalled halfway through the file and stays that way
    expect(await settledFirst(called)).toBe("no");
    expect(handlerCalled).toBe(false);

    release();
    await parsing;

    // when it finally runs, every byte is already resident — `size` is known
    // synchronously, which is only possible for a fully buffered part
    expect(handlerCalled).toBe(true);
    expect(sizeWhenCalled).toBe(FIRST_HALF + SECOND_HALF);
  });

  it("busboy: yes — bytes arrive while the request is still in flight", async () => {
    const { request, release } = stallingBody();

    let bytesBeforeRelease = 0;
    let resolveFirstChunk!: () => void;
    const firstChunk = new Promise<void>((resolve) => {
      resolveFirstChunk = resolve;
    });

    const parser = busboy({
      headers: { "content-type": request.headers.get("content-type")! },
    });

    const done = new Promise<void>((resolve, reject) => {
      parser.on("file", (_name, stream) => {
        stream.on("data", (chunk: Buffer) => {
          bytesBeforeRelease += chunk.length;
          resolveFirstChunk();
        });
        stream.on("end", () => resolve());
      });
      parser.on("error", reject);
    });

    Readable.fromWeb(request.body as never).pipe(parser);

    // bytes are already flowing to us with the request body still open
    expect(await settledFirst(firstChunk)).toBe("yes");
    expect(bytesBeforeRelease).toBe(FIRST_HALF);

    release();
    await done;
  });
});

describe("what fileUpload.stream() actually is", () => {
  it("is a stream over memory, not over the socket", async () => {
    const formData = new FormData();
    formData.set(
      "cover",
      new File([new Uint8Array(256 * 1024).fill(3)], "cover.png", {
        type: "image/png",
      }),
    );

    let drainMs = -1;
    let chunkCount = -1;

    await parseFormData(
      new Request("http://localhost/x", { method: "POST", body: formData }),
      { maxFileSize: 1024 * 1024, maxFiles: 1 },
      async (fileUpload: FileUpload) => {
        const started = performance.now();
        const chunks: Uint8Array[] = [];
        for await (const chunk of fileUpload.stream() as unknown as AsyncIterable<Uint8Array>) {
          chunks.push(chunk);
        }
        drainMs = performance.now() - started;
        chunkCount = chunks.length;
        return fileUpload;
      },
    );

    // 256 KB drained effectively instantly, in a single chunk: this is a read
    // of an already-materialised buffer. Piping it to Cloudinary avoids the
    // extra arrayBuffer()/Buffer.from() copies (prototype 1), but it cannot
    // un-buffer what the parser already holds.
    expect(chunkCount).toBe(1);
    expect(drainMs).toBeLessThan(50);
  });
});
