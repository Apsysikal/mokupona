# App Architecture Review — 2026-07-18

Full-codebase review of `app/` (186 TS files, ~16k lines): where friction lives between
modules, in calling signatures, and in coupling — and which primitives to extract to make
the codebase more workable.

- [`analysis.md`](./analysis.md) — the findings: friction inventory by theme, with
  file:line evidence, plus incidental bugs found along the way.
- [`plan.md`](./plan.md) — the refactor plan: seven phases from bug fixes to structural
  restructuring, each with the primitives to extract, call-site counts, and sequencing.

## Headline findings

1. **The app-owned data-access layer is done and clean.**
   `docs/data-access-layer/design.md` is fully implemented and ESLint-enforced; app
   queries do not bypass models. Better Auth's Prisma adapter remains an intentional,
   lint-exempt third-party boundary. The DAL doc should be rewritten from migration
   plan to conventions reference.
2. **The route layer is the friction hotspot.** 31 copy-pasted role guards, a ~26-line
   image-upload block duplicated in 4 actions, five `actionData` variations,
   10 verbatim 404 throws, 3 hand-rolled intent dispatchers. React Router 8
   middleware (now on v8.0.1), a 404 helper, and narrowly scoped upload/intent helpers
   erase most of it. Generic form and delete-route factories are deferred.
3. **Placement inversions blur the layering.** A React component exported from a
   resource route, a 787-line feature UI in generic `components/`, a shared component
   typed off an admin route's loader, utils importing features. The current plan applies
   “features own their UI; components take view-model props” to events; the recent
   signup-form builder remains documented, deferred debt.
4. **The core domain has no feature folder.** Events (surfaced as "dinners") span
   11 routes, ~576 lines of UI in generic `components/`, and four `utils/` modules,
   with view-model shaping and the past/upcoming rule hand-rolled per route. Coupling
   to `features/signup-form` is one-way at the feature layer, so the plan extracts a
   `features/events` folder (named `events`, not `dinners` — dinners are just the
   only event kind today) in Phases 3-4.
5. **Two junk drawers and substantial dead/inert code**: `utils/misc.ts`, the
   meaningless `utils`/`lib` split, three unimported shadcn primitives (~475 lines), and
   dead client-hints plumbing that costs every first-time visitor a double page load.
   Recent migration scaffolding stays, but needs an explicit review marker.
6. **Stringly-typed roles everywhere.** No `RoleName` union exists; `"moderator"`/`"admin"`
   literals appear across guards, routes, models, and templates. A typo compiles.

## Current implementation scope

`features/forms` and `features/signup-form` were implemented recently and are
intentionally **not** being structurally reorganized in this plan. The analysis keeps
their residual boundary and component findings as documented debt, but the executable
work focuses on events, authentication middleware, image lifecycle, route vocabulary,
and cleanup around those areas. The parity test and legacy comparison schema stay until
an explicit production-mileage review.

## Bugs found (fix independently of any refactor)

| Bug                                                                                                                                               | Where                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Board-member **edit** redirects to the **create** form after saving                                                                               | `app/routes/admin.board-members.$userId.edit.tsx:79`                                                                                              |
| `generateSrcSet` corrupts extension-less src (`lastIndexOf(".") === -1` → `slice(0,-1)`)                                                          | `app/features/cms/blocks/utils.ts:1-9`                                                                                                            |
| `variants.forEach(async …)` floating promises — rejections escape the `catch`                                                                     | `app/optimize-images.ts:29,48`                                                                                                                    |
| `meta` destructures `loaderData` unguarded — crashes when the loader 404s                                                                         | `app/routes/admin.dinners.$dinnerId_.signups.tsx:75`, `admin.dinners.$dinnerId.tsx:21`                                                            |
| Image rows orphan on event cover swap/delete and on failed event mutations after image persistence; staged temp files can also leak on exceptions | `prisma/schema.prisma:133-142`, `admin.dinners.new.tsx:91-109`, `admin.dinners.$dinnerId_.edit.tsx:125-159`, `utils/image-upload.server.ts:78-81` |
| Winston writes unbounded `./logs/*.log` inside the container FS, no rotation (operational risk)                                                   | `app/logger.server.ts:11-19`                                                                                                                      |
