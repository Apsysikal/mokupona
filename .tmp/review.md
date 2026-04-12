# Review: `feat/cms-work-2` — issues #361 / #363

Scope of this review: every change on `feat/cms-work-2` relative to `main`, with emphasis on
the three commits that implement issue #363 on top of the already-merged #362 slice:

- `98f5333` refactor: project public pages from snapshots
- `3ade535` feat: add cms page service seam
- `26458d4` feat: add admin pages materialization flow

plus the earlier #362 work that is now the foundation (`b351ebf`, `49b5aa3`).

The review compares the delivered code against the parent PRD (#361) and the #363 ticket,
and against the repo's existing conventions (conform + Zod, models/\* seam, route layout,
tests).

---

## 1. Alignment with #361 and #363

### 1.1 #363 acceptance criteria — all met in spirit

| Acceptance criterion                                                                             | Status | Where                                                                    |
| ------------------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------ |
| Admin can open Pages, navigate to `home`, see default-backed status                              | ✅     | `admin.pages._index.tsx`, `admin.pages.$pageKey.tsx`, `formatPageStatus` |
| Editing/saving title + description materializes on first write and bumps revision on next writes | ✅     | `page-store.server.ts` `writePage` create/update branches                |
| Public page loader/metadata reflect the persisted title/description                              | ✅     | `_index.tsx`, `cypress/e2e/admin-pages.cy.ts`                            |

The end-to-end flow clears the bar for #363. Where the implementation deviates from #361
is around the architectural seams it is supposed to leave open for the next slices. Those
gaps are captured in §1.2 and §2.

### 1.2 Alignment with #361 — gaps and drift

These are PRD-level concerns that the #363 implementation does not yet violate, but whose
current shape will block (or force rework) the next slices.

#### G1. No block identity preservation across saves

**Finding.** On every successful write, `page-store.server.ts` unconditionally calls
`pageBlock.deleteMany({ where: { pageId } })` followed by `pageBlock.createMany(...)`. This
is done even for a pure page-meta update that never touched the block collection.

Every save therefore:

- throws away all existing `PageBlock.id` values,
- generates fresh `cuid()` ids for the same semantic blocks,
- generates unnecessary SQL churn.

**Why it matters.** #361 is explicit: "successful mutations persist the fully normalized
page snapshot while preserving existing block ids for unchanged blocks" and "commands target
blocks through a `Block Ref` abstraction that works the same before and after first
persistence." Once block-level commands land, stable persisted block ids are the only way to
reference a block by id rather than by position/definitionKey. Rewriting ids on every save
breaks that contract before it is even wired up.

**How to improve.**

- Separate a dedicated `updatePageMeta` store operation that only touches `Page` columns
  and does not re-write blocks at all. (The `set-page-meta` command should not cause block
  writes.)
- For block-writing commands, diff the incoming snapshot against persisted rows. Match
  on `definitionKey` where present, otherwise on `position`. `upsert` rows that match,
  `create` rows that are new, `delete` rows that disappeared. The round-trip test is: save
  a page twice with no block changes and assert all `PageBlock.id` values are unchanged.

#### G2. Conflict path is an untyped exception, not an explicit concurrency state

**Finding.** `page-service.server.ts:225` reacts to a `writeResult.status === "conflict"`
from the store by throwing `new Error("Page revision conflict")`. The route action never
catches it, so a concurrent save surfaces as a generic 500 error boundary.

**Why it matters.** #361 user story 21 is: "I want stale writes to be rejected when another
admin changed the page first, so that I do not unknowingly overwrite someone else's
changes." The PRD also says mutations should return diagnostics that admin UI can render.
A thrown error cannot be keyed by diagnostic code, cannot be re-rendered into the editor,
and can't show the opponent's current revision. Progress note "optimistic update behavior
exists in the store contract" is accurate, but the service erases the information before
routes see it.

**How to improve.** Make `applyPageCommand` return a discriminated result:

```ts
type ApplyPageCommandResult =
  | {
      status: "saved";
      materialization: "created" | "updated";
      editorModel: EditorModel;
    }
  | {
      status: "conflict";
      currentEditorModel: EditorModel;
      diagnostics: Diagnostic[];
    };
```

The route action then re-reads and re-renders the editor with a `page/revision-conflict`
diagnostic that the UI can turn into a banner/toast. Add a vitest test that drives the
conflict branch (memory store already supports it) and a cypress test that races two
writes if feasible.

#### G3. `Diagnostic` is a placeholder that duplicates `PageStatus.kind`

**Finding.** `page-service.server.ts:10` defines exactly two diagnostic variants:
`page/default-backed` and `page/persisted`. Both literally mirror
`ResolvedPage.status.kind`. Nothing in the codebase reads them except tests that assert
their shape.

**Why it matters.** #361 asks for a real "CMS-wide diagnostic code namespace with
prefixes by concern," used by banners, toasts, and tests. The current shape is valid
as a placeholder but risks calcifying. In particular, consumers might start switching
on `diagnostics[0].code` to decide "is the page persisted" rather than on the canonical
`status.kind`, creating two sources of truth for the same thing.

**How to improve.**

- Keep the `Diagnostic` type, but delete the two placeholder variants and start the
  namespace fresh when real diagnostics appear (validation issues, migration events,
  conflict signals, materialization, image cleanup).
- Document the prefix taxonomy in `UBIQUITOUS_LANGUAGE.md` (`page/*`, `block/*`,
  `migration/*`, `media/*`, `command/*`) so every new code picks the right bucket.
- Callers must read page state from `status.kind`/`snapshot.provenance`, never from
  `diagnostics`.

#### G4. Provenance is stored in three places

**Finding.** The same fact ("is this default or persisted?") lives in at least three fields
per read:

- `PageSnapshot.provenance` (`"default" | "persisted"`)
- `PageStatus.kind` (`"default-backed" | "persisted"`)
- `PageStatus.provenance` (`"default" | "persisted"` — same enum as (1) but different
  variant spelling)
- one of two hard-coded `Diagnostic.code` values

**Why it matters.** Three copies will drift; two of them use different spellings
(`default` vs `default-backed`). When a fourth caller asks "is this page materialized"
people will reach for whichever field is closest and code will split across all three.
The PRD wants one canonical model (`Page Snapshot`) and caller-specific projections off of
it, not three parallel facts.

**How to improve.** Make `PageSnapshot.provenance` the single source of truth. Derive
`status` in the service with something like:

```ts
const status =
  snapshot.provenance === "persisted"
    ? { kind: "persisted", revision: persisted.revision }
    : { kind: "default-backed", revision: null };
```

Drop `PageStatus.provenance`. Drop the placeholder diagnostics (see G3). Export a
`formatPageStatus(status)` helper from the service module (see also §2.1).

#### G5. Reads bypass block migration / block validation entirely

**Finding.** `page-store.server.ts:160` `deserializeBlock` trusts `block.type` as one of
the enum members via an unchecked cast and trusts `block.data` via `JSON.parse` with no
Zod validation. If a persisted block's type is later removed from the registry, rendering
will throw in `getBlockDefinition(blockType)`. If a block's data schema evolves, renders
will silently pass malformed payloads to the block view.

**Why it matters.** This is exactly the case PRD §"Unsupported Block" / "Broken Block" /
"Safe Recovery" is written to handle. The current code silently loses all three states.
Cruicially: it's fine for #363 because we persist only what we just read from defaults —
no schema drift exists yet. It becomes a data-loss bug the first time a block schema
changes in a release.

**How to improve.** Plan the next slice around:

- Tagging read outcomes per block: `SupportedBlock | UnsupportedBlock | BrokenBlock`.
- Running each block's stepwise migrations before renderer dispatch.
- `PublicPageRenderer` omitting non-supported blocks and the public projection falling back
  to defaults when page invariants are violated.
- Admin still seeing the broken/unsupported block as an error card.

This does not have to land in #363 but must be flagged as the next architectural seam.

---

## 2. Repo conventions / code quality

### 2.1 `formatPageStatus` is copy-pasted between two routes

**Where.**

- `app/routes/admin.pages._index.tsx:58`
- `app/routes/admin.pages.$pageKey.tsx:129`

Both files declare their own `formatPageStatus` with a locally retyped parameter
`{ kind: "default-backed" | "persisted"; revision: number | null }` — they do **not** import
`PageStatus` from `page-service.server.ts`.

**Why it matters.** Two copies of the same function that share a hand-rolled subset of
`PageStatus`. If `PageStatus` gains a third `kind` (e.g. `broken`, `recovered`), both
formatters must be updated and the retyped parameter will silently accept the new kind as
`never` or block the build. Violates DRY and weakens the type link to the canonical model.

**How to improve.** Export `formatPageStatus` (and the `PageStatus` type) from
`app/features/cms/page-service.server.ts` (or a colocated `page-status.ts`) and import it
in both routes.

### 2.2 Admin editor form abandons the conform pattern used by every other admin route

**Where.** `app/routes/admin.pages.$pageKey.tsx`.

All comparable edit routes (`admin.locations.$locationId_.edit.tsx`,
`admin.dinners.new.tsx`, `admin.users.$userId_.edit.tsx`, etc.) use the repo-wide pattern:

```ts
const lastResult = useActionData<typeof action>();
const [form, fields] = useForm({
  lastResult,
  shouldValidate: "onBlur",
  constraint: getZodConstraint(Schema),
  onValidate({ formData }) {
    return parseWithZod(formData, { schema: Schema });
  },
});
```

with `getFormProps(form)`, `getInputProps(fields.title, ...)`, and `errors={fields.title.errors}`.

The new page editor instead:

- does not call `useActionData` at all,
- does not use `useForm`,
- does not render validation errors back to the user (the action returns
  `submission.reply()` but nothing is plumbed to the UI),
- passes raw props to `<Field>` instead of `getInputProps(fields.X, { type: "text" })`,
- hard-codes `action={`/admin/pages/${editorModel.pageKey}`}` on `<Form>` even though
  posting to the current route is the default.

The `progress.txt` handoff explains this as a deliberate decision to fix the default-backed
save path. The actual bug was different: the hidden `revision` input was submitting an
empty string that `parseWithZod` coerced to `undefined`. The correct fix is to make
`revision` optional in the schema (which was also done). Dropping conform was unnecessary
and drifts this route away from the rest of the codebase.

**Why it matters.**

- Users hitting the title/description `min(1)` validation branch see nothing — action
  returns the submission reply, route ignores it.
- Future field-level errors, client-side validation, and accessibility affordances all
  silently go missing on this route.
- New contributors reading admin routes will see one form shape that doesn't match any
  other.

**How to improve.** Put this route back on the conform pattern:

```ts
const actionData = useActionData<typeof action>();
const [form, fields] = useForm({
  lastResult: actionData,
  shouldValidate: "onBlur",
  constraint: getZodConstraint(PageMetaSchema),
  defaultValue: {
    title: editorModel.pageSnapshot.title,
    description: editorModel.pageSnapshot.description,
    revision:
      editorModel.status.revision === null
        ? ""
        : String(editorModel.status.revision),
  },
  onValidate({ formData }) {
    return parseWithZod(formData, { schema: PageMetaSchema });
  },
});
```

and wire `<Field>` / `<TextareaField>` with `getInputProps(fields.X, { type: "text" })`
and `errors={fields.X.errors}`. Remove the redundant `action={...}` on `<Form>`.

### 2.3 `PageMetaSchema.revision` is a stringly-typed footgun

**Where.** `admin.pages.$pageKey.tsx:17`.

```ts
revision: z.string().regex(/^\d*$/, "Invalid revision").optional();
```

then in `action`:

```ts
const baseRevision = submission.value.revision
  ? Number(submission.value.revision)
  : null;
```

Problems:

- `revision: "0"` is truthy in JS, so this path happens to work — but only by accident.
  The moment revision `0` becomes a real value (it isn't in the store today), the reader
  would think `"0"` meant "no revision".
- The regex allows the empty string but the action still turns empty string into `null`,
  duplicating "optional" across schema and action.
- The output of `parseWithZod` is a `string | undefined` that the action then has to
  reinterpret. The shape in the service is `Revision | null`, not a string.

**How to improve.** Parse to a number in the schema and keep the action dumb:

```ts
const PageMetaSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().min(1, "Description is required"),
  revision: z
    .preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      z.coerce.number().int().nonnegative(),
    )
    .optional(),
});

// action:
const baseRevision = submission.value.revision ?? null;
```

### 2.4 Routes mix two CMS entry points (service + catalog)

**Where.**

- `_index.tsx:11-16` calls `siteCmsPageService.readPage("home")` and then
  `siteCmsCatalog.projectPublic(page.pageSnapshot, ...)` directly.
- `admin.pages.$pageKey.tsx:120-126` calls `siteCmsCatalog.listPageKeys()` to validate the
  URL param, even though it already depends on `siteCmsPageService`.

**Why it matters.** #361 calls for a "centralized CMS read path." Routes importing both the
service **and** the catalog mean there are two de-facto entry points to the CMS, and any
future refactor (e.g. the read path growing migrations / diagnostics) has to be wired
through both. It also duplicates the truth about "what pages exist" across service and
catalog.

**How to improve.**

- Add `siteCmsPageService.readPublicProjection(pageKey, context)` that resolves the
  snapshot and projects it in one call. `_index.tsx` then imports the service only.
- Add `siteCmsPageService.isKnownPageKey(key)` (or move `requireKnownPageKey` into the
  service), so `admin.pages.$pageKey.tsx` no longer imports the catalog directly.
- Non-block routes should not need to know about the catalog at all.

### 2.5 `readResolvedPage` + store already does the read inside `applyPageCommand`

**Where.** `page-service.server.ts:212-222`.

The command flow is:

1. `readResolvedPage(command.pageKey)` — one read of `Page`+`PageBlock`s
2. `pageStore.writePage({ ... })` — transaction opens, does a second `findUnique` on `Page`,
   does the write, then `requirePersistedPage` issues a third `findUnique` with blocks to
   build the return payload.

So one save does three reads. The service also reads `blocks` outside the transaction and
then feeds them back into the write, which is a TOCTOU: if a second writer races between
the outer read and the transaction, the second writer's blocks are clobbered by the first
writer's stale snapshot without a revision conflict being raised (because the command is
`set-page-meta`, which should not need to touch blocks at all).

**Why it matters.**

- Correctness: the command targets page meta, yet the service touches blocks in the write
  plan. A concurrent block edit loses.
- Performance: three reads per write are not critical for SQLite at this scale but they're
  the wrong seam to multiply as more commands land.
- Seam: PRD says commands should be "pure snapshot transforms applied to the truthful
  snapshot." The current implementation hand-codes the projection (title/description)
  into the write path instead of applying a transform and then writing the result.

**How to improve.**

- Push the read into the transaction. `page-store.server.ts` already reads inside
  the tx; build the return payload from there and stop pre-reading the blocks in the
  service.
- Make `set-page-meta` a meta-only write: do not pass `blocks` into `writePage` at all.
- For the pure-transform seam, the service should apply each `PageCommand` against the
  snapshot in memory (e.g. `applySetPageMeta(snapshot, command)`) and then ask the store
  to persist "this page, these blocks" — with the store dispatching to the meta-only or
  block-aware write plan depending on what changed.

### 2.6 Duplicate `DefinitionKey` type

**Where.**

- `app/features/cms/catalog.ts:7` `export type DefinitionKey = string`
- `app/features/cms/blocks/types.ts:3` `export type DefinitionKey = string`

**Why it matters.** Two exported types with the same name and meaning invite a future
renaming or strengthening to land on only one of them. Today they are identical.

**How to improve.** Delete one (probably `blocks/types.ts`'s copy) and import the other
where needed.

### 2.7 Over-cloning in the read path

**Where.**

- `catalog.ts:258` `cloneBlocks` deep-clones defaults on every `readPageSnapshot` and again
  inside `projectPublic`.
- `page-service.server.ts:178` clones again when building the persisted snapshot.

A public read currently does:

1. service clones persisted rows (or defaults, inside the catalog) into a snapshot,
2. `projectPublic` clones the snapshot blocks again,
3. route passes the clone to React.

That's one trust boundary (store → service) of real value, plus two redundant clones.

**Why it matters.** Correctness is fine, but `structuredClone` is not free, and it
normalizes "every layer defends itself" as the culture. Once block data starts including
real images, metadata, and resolved render models, this tax grows.

**How to improve.** Clone once at the trust boundary (catalog defaults → snapshot, or
store rows → snapshot). Downstream consumers (`projectPublic`, service) can trust the
snapshot as frozen. Mark `PageSnapshot` and `PublicProjection` as readonly in the types
to advertise that.

Also: `cloneBlocks(blocks)` in `catalog.ts:258` does `structuredClone([...blocks])` — the
spread is redundant, `structuredClone(blocks)` suffices.

### 2.8 `<main>` lives inside `PublicPageRenderer`

**Where.** `public-page-renderer.tsx:15`.

Currently only the home route uses `PublicPageRenderer`, and `root.tsx` does not wrap
`<Outlet />` in a `<main>`, so this renders one valid `<main>`. However, #361 explicitly
calls for "admin previews reuse the same public renderer with thin admin chrome." The
admin editor route already renders its own `<main>` at `admin.pages.$pageKey.tsx:72`.
Reusing `PublicPageRenderer` inside the admin editor will nest `<main>` inside `<main>`,
which is invalid HTML.

**How to improve.** Move `<main>` out of `PublicPageRenderer` and into the route (`_index.tsx`).
The renderer becomes a fragment of block elements. Admin previews can wrap it in a `<div>`.

### 2.9 Redundant `?revision=` query param on redirect

**Where.** `admin.pages.$pageKey.tsx:55-57`.

```ts
return redirect(
  `/admin/pages/${pageKey}?revision=${result.editorModel.status.revision}`,
);
```

Nothing reads the `revision` search param; the loader re-fetches the editor model and the
UI shows the revision from there. The param is dead code.

**How to improve.** `return redirect(`/admin/pages/${pageKey}`);` — or, better, return the
fresh `editorModel` directly from the action so conform's `lastResult` can show the
success state without a full redirect.

### 2.10 Vitest tests couple to real site content

**Where.** `page-service.server.test.ts:79-99` asserts
`title === "moku pona"`, `description === "A dinner society in Zurich, ..."`, etc.

**Why it matters.** Any copy tweak to `homePageDefinition` will break these tests even
though nothing about the page service behavior changed. `catalog.test.ts` already uses
clean stub blocks/pages; the service tests should do the same so they assert service
semantics (materialize, read, list, conflict) instead of page copy.

**How to improve.** Build a tiny test catalog with stub block definitions (or reuse the
helper from `catalog.test.ts`) and drive the page service tests through that. Keep one
smoke test that wires the service to the real `siteCmsCatalog` to assert integration.

### 2.11 Conflict branch has no tests

**Where.** `page-service.server.ts:224-226` and `page-store.server.ts:61-66, 94-106`.

The in-memory store in `page-service.server.test.ts` supports the conflict branch and the
Prisma store has two conflict branches (stale `revision`, P2002 race), yet no vitest test
exercises any of them. There is also no cypress test that simulates concurrent writes.

**Why it matters.** Conflict is a PRD-level behavior (user story 21). Shipping it
untested means the next refactor can trivially regress it and no CI signal will catch it.

**How to improve.** Add three vitest cases:

- `applyPageCommand` returns a `conflict` result (not a thrown error — after G2 fix) when
  `baseRevision` does not match the persisted revision.
- `applyPageCommand` returns `conflict` when two first-writes race (memory store with
  injected pre-existing row).
- `applyPageCommand` with a correct revision succeeds after a prior failed conflict.

### 2.12 `EditablePageSummary.diagnostics` is dead data

**Where.** `admin.pages._index.tsx` consumes `pages` but never reads `diagnostics`. The
field is populated but never rendered.

**How to improve.** Drop `diagnostics` from `EditablePageSummary` until the list UI has a
real use for it (e.g. a warning badge on pages with broken blocks), or add a small badge
now that renders the single diagnostic code.

### 2.13 `admin.pages.tsx` is a bare `<Outlet />` with a duplicated meta title

**Where.** `admin.pages.tsx`.

The layout wrapper sets `{ title: "Admin - Pages" }`, which is identical to the
`admin.pages._index.tsx` meta. React Router's child meta will override it anyway. And the
layout adds no layout chrome that the parent `admin.tsx` isn't already providing.

**How to improve.** Either delete `admin.pages.tsx` entirely (React Router supports index
routes without a layout file) or make it do something useful (e.g. a back link to
`/admin`, or a shared header). Don't leave an empty wrapper.

### 2.14 `PageBlock.@@index([pageId, position])` is redundant with the unique index

**Where.** `prisma/schema.prisma:144-145`.

```prisma
@@index([pageId, position])
@@unique([pageId, position])
```

A unique constraint already creates an index on the same columns. Keeping both adds
storage and write overhead without query benefit.

**How to improve.** Drop `@@index([pageId, position])` and regenerate the migration, or
live with it as documentation but know it's redundant.

### 2.15 `JSON.parse(block.data)` returns `any` (silent contract break)

**Where.** `page-store.server.ts:170`.

Even without full runtime migrations (G5), the store should validate block data against
the block definition's Zod schema at read time and fall through to a `BrokenBlock` shape
on failure. Today, a malformed row silently reaches React and crashes under render.

**How to improve.** Pass the catalog into the store (or do validation one layer up in the
service) and run `definition.schema.safeParse(block.data)` per row. Failed parses become
`BrokenBlock` with a diagnostic; unknown types become `UnsupportedBlock`. Even a minimal
version of this belongs in the next slice — it's what makes the registry a load-bearing
trust boundary.

### 2.16 `BlockType` is a hand-rolled union in `blocks/types.ts`

**Where.** `blocks/types.ts:1` `export type BlockType = "hero" | "text-section" | "image";`

This union must be updated every time a block is added, in addition to `site-catalog.ts`.
The `defineBlockDefinition` helper then requires each block type to be a member of this
union. That makes the block "registry" only half a registry — adding a new block requires
touching shared types.

**How to improve.** Let `BlockType` be `string` at the type level and enforce uniqueness
and membership at runtime inside `createCmsCatalog` (already done via `createUniqueMap`).
If you want compile-time exhaustiveness, derive the union from a const tuple:

```ts
export const BLOCK_TYPES = ["hero", "text-section", "image"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];
```

but only if something actually needs a closed union.

### 2.17 Typo-prone duplication: `toEditorModel` / `toEditablePageSummary`

**Where.** `page-service.server.ts:107-139`.

Both helpers exist inside the closure, each takes the same object shape, and neither does
any transformation beyond re-picking fields. They add indirection without value.

**How to improve.** Inline them. The whole factory is <50 lines smaller without them.

### 2.18 Cypress fixture teardown is double-bagged

**Where.** `cypress/e2e/admin-pages.cy.ts:4-11`.

Both `beforeEach` and `afterEach` run `delete-page` for the `home` page key. That's
harmless but one of the two is enough. Prefer `afterEach` (it also cleans up after the last
test in the file) and only keep `beforeEach` if there is a real reason to clean before.

### 2.19 `.tmp/progress.txt` is tracked in git

**Where.** `.tmp/progress.txt` is a committed file; `.tmp` is not in `.gitignore`.

**Why it matters.** This review file (per the task) is being written to the same folder.
If the intent is a scratch folder that stays out of the repo, add `/.tmp/` to `.gitignore`
and move `progress.txt` somewhere else (or delete it once the slice is merged). If the
intent is to keep handoff notes in-tree, consider a real location like `docs/cms/` with a
clear naming convention instead of a hidden `.tmp/`.

---

## 3. Smaller notes

These are minor but worth folding into the same cleanup pass.

- **N1.** `catalog.ts:258` — `structuredClone([...blocks])` should be `structuredClone(blocks)`.
- **N2.** `catalog.ts:12-15` `MetaTag.content: string | URL` — React Router's meta descriptor
  `content` is typed as `string`; URL happens to stringify at runtime but the wider type
  couples `catalog.ts` to a fuzzy guarantee. Call `.toString()` inside `projectPublic` when
  building the meta array.
- **N3.** `admin.pages._index.tsx` links to a bare `pageKey` anchor (`<Link to={page.pageKey}>`).
  The adjacent "Edit" button links to the same path. Either make the list row itself
  clickable and drop the dedicated button, or make the text label non-interactive and keep
  only the button. Two clickable targets pointing at the same URL is a small a11y smell.
- **N4.** `admin.pages._index.tsx:41` `text-gray-300` for the page title is low-contrast
  against the dark background; all other admin lists use the default foreground color.
  Match the surrounding list style.
- **N5.** `page-service.server.ts:225` thrown error reads `"Page revision conflict"` — no
  code prefix, no page key. Once G2 is fixed this error goes away, but if it survives the
  refactor, at least include `pageKey` and a diagnostic code so logs can route it.
- **N6.** `site-page-service.server.ts` builds the Prisma store every module import with no
  way to override it. That's consistent with the rest of the repo (`db.server.ts` singleton)
  but worth noting if testing ever needs an injection seam.
- **N7.** The `admin.pages.$pageKey.tsx` editor does not set `autoFocus` on the title field
  or label the form with an accessible name. Other admin edit routes also miss these, so
  not a regression — just a drive-by opportunity.
- **N8.** `public-page-renderer.tsx:17-22` derives a fallback React key from
  `${pageKey}:${type}:${index}`. The `index` makes the key position-sensitive, so reordering
  blocks will remount them rather than letting React reconcile. For MVP rendering this is
  fine, but once move-up/move-down lands (#361 user story 9), prefer a stable block id
  (persisted block id, or a generated one for default-backed blocks).
- **N9.** Tests cover "clone isolation" in both `catalog.test.ts` and
  `public-page-renderer.test.tsx`. If the over-cloning is removed (§2.7), these tests need
  to be rewritten to assert "the snapshot is frozen" instead of "mutating it is safe."

---

## 4. Summary — what I'd do before the next slice

In rough priority order:

1. **Fix conflict reporting (G2).** Return a discriminated result from `applyPageCommand`
   and plumb it through the action. Add vitest coverage for the conflict branch.
2. **Stop rewriting blocks on meta-only saves (G1).** Split store write plans; `set-page-meta`
   must not touch `PageBlock` rows. Add a test that asserts `PageBlock.id` is stable across
   meta saves.
3. **Put the admin editor back on the conform pattern (§2.2).** No other admin form shape
   in the repo; drift here will cost future contributors.
4. **Collapse the provenance duplication (G4).** One enum, one source of truth. Export
   `PageStatus` and `formatPageStatus` from the service module and delete the route-local
   copies (§2.1).
5. **Make routes depend on the service only, not on the catalog (§2.4).** Add
   `readPublicProjection` and `isKnownPageKey` (or `listPageKeys`) on the service.
6. **Start treating persisted blocks as untrusted (§2.15, G5).** Even a minimal per-block
   schema guard returns dignified diagnostics instead of runtime crashes, and it's the
   beachhead for unsupported/broken block handling in the next slice.
7. **Clean up the small stuff.** Dead redirect param (§2.9), duplicate `DefinitionKey`
   (§2.6), redundant Prisma index (§2.14), empty `admin.pages.tsx` wrapper (§2.13),
   `.tmp/` tracking (§2.19).
