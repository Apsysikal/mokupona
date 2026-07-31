# Upload prototypes — not wired into the app

Four takes on "stream uploads to Cloudinary while keeping Conform/Zod
progressive enhancement and server-side limits". Nothing here is imported by a
route; these modules exist to be read, run, and argued with.

The write-up — including the constraint that shapes all of them — is in
[`docs/streaming-uploads/design.md`](../../../../docs/streaming-uploads/design.md).

| File                             | Idea                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `p1-stream-handoff.server.ts`    | Pipe the `File` into `upload_stream` instead of buffering it into a `Buffer`. Drop-in.                       |
| `p2-parse-time-upload.server.ts` | Upload from the upload handler; leave a stand-in `File` in the `FormData`. Needs compensating deletes.       |
| `p3-disk-staged.server.ts`       | Stage parts to `file-storage`, validate the disk-backed handle, upload from disk.                            |
| `p4-signed-direct.server.ts`     | Browser uploads straight to Cloudinary with a signed ticket; server-side upload stays as the no-JS fallback. |
| `p5-true-streaming.server.ts`    | Swap the parser for busboy and forward the request socket straight into Cloudinary at constant memory.       |

The headline: **`form-data-parser` never hands the upload handler a stream** —
`FileUpload` is a fully-buffered `File` by the time you see it. P1–P3 work
around that; P4 sidesteps it by keeping bytes off the server; P5 escapes it by
replacing the parser.

Cloudinary was never the constraint: `upload_stream` is a pass-through
`Transform` into a `Content-Length`-less (chunked) request, so it accepts an
unbounded stream. P5 proves it — but true streaming means size limits become
mid-flight aborts instead of pre-checks, since you cannot know a stream's
length before it ends.

`busboy` is a devDependency added for P5 only; nothing in the app imports it.

```sh
npx vitest run app/features/images/prototypes/
```
