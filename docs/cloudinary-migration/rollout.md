# Cloudinary Migration — Rollout Status & Runbook

**Last updated:** 2026-07-19 · Phase 1 implemented and verified on `feat/cloudinary-images`; live smoke test passed; static assets uploaded; staging secrets set. This file is the handoff point — pick up at [Remaining steps](#remaining-steps).

## Done

- **Phase 1 code** — complete on `feat/cloudinary-images` (~20 commits ahead of `origin/dev`, includes the 3 pre-existing local dev commits). All verification green: unit suite, lint, typecheck, full Cypress e2e (twice, offline under `IMAGE_PROVIDER=local`). A multi-agent review (6 dimensions, adversarial verification) confirmed 6 findings; all fixed (commit `56746a1`), notably:
  - production image now ships `scripts/`, `app/`, `tsconfig.json` and `tsx` (runtime dep) so the backfill can run via `fly ssh console`;
  - `fly.toml` sets `IMAGE_UPLOAD_FOLDER = "/data/image-uploads"` (volume) and the backfill grew a second pass that migrates window uploads (local `storageKey`, `version IS NULL`) to Cloudinary.
- **Live smoke test** (2026-07-19, `CLOUDINARY_FOLDER_PREFIX=dev`): store → versioned variant fetch 200 → destroy with invalidate → fresh variant 404. Blur placeholder ~0.5 KB.
- **Static assets uploaded** — `static/hero-image`, `static/accent-image` exist in the account (shared, non-env-prefixed; `overwrite: false` makes the backfill's static step a no-op). This closes the window where a freshly deployed env with a cloud name would 404 its hero.
- **Staging secrets set** (all four `CLOUDINARY_*`).
- **No-JS fallback** — `OptimizedImage` renders a full-opacity `<noscript>` image so no-JS visitors don't sit on the blur (commit `cf854fa`).

## Decisions taken during rollout (supersede the plan where they differ)

- **No `CLOUDINARY_*` values in `fly.toml`** — all four (`CLOUD_NAME`, `API_KEY`, `API_SECRET`, `FOLDER_PREFIX`) live as Fly **secrets** per app instead of `[env]` entries. The code reads plain env vars, so behavior is identical; prefix per app: `staging` / `prod`.
- `IMAGE_UPLOAD_FOLDER = "/data/image-uploads"` IS in `fly.toml [env]` (not a secret — it's a path on the mounted volume).
- Local dev may keep `CLOUDINARY_*` in `.env` (gitignored) — DB images still serve locally; only the static hero/accent render from the CDN (by design). Removing `CLOUDINARY_CLOUD_NAME` makes dev fully offline (neutral hero frame).

## Remaining steps

### 1. Ship release 1 to staging
1. Push `feat/cloudinary-images`, open a PR against `dev`, merge. CI (offline, no new secrets) gates, then auto-deploys staging on the `dev` push.
2. Verify release 1 is inert on staging: boot clean (`fly logs -a <staging-app>`), migration applied by `start.sh`, covers still render via `/file/:fileId`, hero/accent render from Cloudinary (secrets + statics already in place), an admin upload works (lands on `/data/image-uploads` with a local `storageKey`).

### 2. Backfill staging
```sh
fly ssh console -a <staging-app>
npx tsx scripts/backfill-images-to-cloudinary.ts
```
Idempotent/resumable; logs per row; migrates blob rows AND window uploads; static step is a no-op. Spot-check the Cloudinary console: `staging/dinners`, `staging/board-members`.

### 3. Flip staging
```sh
fly secrets set IMAGE_PROVIDER=cloudinary -a <staging-app>   # restarts the app
```
Verify: pages emit `res.cloudinary.com` URLs with working srcset variants; blur-up renders; dinner OG image is an absolute Cloudinary URL; upload → replace → delete round-trips (asset appears/disappears in the console); `/file/:fileId` 302s for old links; memory flat during an image-heavy crawl; credit usage sane after one-time transform generation.

**Rollback at any point:** `fly secrets unset IMAGE_PROVIDER -a <staging-app>` — blobs are untouched until Phase 3.

### 4. Prod (after the staging soak, one merge)
1. **Before merging `dev` → `main`**: set the four `CLOUDINARY_*` secrets on prod (`fly secrets set … CLOUDINARY_FOLDER_PREFIX=prod`). At minimum the cloud name must exist or the landing hero renders as an empty frame after deploy.
2. Merge `dev` → `main` → prod deploys release 1 (inert: blob serving continues; window uploads go to the volume).
3. Backfill prod: `fly ssh console` → `npx tsx scripts/backfill-images-to-cloudinary.ts`.
4. Flip prod: `fly secrets set IMAGE_PROVIDER=cloudinary`. Same verification list as staging. **Never flip before the secrets exist** — the provider invariants on boot and the app crashes.
5. Set the Cloudinary usage alert (~50% of 25 credits) if not done yet.

### 5. Later
- **Phase 3** (separate release after a prod verification window): drop `blob` + VACUUM, delete the sharp stack/mitigations, fold `features/uploads` into `features/images` — see implementation-plan.md.
- Optional hygiene: rotate the API key pair used during local testing (Settings → API Keys supports concurrent pairs).

## Corrections to design.md / implementation-plan.md (found while implementing)

1. `app/features/uploads/image-route.server.ts` never existed post-architecture-rework — the loader lives in `app/routes/file.$fileId.tsx`; only the test file carried the old name (reworked in place).
2. The local provider's "key = image id" is unimplementable: `store()` runs before the Image row exists. Keys are provider-generated `folder/<uuid>`.
3. `IMAGE_UPLOAD_FOLDER` did not previously exist in the repo; it was introduced by this branch with a stable (cross-process) tmpdir default — NOT per-process mkdtemp, because the seed and e2e helpers store files from different processes than the server that serves them.
4. "Same operational pattern as prisma/seed.ts" for the backfill was untrue for the deployed image — the Dockerfile had to grow `scripts/`, `app/`, `tsconfig.json` and a runtime `tsx` to make `fly ssh console` + `npx tsx` work.
5. The provider interface's `destroy(storageKey)` keeps `invalidate: true` as an implementation detail of the cloudinary provider (design §3.1's minimal interface, not §2's SDK-shaped signature).
