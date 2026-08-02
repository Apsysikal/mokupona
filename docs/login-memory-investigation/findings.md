# Login memory investigation — password hashing

**Date:** 2026-08-01
**Scope:** Diagnose the 2–4 s handling time on email/password sign-in and the
memory pressure around it. Root cause confirmed, one fix applied.

Follows [staging-memory-investigation/findings.md](../staging-memory-investigation/findings.md),
whose sharp/libvips-era mitigations were removed by the Cloudinary migration.
That document ends by saying a new ratchet should be re-measured rather than
re-fixed on faith. This is that re-measurement, and it lands somewhere else
entirely: not a leak, a **transient allocation that does not fit**.

## Verdict

The hunch was right. Sign-in is slow because of the hashing algorithm — but not
because it is slow. `scrypt` is _deliberately_ memory-hard, and better-auth's
parameters ask for **32 MiB per derivation**. Up to four of those run at once,
so a burst of sign-ins asks a 256 MB machine for **~130 MB of transient
buffers** on top of the app's resident set. The kernel makes room by paging the
app out, and because scrypt reads its arena in random order, every evicted page
returns as a major fault. Hence seconds of wall time with an idle CPU.

## What better-auth actually runs

`better-auth@1.6.25` → `@better-auth/utils@0.4.2`. On Node the `node` export
condition resolves `dist/password.node.cjs` — the **native** `node:crypto`
scrypt, not the pure-JS `@noble/hashes` fallback. So the CPU cost is already as
good as it gets; the problem is the parameters:

```js
// node_modules/@better-auth/utils/dist/password.node.mjs
const config = { N: 16384, r: 16, p: 1, dkLen: 64 };
//  scrypt working set = 128 * N * r = 128 * 16384 * 16 = 32 MiB, per call
```

Three consequences:

1. **32 MiB per sign-in**, allocated natively (off the V8 heap), so no amount of
   GC tuning or `--max-old-space-size` touches it.
2. **Up to 4 concurrent.** `crypto.scrypt` runs on the libuv thread pool, which
   defaults to 4 threads — so four overlapping sign-ins mean 4 × 32 MiB live at
   once. Confirmed below: at 8 concurrent the peak stops growing and latency
   doubles instead.
3. **The parameters are not recoverable from the hash.** The stored format is
   `` `${saltHex}:${keyHex}` `` with no cost parameters, so changing `N` or `r`
   silently invalidates every password in the database. This matters for the
   remediation options.

## Measurements

Method: the real production build (`npm run build`), served by
`react-router-serve`, driven with real `POST /login` requests against the seeded
user. The Fly machine is modelled with a cgroup v1 memory limit plus a 512 MB
swapfile — matching `swap_size_mb = 512` in `fly.toml`. Host is 4-core/16 GB,
Node v22 (production runs node:24; same OpenSSL scrypt).

Numbers are therefore **optimistic** on latency — Fly's `shared-cpu-1x` is a
fraction of one core with slower I/O — and **faithful** on memory, which is what
the diagnosis rests on.

### The allocation, in isolation

`crypto.scrypt` at better-auth's parameters, peak RSS over baseline:

| concurrency | wall (total) | per hash | peak RSS above baseline |
| ----------- | ------------ | -------- | ----------------------- |
| 1           | 110 ms       | 110 ms   | **+32 MiB**             |
| 2           | 116 ms       | 58 ms    | +65 MiB                 |
| 4           | 136 ms       | 34 ms    | **+131 MiB**            |
| 8           | 314 ms       | 39 ms    | +131 MiB (pool-capped)  |

### The same thing through the running app

Unconstrained (16 GB host, V8 heap limit 4144 MiB): baseline RSS 234 MB, and
`VmHWM` after four concurrent logins **366 MB** — the same +131 MB.

Constrained to a 256 MB machine, V8 correctly auto-sizes its heap limit down to
259 MiB and the idle baseline drops to ~103 MB. Four concurrent logins still
peak at **233 MB — 91 % of the machine**, with nothing left for page cache,
SQLite, or the log sink.

### The pathology, reproduced

Same build, same load, the only variable being how many derivations may run at
once. `192M` models the 256 MB machine minus the kernel and the extra resident
state production carries (its own doc records production sitting at ~40 MB
available with ~40 MB already in swap):

| 192 MB machine, 4 concurrent logins | 4 at a time (default)   | 1 at a time (applied) |
| ----------------------------------- | ----------------------- | --------------------- |
| Wall per login                      | 0.44 s                  | 0.14 – 0.48 s         |
| Peak RSS                            | **192 MB (at the cap)** | 178 MB                |
| Swapped out                         | 8 MB                    | **0**                 |
| Major faults                        | 3 382                   | **0**                 |
| Allocation stalls (`failcnt`)       | 7 549                   | **0**                 |

A longer ungated run made the shape unmistakable: the _first_ login after warmup
took **0.615 s** with 1 894 major faults, and after eight concurrent logins the
process had **106 MB in swap, 6 625 major faults, and 28 332 allocation stalls**.

The most telling number is the resident set going the _wrong_ way: 110 MB → 97
MB → 81 MB across the bursts. Those are the app's own pages being evicted to
make room for scrypt. That is why the sluggishness is not confined to the login
request — the next few page loads pay to fault the app back in.

## Fix applied

[`app/features/auth/password-hash-gate.server.ts`](../../app/features/auth/password-hash-gate.server.ts)
wraps better-auth's own `hashPassword`/`verifyPassword` in a one-slot gate,
wired in through `emailAndPassword.password` in
[`auth.server.ts`](../../app/features/auth/auth.server.ts).

**The derivation is untouched** — same function, same parameters — so every hash
already in the database keeps verifying. A test pins that: it hashes through
better-auth directly and verifies through the gate.

This bounds the transient cost at one 32 MiB arena instead of four, and it gives
up no real throughput, because the machine has a single shared vCPU — the four
concurrent scrypts were never computing in parallel, only competing for memory.

**The honest trade-off:** when sign-ins genuinely overlap, they now queue. Eight
simultaneous logins measured 0.47–1.38 s at the tail versus 0.43 s ungated. That
is the right trade here (a handful of members, and the ungated 0.43 s was only
"fast" because it had already dumped the app into swap), but it is a trade, and
it will look worse the slower the vCPU is. `SLOTS` is a single constant if the
machine ever grows.

## Still recommended, not applied

### 1. Give the machine 512 MB — the actual fix

The gate keeps the app off the cliff; it does not create headroom. A 256 MB
machine running a React Router SSR server with a ~100–130 MB baseline has no
room for a 32 MiB spike plus page cache. `fly.toml` carries no `[[vm]]` block,
so the size lives on the machine — `fly scale memory 512`. On Fly's pricing
this is roughly $2/month. It is the highest-leverage change available and needs
no code.

Related: `swap_size_mb = 512` is what converts an OOM kill into a 2–4 s request.
Worth keeping as a safety net, but it is currently _masking_ an undersized
machine rather than protecting a healthy one.

### 2. Do **not** lower the scrypt parameters

The tempting move — `r: 8` for 16 MiB, or `r: 4` for 8 MiB — is a real
weakening of password hashing, not a free win, and because the stored format
carries no parameters it would lock out every existing user unless paired with a
versioned-hash scheme (`verify` tries the new parameters, falls back to legacy,
rehashes on success). That is a fair amount of security-critical machinery to
avoid a $2/month machine. Only worth revisiting if the machine cannot grow.

### 3. `pino-pretty` is loaded in production for nothing — ~2 MB

[`app/logger.server.ts:5`](../../app/logger.server.ts) imports it statically,
but only ever calls it on the non-production branch.

**Corrected figure.** An earlier revision of this document put the cost at
13.7 MB, measured by importing `pino-pretty` alone in a fresh process. That
number is wrong: a fresh Node process pays ~12 MB of module-loader warm-up on
its first real import, which the measurement attributed to the library. Imported
_after_ `pino` — which the app loads regardless, and which is where nearly all
the shared dependency graph comes from — the marginal cost is **2.0 MB**. See
[memory-profile/findings.md](../memory-profile/findings.md) for the method.

Still worth doing eventually (a `createRequire` inside the non-production branch
keeps `createLogger` synchronous and lets the dependency move to
`devDependencies`, shrinking the image too), but at 2 MB it is housekeeping, not
a fix.

### 4. Session lookups (latency, not memory)

Every request resolves the session through an indexed SQLite read.
[`auth-rework/design.md:133`](../auth-rework/design.md) already anticipated
enabling better-auth's cookie cache "if it ever shows up in the Fly
memory/latency profile". It does not show up in the memory profile — this is a
latency item, and a much smaller one than the swap thrash above.

## Reproducing this

The harness is not committed (it needs cgroup and swapon privileges). To rebuild
it: create a 512 MB swapfile, make a cgroup v1 memory group with
`memory.limit_in_bytes` at the machine size and `memory.memsw.limit_in_bytes` at
size + 512 MB, put `react-router-serve` in it, then watch
`memory.max_usage_in_bytes`, `memory.stat`'s `total_pgmajfault` / `total_swap`,
and `memory.failcnt` across concurrent `POST /login` requests.

On the real machine the equivalent check is `fly ssh console` and, during a
login burst: `grep -E 'VmRSS|VmSwap' /proc/<pid>/status` plus the process's
`majflt` from `/proc/<pid>/stat`. Major faults climbing during sign-in is the
signature; CPU time staying low while wall time is seconds is the confirmation.
