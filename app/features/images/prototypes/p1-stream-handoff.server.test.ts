import { Writable } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import { uploadFileStream } from "./p1-stream-handoff.server";

const mocks = vi.hoisted(() => ({ uploadStream: vi.fn() }));

vi.mock("cloudinary", () => ({
  v2: { uploader: { upload_stream: mocks.uploadStream } },
}));

/**
 * Stand in for Cloudinary's writable upload target, recording each write so a
 * test can tell a streamed handoff from a single buffered `end(buffer)`.
 */
function mockUploadTarget(result: unknown = { public_id: "abc", version: 1 }) {
  const writes: number[] = [];

  mocks.uploadStream.mockImplementation(
    (
      _options: unknown,
      callback: (error: undefined, value: unknown) => void,
    ) => {
      return new Writable({
        write(chunk: Buffer, _encoding, done) {
          writes.push(chunk.length);
          done();
        },
        final(done) {
          callback(undefined, result);
          done();
        },
      });
    },
  );

  return writes;
}

describe("uploadFileStream", () => {
  it("resolves with the Cloudinary result and forwards every byte", async () => {
    const writes = mockUploadTarget();
    const bytes = new Uint8Array(64 * 1024).fill(9);
    const file = new File([bytes], "cover.png", { type: "image/png" });

    const result = await uploadFileStream(file, { resource_type: "image" });

    expect(result).toEqual({ public_id: "abc", version: 1 });
    expect(writes.reduce((total, size) => total + size, 0)).toBe(bytes.length);
  });

  it("never materialises the file as one buffer", async () => {
    mockUploadTarget();
    const file = new File([new Uint8Array(1024)], "cover.png", {
      type: "image/png",
    });
    const arrayBuffer = vi.spyOn(file, "arrayBuffer");

    await uploadFileStream(file, { resource_type: "image" });

    // the whole point of the prototype: the bytes reach the socket from the
    // file's stream, not via an arrayBuffer()/Buffer.from() round trip
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it("rejects when Cloudinary reports an error", async () => {
    mocks.uploadStream.mockImplementation(
      (_options: unknown, callback: (error: Error) => void) =>
        new Writable({
          write(_chunk, _encoding, done) {
            done();
          },
          final(done) {
            callback(new Error("cloudinary exploded"));
            done();
          },
        }),
    );

    const file = new File([new Uint8Array(32)], "cover.png", {
      type: "image/png",
    });

    await expect(
      uploadFileStream(file, { resource_type: "image" }),
    ).rejects.toThrow("cloudinary exploded");
  });
});
