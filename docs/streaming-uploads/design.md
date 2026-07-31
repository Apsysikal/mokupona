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

`parser-streaming-comparison.test.ts` pins this against busboy: given a request
body that stalls halfway through the file part, busboy delivers the first half
immediately while `form-data-parser` does not invoke the handler at all until
the body completes — and when it does, `size` is already the full payload.

To be precise about what _is_ streamed: `form-data-parser` reads `request.body`
incrementally, unlike `request.formData()`. But it accumulates those chunks into
the part's `content` array and only yields the part at the closing boundary, so
the stream you get from `fileUpload.stream()` sits **downstream of the buffer**.
There is no earlier point at which to link it to Cloudinary's stream, because
the handler does not run any earlier.

So "streaming to Cloudinary" in the byte-forwarding sense (request socket →
Cloudinary socket, never fully resident) **is not reachable through this
library's public API**, and every design built on `form-data-parser` has a peak
memory floor of `maxFileSize` per concurrent upload.

That is a statement about `form-data-parser`, not about the goal. Cloudinary is
not the constraint — see prototype 5, which reaches true socket-to-socket
streaming by swapping the parser.

What the library genuinely does give you, both of which the app already relies
on:

1. **Limits enforced mid-parse, before your code runs.** `maxFileSize` is
   checked per chunk during accumulation, so an oversize upload throws
   `MaxFileSizeExceededError` having buffered at most the cap — and the upload
   handler is never invoked. Confirmed by test: `handlerWasCalled: false`.
2. **Files need not be retained in the returned `FormData`.** The handler can
   return a string or a different object, so the payload does not have to stay
   resident through validation and the database write.

Prototypes 1–3 exploit #2 in different ways. Prototype 4 sidesteps the floor by
keeping the bytes off this server; prototype 5 removes the floor by replacing
the parser.

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

### Why the README still says "streaming"

Because it used to be literally true, and the docs were never updated.

`FileUpload` was stream-backed until `form-data-parser` **v0.9.0**
(2025-06-13). Here it is at v0.8.0 — note that it `implements File` rather
than extending it, and that the two methods which would force materialisation
throw on purpose:

```ts
// @mjackson/form-data-parser@0.8.0
export class FileUpload implements File {
  get size(): number {
    throw new Error(
      "Cannot get the size of a file upload without buffering the entire file",
    );
  }
  slice(): Blob {
    throw new Error(
      "Cannot slice a file upload without buffering the entire file",
    );
  }
  stream(): ReadableStream<Uint8Array> {
    return this.#part.body; // ← the live, socket-backed part stream
  }
}
```

And the part behind it, in `multipart-parser@0.9.0`, really was a stream, with
`Request`-style one-shot consumption semantics:

```ts
export class MultipartPart {
  #body: ReadableStream<Uint8Array>;
  get body(): ReadableStream<Uint8Array> {
    return this.#body;
  }
  get bodyUsed(): boolean {
    return this.#bodyUsed;
  }
}
```

In that era you genuinely could pipe an upload straight to S3 or Cloudinary
without the file ever being resident — exactly what the README describes.

Then `multipart-parser@0.10.0` replaced `#body` with `readonly content:
Uint8Array[]`, and `form-data-parser@0.9.0` adopted it, changing `FileUpload`
to a plain `File` subclass. Its changelog states the trade openly:

> This release … **removes the restrictions on checking the `size` and/or
> `slice`ing `FileUpload` objects.** `FileUpload` is now a normal subclass of
> `File` with all the same functionality.

Those restrictions were not incidental — they were the streaming. You cannot
know a stream's `size` without consuming it, so making `size` work means
buffering the part. The library traded byte-level streaming for `File`
ergonomics and kept the old marketing copy.

The irony is worth noting, because it cuts directly against "just restore the
streaming": **the ergonomics they traded it for are exactly what this app's
validation depends on.** `imageFileSchema()` is `z.instanceof(File)` plus
`file.size` and `file.type` checks — none of which would work against a
v0.8-era `FileUpload`, where `instanceof File` was false and `size` threw. The
buffering that costs us memory is the same change that lets Conform and Zod
validate an upload like any other field.

That is the real shape of the trade-off, and it is why prototype 5 has to
reintroduce a stand-in `File` to keep the schema working once bytes are
streaming again.

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

## The five prototypes

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

The client half is implemented in `p4-direct-upload-field.tsx`, and the
mechanism is simpler than it sounds: **two inputs share the field name, and
`disabled` decides which one the browser posts.** Disabled controls are excluded
from form submission, so exactly one is ever sent.

| State                       | file input | hidden descriptor | what gets posted |
| --------------------------- | ---------- | ----------------- | ---------------- |
| No JS / pre-hydration       | enabled    | disabled          | the bytes        |
| Upload in flight            | enabled    | disabled          | the bytes        |
| Upload succeeded            | disabled   | enabled           | a short string   |
| Upload failed / unreachable | enabled    | disabled          | the bytes        |

The no-JS row is tested against `renderToStaticMarkup` output — literally what a
scripting-disabled browser receives — rather than against simulated behaviour,
since no behaviour of ours can run there. The rest are tested through a real
`FormData(form)`, so the assertions are about what the browser would actually
send.

The failure rows are the part worth keeping: a broken or unreachable Cloudinary
does not break the form. The enhancement simply never completes, the file input
is never disabled, and the submission falls back to the server-side path. The
enhancement is purely additive.

**The honest caveat:** progressive enhancement means the server-side path must
stay, so P4 does not _bound_ worst-case server memory — it only avoids it for
clients that can run the script. Anyone (including an attacker) can still post
multipart to the action, which is why the parser limits and the server-side
policy checks in `verifyDirectUpload` both have to stay in place. P4 reduces the
common case to zero; it does not remove the need for a server-side upload path.

Still not implemented: the loader wiring that hands the form its ticket, and a
Cloudinary upload preset capping `max_file_size` at the edge.

### P5 — True socket-to-Cloudinary streaming (`p5-true-streaming.server.ts`)

The answer to "can Cloudinary not receive a stream?" — it can, and it always
could. `upload_stream` returns a `Transform` whose `_transform` is a bare
`this.push(buffer)` pass-through into an `https.request`, and the SDK sets **no
`Content-Length`** anywhere, so the upload goes out chunked and the payload size
need not be known in advance. That is exactly what an unbounded stream needs.

The blocker was never the sink. Replacing `form-data-parser` with `busboy` —
which emits each file as a `Readable` _while the request is still arriving_ —
gives genuine socket-to-socket transfer at constant memory, regardless of file
size. A test pins this: the body stalls mid-part and the provider has already
received bytes before the request finishes.

The tension it exposes is the real lesson, and it is inherent to streaming
rather than a busboy quirk: **you cannot enforce a size limit before you start
uploading, because you do not know the size until the stream ends.** The best
available is enforcement _during_ transfer — count bytes in a pass-through
`Transform` and tear the upload down the moment the cap is crossed. Media type
is the one check that stays free, since it arrives in the part headers before
any bytes.

So P5 inverts the guarantee the other prototypes preserve. `form-data-parser`
rejects an oversize upload _before_ your handler ever runs; P5 discovers it
mid-flight, having already streamed several MB to Cloudinary, and must destroy
the partial asset. Same for any schema rule that cannot be judged from headers.
Constant memory is paid for in orphan cleanup.

One practical trap, worth recording because it cost a hang: destroying the
limiter is not enough. busboy is still writing the part into it, and an
undrained part stalls the parser so `close` never fires. The failure path has to
`unpipe` and `resume` the source so parsing can reach the end of the request.

## Comparison

|        | Peak heap / upload  | Bytes held during Cloudinary round trip | Orphan risk                         | Schema change   | PE                    |
| ------ | ------------------- | --------------------------------------- | ----------------------------------- | --------------- | --------------------- |
| Today  | ~3x file            | yes                                     | none                                | —               | ✅                    |
| **P1** | ~1x file            | yes                                     | none                                | none            | ✅                    |
| **P2** | ~1x file            | no (released at ACK)                    | **yes** — needs compensating delete | none            | ✅                    |
| **P3** | ~1x file, then disk | no (on disk)                            | none                                | key indirection | ✅                    |
| **P4** | **zero** (JS path)  | n/a                                     | none¹                               | union branch    | ✅ (falls back to P1) |
| **P5** | **constant**        | no (never resident)                     | **yes** — partial asset on abort    | none            | ✅                    |

¹ An abandoned direct upload leaves an unreferenced Cloudinary asset; a
scheduled sweep of the folder handles it.

All of them report failures as a Conform `SubmissionResult`, so the no-JS path
renders field errors exactly as it does now. P1–P4 keep `maxFileSize`/`maxFiles`
enforced by the parser _before_ any handler runs; P5 trades that for
enforcement mid-transfer, which is the price of true streaming.

## Recommendation

1. **Take P1 now.** It is a handful of lines inside the existing provider, has
   no behavioural change to reason about, and removes two full-size copies.
2. **Reach for P4 if upload memory is actually a problem.** The PE fallback
   means the no-JS path keeps working, and no bytes touch the app at all.
   Given production runs on a 256 MB box, this is the one with real headroom
   upside.
3. **P5 if you want true streaming through the app** — genuinely constant
   memory, and the only option here that scales to files far larger than the
   current 3 MB cap. Adopting it means owning a second multipart parser and
   accepting that limits become mid-flight aborts rather than pre-checks.
4. **P3 only if** the heap must be free _during_ the upload but neither a
   direct upload nor a parser swap is acceptable. The key indirection is a real
   ergonomic cost.
5. **P2 is not recommended.** It takes on P5's orphan-cleanup problem without
   P5's constant-memory payoff.

Worth stating plainly: at a 3 MB cap with one image per submission, P1 vs P3 is
noise, and P5's constant memory beats P1's ~1x by a few megabytes per in-flight
request. P5 earns its complexity when the cap rises or uploads get concurrent;
P4 wins outright whenever a browser-side upload is acceptable, because the
cheapest byte to handle is the one that never arrives.

## Reproducing

```sh
npx vitest run app/features/images/prototypes/   # 52 tests
npm run typecheck
```
