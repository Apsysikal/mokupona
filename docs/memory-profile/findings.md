# General memory profile

**Date:** 2026-08-02
**Scope:** Where the app's memory actually goes, beyond the password-hashing
spike covered in [login-memory-investigation](../login-memory-investigation/findings.md).
One fix applied, one earlier claim corrected, one suspected problem ruled out.

## Headline

The single largest consumer is not application code. It is **Prisma 7's WASM
query compiler**, which costs ~60 MB of boot-time peak on top of everything
else. Prisma ships a smaller build of that compiler, selectable with one line of
generator config, and on this workload it is **not slower**. That change is
applied here.

| 256 MB machine, boot + login + route crawl | before | after      |
| ------------------------------------------ | ------ | ---------- |
| Peak RSS                                   | 196 MB | **134 MB** |
| RSS after boot + first login               | 115 MB | 103 MB     |
| Settled RSS after 20 route crawls          | 169 MB | 154 MB     |

## Method

The production build (`npm run build`) served by `react-router-serve` inside a
cgroup v1 memory group set to the machine size, driven with real HTTP requests
across every reachable route (anonymous and admin-authenticated). Memory read
from the cgroup (`memory.usage_in_bytes`, `memory.max_usage_in_bytes`,
`memory.stat`), not from inside the process. Plus a V8 heap snapshot of a warm
server, and per-dependency import costs.

Host is 4-core/16 GB, Node v22 (production runs node:24). Latency numbers are
optimistic; memory numbers are the point.

### One methodology note, because it produced a wrong answer once

Measuring a library's cost by importing it alone in a fresh Node process
**overstates it by roughly 12 MB**. That is the module loader warming up, and it
lands on whichever module you import first. `dotenv` — a few hundred lines —
measures at 12.5 MB that way.

The number that means anything is the _marginal_ cost: import everything in one
process, in the order the server does, and take the delta per step. Every figure
below is marginal. This is what invalidated the earlier 13.7 MB `pino-pretty`
claim, whose real marginal cost is 2.0 MB.

## Where the resident set goes

### 1. Prisma's WASM query compiler — the big one

Prisma 7 with driver adapters has no Rust engine; queries are compiled by a WASM
module shipped as a **base64 string inside a JS file**. The heap snapshot of a
warm server showed it plainly: two ~4.5 MB strings, the largest objects in the
heap by a wide margin — the module source text and the decoded string, both
retained for the process lifetime.

```
top objects by aggregate self-size (warm server heap snapshot)
  string: const wasm = "AGFzbQEAAAABtgRLYAN/f38Bf2ACf38Bf2ACf…    4.5 MB
  string: AGFzbQEAAAABtgRLYAN/f38Bf2ACf38AYAF/AGADf39/AGAEf39…    4.5 MB
  array:  (object properties)                                    4.3 MB
```

Instrumenting the client directly shows the real cost is much larger than the
strings, because the module is then instantiated:

| step                    | RSS delta                     |
| ----------------------- | ----------------------------- |
| import generated client | +7.8 MB                       |
| `new PrismaClient()`    | +0.5 MB                       |
| **`$connect()`**        | **+68.2 MB**                  |
| first query             | +46.3 MB (transient)          |
| second query            | −43.9 MB (transient released) |

**Prisma ships two builds of this compiler** — `fast` (4.5 MB base64, the
default) and `small` (2.3 MB) — selectable with the `compilerBuild` generator
option. Benchmarked over 14 deliberately distinct query shapes, so each one has
to be compiled rather than served from cache:

| 14 distinct query shapes | `fast` (default) | `small`              |
| ------------------------ | ---------------- | -------------------- |
| Peak RSS                 | 236.8 / 248.0 MB | **159.5 / 157.0 MB** |
| Cold compile, all shapes | 67 / 68 ms       | **49 / 56 ms**       |
| Warm average per query   | 0.495 / 0.730 ms | 0.487 / 0.674 ms     |

`small` is ~85 MB cheaper and, on this workload, marginally _faster_ — the name
refers to the size of the compiler build, not to how fast it compiles. `fast`
presumably earns its name on query graphs far more complex than anything here.

Applied in [`prisma/schema.prisma`](../../prisma/schema.prisma):

```prisma
generator client {
  provider      = "prisma-client"
  output        = "./generated"
  compilerBuild = "small"
}
```

Query semantics are unchanged — it is the same compiler, built for size. Revert
by deleting the line if a query-heavy admin page ever regresses.

### 2. Module graph — what the ~100 MB baseline is made of

Marginal RSS, imported cumulatively in the server's own order:

| module               | marginal RSS |     | module             | marginal RSS |
| -------------------- | -----------: | --- | ------------------ | -----------: |
| `better-auth`        |      27.6 MB |     | `cloudinary`       |       7.9 MB |
| `radix-ui`           |      20.4 MB |     | `react-dom/server` |       6.4 MB |
| `react`              |       8.9 MB |     | `zod`              |       4.9 MB |
| `@react-router/node` |       7.8 MB |     | `react-router`     |       4.6 MB |

Everything else is under 3 MB. `pino` is 13.1 MB when it is the first thing
loaded and effectively free afterwards; `pino-pretty` adds 2.0 MB on top of it.

Nothing here is obviously wasteful — `better-auth` and `radix-ui` are both doing
real work, and Radix is server-rendered so it genuinely has to be loaded. Worth
knowing mainly so the baseline is not mistaken for a leak.

### 3. JS heap is a minority of RSS

The warm-server heap snapshot totalled **62.8 MB** of self-size (23.1 MB
strings, 18.3 MB code, 8.4 MB arrays) against an RSS several times that. The
remainder is V8 code and metadata outside the object graph, WASM, and native
allocations. This matters for tuning: most of this app's footprint is not
reachable by GC tuning at all.

## Ruled out

### There is no leak

Sixty full route crawls (anonymous + admin, 15 routes each) inside a 256 MB
cgroup, repeated six times, three with a capped V8 heap and three without:

```
after 60 crawls:  rss=116MB  rss=112MB  rss=116MB   (default heap sizing)
after 60 crawls:  rss=116MB  rss=120MB  rss=113MB   (--max-old-space-size=112)
```

RSS plateaus in the 112–120 MB band regardless, with zero swap, zero major
faults and zero allocation stalls in every run. One earlier run drifted to
204 MB before settling, which is V8 growing opportunistically when nothing is
forcing it to collect — not retention. Repeating it did not reproduce.

### `--max-old-space-size` is not worth setting

V8 correctly reads the cgroup/machine limit and sizes its heap accordingly (259
MiB heap limit on a 256 MB machine, versus 4144 MiB on the 16 GB host). Capping
it lower changed nothing measurable — same plateau, same latency. Recommended
_against_, on the evidence: it is a knob that would need re-tuning on every
machine resize for no observed benefit.

### The module-level caches are bounded

- `staticBlurCache` ([`blur-placeholder.server.ts:49`](../../app/features/images/blur-placeholder.server.ts))
  is keyed by the public_id of static hero/accent assets — a fixed handful of
  ~1–2 KB data URLs.
- `reportedRoleViolations` ([`guards.server.ts:16`](../../app/features/auth/guards.server.ts))
  is bounded by the user count and holds only ids.

Neither grows with traffic.

## Noted, not fixed

**Image uploads hold two copies.** `parseImageFormData` keeps the upload as an
in-memory `FileUpload` (4 MB parse ceiling), and the Cloudinary provider then
does `Buffer.from(await file.arrayBuffer())`
([`cloudinary.server.ts:44`](../../app/features/images/providers/cloudinary.server.ts)),
a second full copy — so ~8 MB transient at the ceiling. It is admin-only, rare,
and bounded, so it is nowhere near the top of the list; streaming the upload
straight to Cloudinary would remove it if the machine stays at 256 MB.

## What actually moves the needle

Ranked by measured effect on a 256 MB machine:

1. **`compilerBuild = "small"`** — 62 MB off the boot peak. Applied.
2. **The scrypt gate** — 98 MB off the sign-in peak. Applied
   ([previous investigation](../login-memory-investigation/findings.md)).
3. **`fly scale memory 512`** — the only change that creates actual headroom
   rather than reducing demand. Still recommended, still not applied (needs
   Fly access, ~$2/month).

With 1 and 2 applied the peak measured on a simulated 256 MB machine falls from
196 MB to 134 MB — from 77 % of the machine to 52 %.
