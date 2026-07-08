# Fallow Audit — Assessment (2026-07-08)

Ran `npx fallow` (v3.2.0) over the repo. It bundles three analyses: **dead-code**
(unused files/exports/deps + structure), **dupes** (clone detection), and
**health** (complexity, churn hotspots, coverage gaps, refactor targets).

Top-line metrics it reports:

- Dead files **4.1%** (8 of 195) · dead exports **6.5%** (30 of 462)
- Maintainability Index **92.0** ("good") · 17,135 LOC · avg cyclomatic **1.7**, p90 **3**
- **0** churn hotspots over the last 6 months
- 5 "refactoring targets", 31 clone groups, 87 untested files (36.5% file coverage)

**Overall verdict:** the codebase is healthy. Complexity is low, there are no
genuine churn hotspots, and the MI is high. Most findings are small, low-risk
hygiene items. The value here is a cleanup pass, **not** a structural problem to
fix. Below, every finding is triaged as **Act / Consider / Ignore (false
positive)** with the reasoning and verification I did.

Legend: ✅ verified correct · ⚠️ correct but nuanced · ❌ false positive (keep as-is)

---

## 1. Unused files (8)

| File | Verdict | Notes |
|---|---|---|
| `app/routes/privacy.mdx` | ❌ **False positive — keep** | This is a **live route**. It's linked from `footer.tsx`, `site-nav.tsx`, `join.tsx`, `dinners_.$dinnerId.tsx` via `<Link to="/privacy">` and registered by `flatRoutes()`. Fallow's entry-point detection doesn't treat `.mdx` files as routes, so it looks unreachable. **Do not delete.** |
| `prisma/migrations/.../data-migration.ts` | ❌ **False positive — keep** | One-shot migration script, intentionally never imported. Deleting it would erase migration history. |
| `app/components/ui/tooltip.tsx` | ⚠️ **Consider removing** | shadcn/ui primitive, 0 imports. 100% dead. |
| `app/components/ui/dropdown-menu.tsx` | ⚠️ **Consider removing** | shadcn/ui primitive, 0 imports. |
| `app/components/ui/select.tsx` | ⚠️ **Consider removing** | shadcn/ui primitive, 0 imports. Note: the app has its own `SelectField` in `forms.tsx`, so this Radix wrapper is genuinely unused. |
| `app/components/arrow.tsx` | ✅ **Act — remove** | 0 imports, app-specific component (not a reusable primitive). |
| `app/components/illustrations.tsx` | ✅ **Act — remove** | 0 imports, contains a 165-line SVG component. |
| `app/hooks/useClientHints.tsx` | ✅ **Act — remove** | 0 imports. Pairs with the dead `client-hints.server.ts` exports below (see §2). |

**Recommendation:** remove `arrow.tsx`, `illustrations.tsx`, `useClientHints.tsx`
outright. For the three shadcn primitives (`tooltip`, `dropdown-menu`, `select`),
decide as a policy question: keep the vendored shadcn set intact for future use,
or prune to what's actually rendered. I lean toward pruning — they're trivially
re-addable via the shadcn CLI.

---

## 2. Unused exports (26) & type exports (4)

These are exports **no other module imports**. The file itself may still be alive;
the fix is usually "delete the export" or "drop the `export` keyword", not "delete
the file".

### 2a. Legacy auth helpers — ✅ Act (relevant to the auth rework)

`app/utils/session.server.ts`: `sessionStorage`, `getSession`, `getUser`,
`requireUser` are all unused. Verified: the codebase uses `getUserId`,
`requireUserId`, `requireUserWithRole`, `getUserWithRole`, `createUserSession`
instead. These four are **superseded leftovers from the auth rework** — safe to
delete, and doing so tightens the auth surface. This is the single most useful
dead-code finding.

### 2b. Client-hints stack — ✅ Act (remove together)

`app/utils/client-hints.server.ts`: `getTimezoneOffset`, `getTimezone`,
`getLocale` are unused (only `getClientHints` is imported, by `root.tsx` and two
dinner routes). Combined with the dead `useClientHints.tsx` hook (§1), the
timezone/locale portion of client-hints was never wired up. Remove the three
functions; keep `getClientHints`.

### 2c. `misc.ts` remix boilerplate — ✅ Act

`useMatchesData`, `useUser`, `dateFormatBuilder` — classic Remix-stack starter
helpers, 0 usages. Safe to delete.

### 2d. `toastSessionStorage` — ⚠️ Nuance (demote, don't delete)

`app/utils/toast.server.ts:21` is flagged, but it **is** used inside the same
file (lines 53–55). It's only unused as a *public export*. Fix = drop the
`export` keyword, not delete the binding. Auto-fix would get this wrong — handle
manually.

### 2e. CMS block schemas — ⚠️ Consider (dropped-CMS remnants)

`HeroBlockDataSchema`, `ImageBlockDataSchema`, `TextSectionBlockDataSchema`. The
block **views** are live (`_index.tsx` imports `HeroBlockView`, `ImageBlockView`,
`TextSectionBlockView` and their *types*), but the zod **data schemas** were never
wired to validate anything — remnants of the incomplete/dropped CMS. Safe to
remove, but if CMS work resumes they're intended scaffolding. **Ask before
touching** given the CMS history.

### 2f. shadcn variant/sub-component exports — ⚠️ Consider

`badgeVariants`, `CardFooter`, `PopoverAnchor`, `TableCaption`, `TableFooter`.
Standard shadcn sub-exports, unused. Same policy call as the dead shadcn files —
prune or keep the vendored set whole. Low value either way.

### 2g. Genuinely dead domain/model exports — ✅ Act

- `app/models/event.server.ts:31 getEvents` — unused query.
- `app/models/user.server.ts:122 deleteUserByEmail` — unused (note: cypress uses its own delete helper).
- `app/features/forms/fields/non-list.ts:47 NON_LIST_FIELD_TYPES_COMPLETE` — unused.
- `app/components/admin-ui.tsx:121 avatarInitials` — unused.

### 2h. Forms barrel re-exports — ⚠️ Consider (barrel hygiene)

`app/features/forms/fields/index.ts` re-exports `NonListFieldDescriptorSchema`,
`ListFieldSchema`, `FieldDescriptorSchema`, `NonListFieldType`,
`ListFieldDescriptor`, `FieldType` that nothing consumes (fallow's #3 refactor
target: "50% dead"). The barrel over-exports. Trimming it to the ~half that's
actually imported is reasonable, but this is a public-API-shaping decision — low
urgency. `FormVersion` type in `form.server.ts` is similarly unused **but** the
data-access-layer design doc explicitly says model files should re-export entity
types like `FormVersion` for consumers — so **keep that one** per the DAL
convention (❌ for `FormVersion`).

---

## 3. Dependencies

| Item | Fallow says | Verdict |
|---|---|---|
| `@rollup/rollup-linux-x64-gnu` | unused optionalDependency | ❌ **Keep.** Platform-specific native rollup binary for the Linux Docker/CI build. Never imported by design. Removing it risks breaking the container build. |
| `@remix-run/lazy-file` | unused dependency | ✅ **Act — remove from `dependencies`.** 0 direct imports, and it's already pulled in transitively by `@remix-run/file-storage`. Safe to drop the direct entry. |
| `binode` | unused devDependency | ✅ **Act — remove.** 0 references anywhere. |
| `tsconfig-paths` | unused devDependency | ✅ **Act — remove.** Only appears in package.json/lockfile, never imported. |
| `@eslint/js` | unused devDependency | ✅ **Act — remove.** `eslint.config.js` does not import it (verified). |
| `msw`, `tailwindcss`, `@tailwindcss/typography` | "dev deps used in production" → move to `dependencies` | ❌ **Ignore.** `msw` is used only by `mocks/` (local/e2e), and tailwind + typography are build-time (`app/tailwind.css` `@import`/`@plugin`, `vite.config.ts`). Keeping them as devDependencies is the correct, conventional placement. Fallow flags them because it treats the build/mocks entry points as "production". |
| `@mdx-js/rollup`, `prisma` | "test-only production deps" → move to devDependencies | ⚠️ **Ignore/borderline.** `@mdx-js/rollup` powers the `privacy.mdx` route build and `prisma` is the runtime client/CLI — both legitimately belong in `dependencies`. Fallow under-counts their prod usage (same `.mdx` blind spot as §1). Leave as-is. |

**Net actionable:** remove 4 packages (`@remix-run/lazy-file`, `binode`,
`tsconfig-paths`, `@eslint/js`). Ignore the "move between dep sections"
suggestions — they fight standard conventions and rest on entry-point
misclassification.

---

## 4. Structure — duplicate exports (5)

Same export name in two files. These are **not bugs**, just ambiguity risks for
barrel resolution:

- `Address` in `address.server.ts` ↔ `event.server.ts`
- `CheckboxField` / `SelectField` / `TextareaField` in `components/forms.tsx` ↔ the `features/forms/fields/*/view.tsx` equivalents
- `InputProps` in `ui/input.tsx` ↔ `ui/textarea.tsx`

The forms trio is the interesting one: `components/forms.tsx` and the newer
`features/forms/fields/*` both define field components with the same names. This
looks like a **half-finished migration** from the flat `forms.tsx` to the
per-field `features/forms/fields/` structure. Worth confirming which is canonical
and collapsing to one — see §6. The others (`Address`, `InputProps`) are benign
name collisions; leave them.

---

## 5. Duplication (31 clone groups, 6 families)

Verified the top clones are real copy-paste, not coincidental:

| Family | Lines | Verdict |
|---|---|---|
| `admin.board-members.new` ↔ `.$userId.edit` | 74 across 2 groups | ✅ **Act.** Verified identical `parseImageFormData` + error-folding + form-render blocks copied verbatim. Extract a shared action helper + form component. Highest-value dedup. |
| `join.tsx` ↔ `login.tsx` | 98 across 5 groups | ✅ **Act.** Auth pages share layout/field/error scaffolding. Good extraction candidate — and it dovetails with the auth rework. |
| `admin.dinners.new` ↔ `.$dinnerId_.edit` | 21 | ⚠️ **Consider.** new/edit pair, same pattern as board-members. |
| `admin.locations.new` ↔ `.$locationId_.edit` | 17 | ⚠️ **Consider.** Same new/edit pattern. |
| `root.tsx` ↔ `dinners_.$dinnerId.tsx` | 28 | ⚠️ **Consider.** Likely shared meta/error-boundary boilerplate. |
| cypress e2e specs (uploads, form-builder, signup) | ~124 total | ⚠️ **Consider (low priority).** Test setup duplication. Extract cypress support helpers when convenient; test dupes are lower risk. |

**Theme:** the dominant duplication is the **new/edit route pair** pattern
repeated across board-members, dinners, and locations. One shared "entity form
route" abstraction (or at least shared action + form component per entity) would
collapse most of it. That's the one structural refactor worth planning.

---

## 6. Health — complexity & hotspots

- **No churn hotspots** in 6 months, MI 92 — nothing is on fire.
- **CRITICAL-flagged functions** (verify before acting; CRAP scores are estimated
  from export refs, not real coverage):
  - `signup-form-builder.tsx` — `BuilderRowView` (16 cyclomatic, 113 LOC) and
    `EditableRowView` (15 cyclo, 126 LOC). This is the most complex component in
    the app. Real complexity, but it's an interactive form builder — inherently
    branchy. Refactor only if it's actively causing bugs.
  - `dinners_.$dinnerId.tsx:52 action` (13 cyclo, 107 LOC) — signup action. Worth
    a look; high branch count in a user-facing mutation.
  - `admin.dinners.$dinnerId_.edit.tsx:75 action` (11 cyclo, 88 LOC) and the
    board-members actions — overlap with the duplication in §5; dedup would also
    cut complexity.
- **Large functions:** the biggest offenders are **test files** (cypress specs
  at 175–235 lines, `parity.test.ts` 171). These are `it()` blocks — long but not
  complex. Low priority.
- **Coverage gaps:** 36.5% file coverage, 87 untested files. Most are presentational
  components (cards, layouts, icons). Not alarming for this kind of app, but the
  untested **actions/loaders** (mutations) are the ones worth targeting if we want
  test ROI — not the view components.

**CRAP scores are estimates.** For real numbers run
`fallow health --coverage <coverage-final.json>` (we already have
`@vitest/coverage-v8` wired). Worth doing before treating any complexity number as
authoritative.

---

## 7. Suggested action tiers

**Tier 1 — safe cleanup (do now, low risk):**
1. Remove legacy auth exports from `session.server.ts` (`sessionStorage`,
   `getSession`, `getUser`, `requireUser`). *(auth-rework aligned)*
2. Remove client-hints trio + `useClientHints.tsx` hook.
3. Remove `misc.ts` dead helpers (`useUser`, `useMatchesData`, `dateFormatBuilder`).
4. Remove dead files `arrow.tsx`, `illustrations.tsx`.
5. Remove dead model exports (`getEvents`, `deleteUserByEmail`,
   `NON_LIST_FIELD_TYPES_COMPLETE`, `avatarInitials`).
6. Drop 4 unused deps (`@remix-run/lazy-file`, `binode`, `tsconfig-paths`,
   `@eslint/js`).
7. Demote `toastSessionStorage` export to a plain `const` (do **not** auto-fix).

**Tier 2 — decisions needed (discuss first):**
8. shadcn primitive prune vs. keep-whole (`tooltip`, `dropdown-menu`, `select`,
   + variant sub-exports).
9. CMS block schema removal (dropped-CMS remnants — confirm CMS is truly parked).
10. Forms barrel trim + resolve the `forms.tsx` vs `features/forms/fields/*`
    duplicate-component situation (§4). Likely a half-done migration.

**Tier 3 — refactor (plan as its own effort):**
11. Collapse the **new/edit route duplication** across board-members / dinners /
    locations into a shared entity-form pattern (§5). Biggest structural win;
    also reduces the action-complexity hotspots.
12. Extract shared auth-page scaffolding from `join.tsx`/`login.tsx` — fold into
    the auth rework.
13. (Optional) cypress support-helper extraction for test dupes.

**Do not touch (false positives):** `privacy.mdx`, the prisma data-migration
script, `@rollup/rollup-linux-x64-gnu`, the `FormVersion` re-export, and the
dep-section "move" suggestions.

---

## 8. Caveats about fallow itself

- **`.mdx` route blindness** is its biggest miss here — it drives the `privacy.mdx`
  false positive and under-counts `@mdx-js/rollup`. Any fs-routes `.mdx` page will
  look dead.
- **Optional/platform deps** (`@rollup/rollup-linux-x64-gnu`) always read as
  unused — expected, ignore.
- **CRAP/coverage numbers are estimated** unless fed a real coverage file.
- **`--fix` / auto-fix** is safe for pure dead exports but would mishandle the
  `toastSessionStorage`-style "used internally, unused externally" case. Prefer
  manual edits for anything in Tier 1 beyond trivial removals, or run
  `fallow fix --dry-run` first and review.

Next step: pick the tiers you want and I'll turn Tier 1 (+ any greenlit Tier 2/3)
into an implementation plan.
