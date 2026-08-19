# Cloudflare hosting cost estimate

**Date:** 2026-08-19
**Scope:** What this app would cost to run on Cloudflare instead of Fly, and
what it would take to get there. Prices are list prices as of August 2026.

## Headline

**$5.00/month, flat**, for any traffic this site will plausibly see — and that
$5 is the Workers Paid subscription itself, not usage. Every metered service
(D1, R2, Workers Logs, static assets, DNS) stays inside its included quota by
two to four orders of magnitude.

Today's Fly bill is roughly **$2.09/month** (one `shared-cpu-1x` 256 MB machine
at ~$1.94 plus a 1 GB volume at $0.15). So Cloudflare is about **$3/month more
expensive** — or a wash, if the `fly scale memory 512` that
[the memory profile](../memory-profile/findings.md) recommends ever happens
(~$4.04/month).

The dollars are not the reason to move or stay. **The port is.** See
[what it would take](#what-it-would-take) — there are 14 interactive database
transactions that D1 cannot run, and that is the bulk of the work.

## The bill, line by line

Modelled on three traffic scenarios. Static-asset requests (JS, CSS, fonts, the
2.1 MB hero JPEG) are free and unlimited on Workers and are excluded
throughout — only requests that actually execute the Worker are billed. One
page view is counted as ~3 Worker requests: the document plus the `.data`
fetches a client-side navigation triggers.

| | quiet month | signup rush | absurd (press pickup) |
| --- | --- | --- | --- |
| Page views | 3,000 | 15,000 | 300,000 |
| Worker requests | 9,000 | 45,000 | 900,000 |
| CPU-ms @ ~15 ms blended | 0.14 M | 0.68 M | 13.5 M |
| **Included on Workers Paid** | 10 M req / 30 M CPU-ms | ← | ← |
| Workers overage | $0 | $0 | $0 |

| Service | Usage at the "signup rush" column | Included | Cost |
| --- | --- | --- | --- |
| Workers Paid | — | — | **$5.00** |
| Workers — requests | 45 K | 10 M/mo | $0 |
| Workers — CPU | 0.68 M CPU-ms | 30 M CPU-ms/mo | $0 |
| Static assets | all of `public/` + build output | unlimited, free | $0 |
| D1 — rows read | ~4.5 M | 25 B/mo | $0 |
| D1 — rows written | ~50 K | 50 M/mo | $0 |
| D1 — storage | a few MB | 5 GB | $0 |
| R2 (if images move off Cloudinary) | ~1.5 GB, ~50 K Class B ops | 10 GB, 10 M Class B | $0 |
| Workers Logs | ~135 K events | 20 M events/mo | $0 |
| DNS / TLS / CDN / basic WAF | — | Cloudflare Free plan | $0 |
| **Total** | | | **$5.00/mo** |

Resend stays where it is — Cloudflare has no transactional-send product — so
that line is unchanged either way.

### Where the ceiling actually is

CPU is the binding constraint, not requests. At the ~15 ms/request blend above,
30 M included CPU-ms is about **2 M Worker requests**, i.e. **~660 K page views
a month**, before the first cent of overage. Past that it is $0.02 per million
CPU-ms and $0.30 per million requests — so even 10× that traffic adds only a
few dollars.

### The free plan does not work

Not because of the request cap (100 K/day is ample) but because of the **10 ms
CPU limit per request** on the free plan. React Router SSR of the admin routes
sits near that line, and a sign-in blows straight through it: better-auth
derives with scrypt at N=16384, r=16, which is a few hundred milliseconds of
CPU. $5/month is the floor.

### Containers, for completeness

Cloudflare Containers would run the existing `Dockerfile` nearly as-is, and is
the only option that avoids the D1 rewrite. It is both pricier and unworkable:

- Always-on 256 MiB: ~$1.64/mo memory ($0.0000025/GiB-s), ~$1.05/mo CPU at a 2 %
  duty cycle ($0.000020/vCPU-s), ~$0.74/mo disk — **plus** the same $5 Workers
  Paid subscription, since Containers require it. Call it **~$8.4/month**.
- **All container disk is ephemeral.** A slept instance restarts on a fresh
  disk from the image. There are no volumes. So `DATABASE_URL=file:/data/sqlite.db`
  cannot survive, and the D1 (or Turso, or Hyperdrive-to-Postgres) migration is
  back on the table anyway — now with a worse bill and cold starts.

Snapshots and FUSE-to-R2 are floated as workarounds; neither is something to
put a members' database on.

## What it would take

This is the real cost. Ranked by effort.

1. **14 interactive transactions have no D1 equivalent.** `prisma.$transaction(async (tx) => …)`
   appears in `app/models/{event,gallery,user,invite,form,form-submission,address,board-member}.server.ts`.
   D1 supports batched statements only; the Prisma D1 adapter either throws on
   the callback form or degrades it to loose statements with no atomicity. Each
   call site becomes an array batch — and the ones that genuinely read-then-write
   inside the transaction (invite acceptance in `invite.server.ts:42`, the form
   version bump in `form.server.ts:33`) need redesign, not translation.
2. **SQLite volume → D1.** The schema is already SQLite, so the migration SQL
   mostly transfers. `@prisma/adapter-better-sqlite3` → `@prisma/adapter-d1`,
   and `app/db.server.ts` stops being a module-level `singleton` — the client
   has to be constructed per request from the `env.DB` binding, which means
   `getLoadContext` threading through every loader and action that touches
   `prisma`.
3. **The whole logging stack is deleted.** `app/logger.server.ts` writes pino
   file sinks to `/data/logs`; `logrotate.conf` and the Dockerfile's
   `cron.daily` → `cron.hourly` move rotate them; `app/logger/cron-check.server.ts`
   reads the log directory back to verify rotation is alive. None of that
   exists on Workers. pino-to-stdout survives; everything else becomes Workers
   Logs, and the cron-check module and its tests go away.
4. **Backups change shape.** `docs/database-backups/nas-backup.sh` pulls the
   `.db` file off the Fly volume over flyctl's WireGuard. There is no file to
   pull. Replacement is D1 Time Travel (30 days of point-in-time restore on
   paid) plus a scheduled `wrangler d1 export` into R2 — which is arguably
   better, but it is a rewrite of that document's entire architecture section.
5. **scrypt gets more dangerous, not less.** The memory profile already flags
   that sign-in allocates 32 MiB per hash and deliberately leaves it unfixed. A
   Worker isolate has a **128 MB** memory limit. Two or three concurrent
   sign-ins in one isolate is now a hard failure rather than a slow page, and
   the derivation is billed CPU on top. This should be fixed (lower params, or a
   WebCrypto KDF) *before* a move, not during.
6. **`node:fs` importers need splitting out of the graph.** `app/shared/fs-file-storage.server.ts`,
   `app/features/images/providers/local.server.ts`, and
   `app/features/mail/providers/capture.server.ts` are dev/CI-only paths —
   production already runs Cloudinary and Resend — but they sit in shared module
   graphs, so `nodejs_compat` will not rescue them at build time. The other
   `node:crypto` users (`honeypot.server.ts`, `invite.server.ts`,
   `hash-ip.server.ts`) are fine under `nodejs_compat`.
7. **Server entry and deploy.** `react-router-serve` → `wrangler` plus
   `@cloudflare/vite-plugin` and a `wrangler.jsonc`. `Dockerfile`, `fly.toml`,
   `start.sh`, and `logrotate.conf` are all deleted.
8. **E2E.** `test:e2e:run` drives `start:mocks` via `start-server-and-test`; it
   would target `wrangler dev` instead, and the msw mock server's relationship
   to the Worker runtime needs rethinking.
9. **Verify the Cloudinary SDK under `nodejs_compat`** — it reaches for node
   `http`/`streams` internally. The 4 MB in-memory upload parse is fine against
   Workers' 100 MB request-body limit on paid.

## Recommendation

Do not move for the money. $5/month versus $2–4/month is noise, and the
migration is a multi-day change concentrated in the data layer, where this app's
correctness lives.

Move if the *operational* story is worth it: no VM to size, no 256 MB ceiling to
profile against, no volume to back up off-provider, no logrotate cron, and
global edge SSR. Those are real, and three of them are things this repo has
already spent documented effort on.

If it does happen, do it in this order: fix scrypt first, then port the 14
transactions to batches while still on SQLite (they are valid SQLite either
way), then swap the adapter last. That keeps every step testable on Fly.

## Sources

Prices retrieved 2026-08-19 from Cloudflare's published rates: Workers Paid
$5/mo including 10 M requests and 30 M CPU-ms, then $0.30/M requests and
$0.02/M CPU-ms; free plan 100 K req/day at 10 ms CPU/request. D1 25 B rows read,
50 M rows written, 5 GB storage included, then $0.001/M read, $1.00/M written,
$0.75/GB-mo. R2 $0.015/GB-mo, $4.50/M Class A, $0.36/M Class B, 10 GB + 1 M A +
10 M B free, zero egress. Cloudflare Images $5/100 K stored, $1/100 K delivered,
$0.50/1 K transformations. Containers $0.0000025/GiB-s memory, $0.000020/vCPU-s
CPU (active-usage billing since Nov 2025), $0.00000007/GB-s disk. Workers Logs
20 M events/mo included, then $0.60/M. Fly `shared-cpu-1x` 256 MB ~$1.94/mo,
volumes $0.15/GB-mo, snapshots $0.08/GB-mo with 10 GB free (billable from
January 2026).
