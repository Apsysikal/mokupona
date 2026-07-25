# Route Module Harmonization — Action Plan

Companion to [`conventions.md`](./conventions.md) (the target state). Baseline: audit of all 32 route modules + `app/root.tsx` against the [React Router v8 route module docs](https://reactrouter.com/start/framework/route-module) (July 2026). The codebase is already ~90% on-convention — typegen is fully wired, all actions use `Route.ActionArgs`, auth and validation are centralized — so this is drift cleanup, not a migration. Four phases, each independently shippable; every phase ends with `npm run typecheck && npm run lint && npm run test -- --run` green.

---

## Phase 1 — Bug fixes (do first, zero risk)

- [x] [`admin.tsx:7`](../../app/routes/admin.tsx#L7) — loader is typed `Route.ActionArgs`; change to `Route.LoaderArgs` (copy-paste bug; compiles only because the shapes overlap).
- [x] [`dinners_.$dinnerId.tsx:77`](../../app/routes/dinners_.$dinnerId.tsx#L77) — `throw new Response("Forbidden", { status: 400 })` → `status: 403`, matching [`session.server.ts`](../../app/utils/session.server.ts)'s `requireUserWithRole`.

**Acceptance:** typecheck green; signing up for an unpublished dinner still errors, now with 403.

---

## Phase 2 — Type harmonization (generated types everywhere)

Replace every hand-written react-router type with the generated `Route.*` equivalents:

- [x] [`_index.tsx`](../../app/routes/_index.tsx) — the only route not using `./+types`. Drop `MetaFunction<null, {root}>` and the `RootLoaderData` import from `~/root`; use `Route.MetaFunction` and read root data via typed `matches`.
- [x] [`join.tsx:108`](../../app/routes/join.tsx#L108) — bare `MetaFunction` → `Route.MetaFunction`.
- [x] [`admin.locations.new.tsx:20`](../../app/routes/admin.locations.new.tsx#L20) — `MetaFunction<typeof loader>` → `Route.MetaFunction`.
- [x] [`admin.dinners.new.tsx:31`](../../app/routes/admin.dinners.new.tsx#L31) — `MetaFunction<typeof loader>` → `Route.MetaFunction`.
- [x] [`admin.dinners.$dinnerId_.edit.tsx:23`](../../app/routes/admin.dinners.$dinnerId_.edit.tsx#L23) — function-declaration `meta({}: Route.MetaArgs)` → arrow-const `Route.MetaFunction`.
- [x] [`root.tsx:58`](../../app/root.tsx#L58) — `LoaderFunctionArgs` → `Route.LoaderArgs` (from `./+types/root`).

**Acceptance:** `grep -rn "MetaFunction\|LoaderFunctionArgs\|ActionFunctionArgs" app/ --include="*.tsx" | grep "from \"react-router\""` returns nothing; typecheck green.

---

## Phase 3 — Component data access & export order

- [x] [`root.tsx:96`](../../app/root.tsx#L96) — nested `Document` uses `useLoaderData<typeof loader>()` while `App` uses `Route.ComponentProps`; pass loader data into `Document` as a prop instead.
- [x] [`admin._index.tsx:19`](../../app/routes/admin._index.tsx#L19) — component reads the user via `useUser()` while its loader returns `{}`; return the user from the loader and read it from `loaderData`.
- [x] Reorder exports to **loader → action → meta → component → ErrorBoundary** in the known offenders:
  - [x] [`login.tsx`](../../app/routes/login.tsx) (already conformant — loader → action → meta is the convention order; no change needed)
  - [x] [`admin.locations.new.tsx`](../../app/routes/admin.locations.new.tsx) (meta between loader and action)
  - [x] [`admin.dinners.new.tsx`](../../app/routes/admin.dinners.new.tsx) (meta between loader and action; the `@conform-to/react` import was already in place)
  - [x] [`admin.dinners.$dinnerId_.edit.tsx`](../../app/routes/admin.dinners.$dinnerId_.edit.tsx) (meta before loader)
  - [x] [`dinners_.$dinnerId.tsx`](../../app/routes/dinners_.$dinnerId.tsx) (meta before loader — missed by the original audit, same fix)
  - [x] [`admin.tsx`](../../app/routes/admin.tsx), [`dinners._index.tsx`](../../app/routes/dinners._index.tsx) (verified: no action exists, so loader → meta → component conforms; no change)

**Acceptance:** no `useLoaderData`/`useActionData`/`useParams` inside `app/routes/`; typecheck + e2e green.

---

## Phase 4 — Meta coverage & action-shape unification

- [x] Add `meta` titles to the board-members admin trio (the parallel dinners/locations/users sections all have them):
  - [x] [`admin.board-members.tsx`](../../app/routes/admin.board-members.tsx)
  - [x] [`admin.board-members.new.tsx`](../../app/routes/admin.board-members.new.tsx)
  - [x] [`admin.board-members.$userId.edit.tsx`](../../app/routes/admin.board-members.$userId.edit.tsx)
- [x] Unify the image-upload error shape. The four upload routes return `{ uploadHandlerError }` on `parseImageFormData` failure but `submission.reply()` on validation failure, forcing components to branch on `"uploadHandlerError" in lastSubmission`. Fold upload failures into the conform result so `actionData` has one shape. _Implementation note:_ when the upload handler fails there is no parsed `formData` and therefore no submission to `reply()` on (and parsing an empty `FormData` would surface spurious required-field errors), so the routes return a hand-built `SubmissionResult` — `{ status: "error", error: { cover|image: [uploadError] } }` — which renders through the same conform field-error slot as validation errors. `splitUploadActionData` and the `"uploadHandlerError" in` branches are deleted:
  - [x] [`admin.dinners.new.tsx`](../../app/routes/admin.dinners.new.tsx)
  - [x] [`admin.dinners.$dinnerId_.edit.tsx`](../../app/routes/admin.dinners.$dinnerId_.edit.tsx)
  - [x] [`admin.board-members.new.tsx`](../../app/routes/admin.board-members.new.tsx)
  - [x] [`admin.board-members.$userId.edit.tsx`](../../app/routes/admin.board-members.$userId.edit.tsx)
- [x] Decide: return validation failures with an explicit 4xx (`data(submission.reply(), { status: 400 })`) or keep the current implicit 200. Either is fine — pick one and apply it uniformly to all 10 form routes. **Decision: keep the implicit 200** — it is already uniform across all form routes, matches conform's documented usage, and avoids wrapping every `submission.reply()` in `data()`.

**Acceptance:** upload-failure path renders the error through the normal conform `getFormProps` error slot in all four routes; e2e green.

---

## Follow-up (separate decision, not part of this pass)

- **v8 middleware for admin auth** — replace the per-route `requireUserWithRole` calls under `admin.*` with a single `middleware` export on [`admin.tsx`](../../app/routes/admin.tsx) + `createContext()` user context ([docs](https://reactrouter.com/how-to/middleware)). Structural change; evaluate once the harmonization pass has landed.
- **`headers` / `handle` exports** — currently unused everywhere except `root.tsx`'s `links`. No action needed; adopt per-route only when a concrete caching/breadcrumb need appears.
