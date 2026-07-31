# Streaming uploads to Cloudinary — prototype exploration

**Date:** 2026-07-31
**Status:** Exploration. Nothing here is wired into a route; the running app is
unchanged apart from exporting one constant.
**Scope:** Can we stream image uploads to Cloudinary while keeping the
Conform/Zod progressive-enhancement story and the server-side limits?

Prototype code lives in [`app/features/images/prototypes/`](../../app/features/images/prototypes/),
one module per option, each with tests that pin the claims made below.

## The finding that shapes everything else

**`@remix-run/form-data-parser@0.17.4` cannot hand your upload handler a
stream.** The `FileUpload` it passes you is always a fully-materialised `File`.

This is not a documentation nuance, it is the data model. `FileUpload extends
File` and is constructed as `super(part.content as BlobPart[], ...)`, where
`MultipartPart.content` is a `Uint8Array[]` that the parser fills by appending
chunk after chunk. The part is only handed over at a boundary, once complete:

```ts
// @remix-run/multipart-parser — MultipartParser#write
this.#currentContent!.push(chunk); // accumulate…
// …then, only at the boundary:
yield this.#createPart(); // → new MultipartPart(header, content)
```

Verified directly against the installed packages: in an upload handler,
`fileUpload.size` is known synchronously and draining `fileUpload.stream()`
completes in ~0.6 ms as a single chunk — it is reading RAM, not the socket.

So "streaming to Cloudinary" in the byte-forwarding sense (request socket →
Cloudinary socket, never fully resident) **is not reachable through this
library's public API**. Anything that routes bytes through this app has a peak
memory floor of `maxFileSize` per concurrent upload.

What the library genuinely does give you, both of which the app already relies
on:

1. **Limits enforced mid-parse, before your code runs.** `maxFileSize` is
   checked per chunk during accumulation, so an oversize upload throws
   `MaxFileSizeExceededError` having buffered at most the cap — and the upload
   handler is never invoked. Confirmed by test: `handlerWasCalled: false`.
2. **Files need not be retained in the returned `FormData`.** The handler can
   return a string or a different object, so the payload does not have to stay
   resident through validation and the database write.

Prototypes 1–3 exploit #2 in different ways. Prototype 4 sidesteps the floor
entirely.

### "But isn't `file-storage-s3` a streaming backend?"

It reads like one, and it is the obvious place to look for a counter-example.
It isn't one. `@remix-run/file-storage-s3@0.1.4` — and the identical code on
`main` — writes like this:

```ts
// packages/file-storage-s3/src/lib/s3.ts
async function putFile(key: string, file: FileLike): Promise<File> {
  let body = await file.arrayBuffer(); // ← whole file, in memory
  let response = await s3Fetch(getObjectUrl(key), {
    method: "PUT",
    headers,
    body, // ← one buffered PUT
  });
  await assertOk(response, `PUT "${key}"`);
  return new File([body], file.name, {/* … */}); // ← and a second copy kept
}
```

No `.stream()`, no S3 multipart upload (`CreateMultipartUpload`/`UploadPart`
appear nowhere), no `duplex: 'half'`. Reads buffer too — `get` does
`await response.arrayBuffer()`. It is in fact the _most_ buffering-heavy
backend in the family, which is unsurprising: since `FileUpload` is already
fully resident, a backend gains nothing by streaming from it.

Where streaming genuinely does exist in this family:

- **The `fs` backend streams on write.** `writeFile` opens a
  `createWriteStream` and pumps `file.stream()` chunk by chunk with
  backpressure. This is real, and it is why prototype 3 avoids an extra
  full-size copy when staging to disk (and why staging via the S3 backend
  instead would re-buffer).
- **`LazyFile` streams on read.** Bytes are pulled from disk on demand, which
  is what lets prototype 3 validate `size`/`type` without rehydrating.

So the streaming in this ecosystem is real but sits on the _storage_ side, not
between the request socket and the upload handler. On `main` today the only
`ReadableStream` in `multipart-parser` is the parser's own input; no per-part
stream is exposed, and the exports are unchanged from the installed version.

## Where the current code stands

`parseImageFormData` → `withParsedImageForm` → `storeImage`, i.e. parse fully,
validate with Zod, then upload. Correct and orphan-free, but the payload is
copied more than it needs to be:

```ts
// app/features/images/providers/cloudinary.server.ts
const buffer = Buffer.from(await file.arrayBuffer());
stream.end(buffer);
```

The parser already holds the chunk list; `arrayBuffer()` concatenates it into a
second copy and `Buffer.from` makes a third. All three are live at once, and
the file stays resident across the whole Cloudinary round trip plus the DB
write.

## The four prototypes

### P1 — Stream handoff (`p1-stream-handoff.server.ts`)

Keep the ordering exactly as it is; pipe the `File` into `upload_stream`
instead of buffering it:

```ts
Readable.fromWeb(file.stream()).pipe(cloudinary.uploader.upload_stream(...))
```

Peak heap for the upload step drops from ~3x file size to ~1x plus a chunk.
Nothing else moves: same schema, same Conform result, same error messages, no
orphan risk. A test asserts `file.arrayBuffer()` is never called.

### P2 — Upload during parsing (`p2-parse-time-upload.server.ts`)

The upload handler ships the bytes to Cloudinary the moment the part lands and
puts a stand-in in the `FormData`, so the payload is released at ACK rather
than being held through validation and the DB write.

Two runtime facts make this work without touching `imageFileSchema()`:

- `FormData` stores a `File` **subclass by reference** — it does not re-wrap it,
  so `instanceof` checks pass and the provider result rides along.
- `size` is an ordinary getter, so the stand-in reports the real byte count
  while holding an empty body.

The cost is ordering. The handler runs **before the rest of the form is
parsed** (pinned by test: `["upload", "parse-complete"]`), so an asset can exist
for a submission that later fails validation. Every non-success path has to
compensate with `destroy()`: schema failure, a later part blowing a limit, and a
throwing action are all covered in the wrapper and its tests. Cheap pre-checks
(size, MIME) skip the upload for files the schema would reject anyway, while
leaving Zod as the single source of the user-facing message.

### P3 — Stage to disk, then upload (`p3-disk-staged.server.ts`)

Write each part into `file-storage` so the bytes leave the heap immediately;
validate against the disk-backed handle; upload from disk only once the whole
submission is valid. Keeps the safe ordering _and_ frees the heap during the
slow part of the request.

**This is where the README's advice breaks.** The documented pattern —

```ts
// form-data-parser README
return fileStorage.put(storageKey, fileUpload);
```

— throws on Node. `LazyFile` is neither `instanceof File` nor `instanceof
Blob`, so `FormData.append` falls back to string coercion and
`LazyFile#toString` raises _"Cannot convert LazyFile to string"_. Reproduced
against native undici `FormData`, not just the test environment's. `toBlob()`
satisfies `FormData` but reads the file back into memory, defeating the point.

The prototype therefore returns the storage **key** (a string, which `FormData`
holds happily) and carries the staged handles beside the form data in a lookup.
`stagedImageSchema(lookup)` resolves the key and applies the same three rules
with the same messages, so Conform's error shape is unchanged. Staging is swept
on every exit path.

### P4 — Signed direct-to-Cloudinary (`p4-signed-direct.server.ts`)

The only option that removes the payload from this app entirely. The server
mints a short-lived signature; the browser POSTs the file straight to
Cloudinary; the ordinary form submit carries only the resulting identifiers.

Progressive enhancement is the design constraint, and it survives: without JS
the file input posts multipart exactly as today and the server-side path (P1)
runs. With JS the script uploads first and writes a hidden descriptor field.
`directOrUploadedImageSchema()` accepts **either** shape under one field name,
so one form and one action serve both.

Trust is the part to get right, since a hidden field is client-controlled. A
descriptor is believed only if Cloudinary's own response signature verifies
against our API secret (`api_sign_request({ public_id, version })` — only a
holder of the secret can produce it) **and** the asset sits under this app's
folder prefix **and** it still passes the server's own size/format policy. The
tests sign with the real helper and cover forged signatures, a swapped
`public_id`, a foreign folder, oversize, and disallowed formats.

Not implemented here: the client-side script, the loader wiring that hands the
form its ticket, and a Cloudinary upload preset capping `max_file_size` at the
edge.

## Comparison

|        | Peak heap / upload  | Bytes held during Cloudinary round trip | Orphan risk                         | Schema change   | PE                    |
| ------ | ------------------- | --------------------------------------- | ----------------------------------- | --------------- | --------------------- |
| Today  | ~3x file            | yes                                     | none                                | —               | ✅                    |
| **P1** | ~1x file            | yes                                     | none                                | none            | ✅                    |
| **P2** | ~1x file            | no (released at ACK)                    | **yes** — needs compensating delete | none            | ✅                    |
| **P3** | ~1x file, then disk | no (on disk)                            | none                                | key indirection | ✅                    |
| **P4** | **zero**            | n/a                                     | none¹                               | union branch    | ✅ (falls back to P1) |

¹ An abandoned direct upload leaves an unreferenced Cloudinary asset; a
scheduled sweep of the folder handles it.

All four keep `maxFileSize`/`maxFiles` enforced by the parser, and all four
report failures as a Conform `SubmissionResult`, so the no-JS path renders
field errors exactly as it does now.

## Recommendation

1. **Take P1 now.** It is a handful of lines inside the existing provider, has
   no behavioural change to reason about, and removes two full-size copies.
2. **Reach for P4 if upload memory is actually a problem.** It is the only
   option that changes the asymptotics, and the PE fallback means the no-JS
   path keeps working. Given production runs on a 256 MB box, this is the one
   with real headroom upside.
3. **P3 only if** the heap must be free _during_ the upload but a direct upload
   is unacceptable. The key indirection is a real ergonomic cost.
4. **P2 is not recommended.** It buys little over P3 and takes on a
   distributed-transaction problem — an asset that exists before the submission
   is known valid — in exchange.

Worth stating plainly: for a 3 MB cap and one image per submission, the
difference between P1 and P3 is small. If the goal is bounded memory under
concurrency, P4 is the answer and the rest is tuning.

## Reproducing

```sh
npx vitest run app/features/images/prototypes/   # 33 tests
npm run typecheck
```
