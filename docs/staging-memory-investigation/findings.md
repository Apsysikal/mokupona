# Staging memory investigation — image transforms

**Date:** 2026-07-05
**Scope:** Diagnose why memory on the **staging** fly.io app rises when image
transforms are created and never comes back down. Investigation only — no
deploys or config changes were made to any environment.

**Target app:** `mokupona-stack-b568-staging` (machine `48ed542b7d3958`, region
`ams`, 512 MB). All runtime numbers below come from this app via read-only
`fly ssh console` inspection.

> Note: `fly.toml` in this repo points at `mokupona-stack-b568` (production).
> Investigating staging requires passing `-a mokupona-stack-b568-staging` on
> every `flyctl` call — the default app is production.

## Live staging evidence

| Metric (staging, machine `48ed542b7d3958`) | Value |
|---|---|
| Machine memory | 512 MB (459 MB usable) |
| **Node process (PID 724) RSS** | **356 MB** (`VmRSS: 364520 kB`) |
| Node virtual data (`VmData`) | **979 MB** (`VmData: 1001392 kB`) |
| MemAvailable | 62 MB |
| MemFree | 6 MB |
| `/tmp` disk cache | 3.6 MB (on rootfs, **not** RAM) |
| `VIPS_CONCURRENCY` / `MALLOC_ARENA_MAX` / `NODE_OPTIONS` | all unset |
| Base image | `node:24-bullseye-slim` → Debian **glibc** |

The Node process sits at **356 MB RSS on a 459 MB-usable box (~78%)** with a
~979 MB virtual footprint. That RSS-vs-virtual gap, plus RSS that plateaus high
and never recedes, is the signature of **native (sharp/libvips) allocations
retained by glibc's malloc arenas** — not a JS-heap leak. A V8-heap leak would
be a fraction of this size and would be reclaimed by GC.

The on-disk cache is a red herring for RAM: it is only 3.6 MB and lives on the
rootfs (`df` showed `/tmp` on `none`, not tmpfs), so saved transforms are on
disk, not in memory.

## Root cause (code + runtime)

Transform path — [`app/routes/file.$fileId.tsx:123`](../../app/routes/file.$fileId.tsx):

```js
const optimizedImage = await sharp(file.blob)
  .webp()
  .resize({ ...width, ...height, fit })
  .toBuffer();
```

Three compounding factors make memory climb and never return:

### 1. libvips operation cache is never disabled (primary)

There is no `sharp.cache(...)` call anywhere in the codebase. By default libvips
caches up to **100 MB / 50 operations / 20 files** of *decoded* image data across
requests. On a 512 MB box that is a large, persistent pool that fills as new
transform variants are requested and then stays resident. This alone explains
"rises on creating transforms, never freed."

### 2. glibc arena fragmentation (why RSS never drops)

The base image is glibc and `MALLOC_ARENA_MAX` is unset. sharp runs on
libvips/libuv worker threads; each thread that touches malloc gets its own arena,
and freed native buffers are returned to the arena free-list but **not** released
back to the OS. So even after `.toBuffer()` completes and the JS buffers are
GC'd, RSS stays elevated. The 979 MB `VmData` is those over-reserved arenas.

### 3. Request fan-out amplifies the spike

`OptimizedImage` at [`app/routes/file.$fileId.tsx:39`](../../app/routes/file.$fileId.tsx)
emits a 4-entry `srcSet` (432 / 648 / 864 / 1080) plus the `src` → **5 concurrent
transform requests per image rendered**. Each request:

- `getImageById` loads the *entire* original blob into RAM
  ([`app/models/image.server.ts`](../../app/models/image.server.ts) — `findUnique`
  returns the full `Bytes` column), then
- sharp decodes it to raw (width × height × 4 bytes) and encodes webp — all in
  flight simultaneously.

A single 4000×3000 source is ~48 MB raw *per* decode; five at once is a large
transient spike that seeds the arenas/cache to a high-water mark that then never
recedes. Because the cache dir is `mkdtemp` in `/tmp`
([`app/utils/file-chache-storage.server.ts:8`](../../app/utils/file-chache-storage.server.ts)),
it is wiped on every restart/deploy, so this cold-cache burst recurs after each
deploy.

## Recommended fixes (not applied)

Ranked by impact/effort. All are safe, reversible, and do not change transform
output.

1. **Cap libvips memory + concurrency** — add once at server startup (e.g. top of
   `file-chache-storage.server.ts` or a server-init module):

   ```js
   import sharp from "sharp";
   sharp.cache(false);        // or sharp.cache({ memory: 32, files: 0 })
   sharp.concurrency(1);      // single shared vCPU anyway
   ```

   Removes factor #1 and bounds per-request threads.

2. **Bound glibc arenas** — set env on staging (fly secrets / `[env]`):
   `MALLOC_ARENA_MAX=2`. Cheapest, highest-leverage fix for "RSS never comes back
   down." (Optionally switch to jemalloc via `LD_PRELOAD`, but `MALLOC_ARENA_MAX`
   is enough to test the hypothesis.)

3. **Serialize / limit concurrent transforms** — cap in-flight sharp jobs (a
   small semaphore / p-limit in the loader) so the 5-way srcset fan-out cannot all
   decode at once. Bounds the transient high-water mark.

4. **Lower priority** — add `.resize({ withoutEnlargement: true })`, consider
   streaming, and persist the cache under `/data` instead of ephemeral `/tmp` so
   cold-cache bursts do not recur on every deploy.

**Quickest confirmation:** set `MALLOC_ARENA_MAX=2` + `sharp.cache(false)` on
staging only and watch RSS across a batch of transform requests — it should
plateau far lower and recede after bursts.

## Cross-environment note

Staging is 512 MB; **production (`mokupona-stack-b568`) is only 256 MB**, and it
was observed running with ~40 MB available and ~40 MB already in swap. Same code,
same missing tuning — so the identical root cause is *more* acute in production.
Flagged for awareness only; no changes were made to either environment.
