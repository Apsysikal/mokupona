# Linked Fields — Implementation Plan

**Status:** Not started
**Last updated:** 2026-08-01

Stages are ordered so each one lands green on its own. S1 is the correctness backstop and is worth shipping even if the rest slips.

Estimate: **~650 LOC across 5 modified and 3 new files, 2–2.5 focused days.**

---

## S1 — Server normalization (the authority)

The whole feature's correctness lives here; everything after it is presentation.

**`app/features/signup-form/builder.ts`** (+~60, 1 line changed)

- Add `LINKED_ROW_PROPS`, the `LinkedProps` type, and `syncLinkedRows` (see `design.md` §4).
- Add `linkedFieldKeys(signer, friends)` — exported so the UI derives linkage from the same rule the server enforces.
- Change `builderRowsToDescriptors` (:93) to map over `syncLinkedRows(rows)`.

**`app/features/signup-form/builder.test.ts`** (+~90)

1. Copies label/type/required/options signer → friend for a shared key.
2. A list row never participates; a top-level row named `friends` does not overwrite the list's `type`.
3. A key present only in `itemFields` is untouched.
4. Two `itemFields` sharing a key: first wins, and the per-scope duplicate error still fires.
5. `options` is **dropped**, not preserved, when the canonical row is not a select.
6. Idempotent: `syncLinkedRows(syncLinkedRows(x))` deep-equals `syncLinkedRows(x)`.
7. `builderRowsToDescriptors` emits synced descriptors — the persistence guarantee.
8. `SignupFormBuilderSchema.safeParse` now **succeeds** on rows whose signer/friend types disagree. Pins the intentional behaviour change from `design.md` §4.
9. `builder.test.ts:13` ("round-trips DEFAULT_FORM exactly") must pass **untouched** — DEFAULT_FORM's four linked pairs already agree, so any bug that mutates agreeing rows breaks it immediately.

**Exit:** `npm test -- --run` green. Data is correct from this point on, with or without any UI work.

---

## S2 — No-JS unblock

Independent of the feature, but `design.md` §9's claim is false without it.

**`app/components/signup-form-builder.tsx`**

- Add `data-row-body` to `CollapsibleContent` (:372).
- Add the `<noscript><style>` block in `SignupFormBuilder` (:168-171). Keep `data-row-body` unique to this component — the `!important` is blunt by necessity.

**Test:** in the new server-render test (S5), assert the `<noscript>` contains `[data-row-body]{display:block`, following `optimized-image.test.tsx:144-153` ("only the server render materializes noscript children — that is exactly the markup a no-JS visitor receives").

---

## S3 — The toggletip component

**`app/components/ui/toggletip.tsx`** (new, ~45) — `design.md` §6. Native `popover`, `type="button"` on the trigger, sanitised `useId` for the CSS anchor ident.

**`app/tailwind.css`** (+~14) — the `@supports (anchor-name: --a)` block.

**Test:** `renderToString` asserts the trigger is `type="button"` with `popovertarget` — the direct regression guard for the `ui/button.tsx` footgun.

---

## S4 — Chip, mirror, and unlink

The bulk. **`app/components/signup-form-builder.tsx`** (+~180 / −25).

1. **Header restructure.** `RowHeader` (:422-445) currently renders `{chip}` inside `CollapsibleTrigger`. Lift the chip row out to a sibling so it can hold a popover trigger, preserving the stacked layout:

   ```jsx
   <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
     {/* chip row is a sibling of the trigger: it holds a popover button, and
         nesting interactive content inside the trigger button is invalid */}
     <div className="flex flex-wrap items-center gap-1">{chip}</div>
     <CollapsibleTrigger className="w-full min-w-0 cursor-pointer text-left">…</CollapsibleTrigger>
   </div>
   ```

   > **This changes accessible names.** The trigger loses the chip text, and the chip button now precedes it in DOM order. `admin-form-builder.cy.ts:31` (`/dietary restrictions/i`) and `:194` (`/friends/i`) still match, but `.first()` selection becomes fragile. **The chip's accessible name must contain neither a field label nor the word "friends".** Harden `relabelDietaryToAllergies` (:30-38) to scope inside the row card.

2. **Derive linkage.** Replace `collectKeys` (:220-226) with a canonical lookup keyed by field name, first-wins, reading `type`/`label`/`required`/`options` from Conform metadata. Thread it through the existing `TwinTarget` (:80) rather than adding props — `BuilderRowView` is already 10-prop and flagged in `docs/app-architecture-review/analysis.md:298-306`. Consider moving it to context, which reduces drilling net.

3. **Chip + explainer** on both sides. Linked = the inverse branch of `showTwinButton` (:553-556). Prepend `LinkBreak2Icon` to the existing twin button for the not-yet-linked state.

4. **The mirror.** In the friend-side branch of `EditableRowView` (:534-657), when the key exists in the signer scope: visible controls lose their `name` and become `readOnly` / `aria-disabled`; hidden inputs carry `type`/`label`/`required`/`options` from the signer's live metadata. See `design.md` §5 — **`readonly`, never `disabled`, on anything carrying a `name`.**

5. **Unlink** as `form.update.getButtonProps` inside the popover (`design.md` §7), with `hidePopover()` in the same handler. Compute the next free key with a helper that skips taken names in the friend scope.

6. **`PinnedIdentityRowView`** (:510-532) needs the chip too — `DEFAULT_FORM` ships `name` in both scopes, so relabelling the signer's "Name" must visibly affect the friend's, not silently change it on save.

7. **Live region + advance notice** (`design.md` §10).

8. **Close the type hole.** Make `TwinTarget` a discriminated union on scope and branch the two `form.insert.getButtonProps` calls, deleting `satisfies Record<string, unknown> as never` (:631-653). ~15 LOC, same block this stage rewrites.

**`app/features/events/components/admin-event-form.tsx`** (+~8) — `<noscript>` note under the Cover field advising that the image be chosen last (`design.md` §9).

---

## S5 — Tests

**`app/components/signup-form-builder.test.tsx`** (new, ~130). `renderToString` on `AdminEventRouteForm` with a fabricated `defaultValue` — it takes plain props, no route-type imports. Assert on the string:

- the `<noscript>` collapse fallback is present;
- the mirror's hidden `label` input carries the **signer's** label;
- the toggletip trigger is `type="button"` with `popovertarget`;
- the mirror's visible controls have no `name` attribute;
- **the consistency guard** — parse the hidden inputs out of the rendered HTML, feed them through `SignupFormBuilderSchema`, and assert the resulting descriptors match the text the mirror displayed. This is the one test that catches the client's canonical lookup and `syncLinkedRows` drifting apart (`design.md` §12.3). **Load-bearing; do not drop it under time pressure.**

**Route-action test** (new, ~90) — the real no-JS submit, modelled on `dinner-signup-route.test.ts:44-52`. Hand-build the `FormData` a scriptless browser posts (`signupForm[5].label=Allergies`, `signupForm[6].itemFields[3].label=Dietary restrictions`), call the edit action, read back the stored version, assert both descriptors say "Allergies". No React renders. If stubbing `userContext` proves heavy, degrade to `withParsedImageForm` + `EventEditSchema` on the same `FormData` and assert on `builderRowsToDescriptors(value.signupForm)` — 90% of the value at 10% of the setup.

**`cypress/e2e/admin-form-builder.cy.ts`** (+~70):

- Relabel the signer's "Dietary restrictions"; assert the friend mirror updates with no round-trip; save; assert the public signup page shows the new label for both the signer and an added friend.
- Open the explainer; assert `cy.location("pathname")` is unchanged — proves the trigger did not submit.
- Unlink; assert the friend key is `restrictions_2`, the chip is gone, and the friend's controls are editable. Save, reload, confirm it stuck.
- After a signup exists, assert unlink is still offered and its confirmation mentions the second export column (`design.md` §8).
- Scriptless path: Cypress cannot disable JS, so `cy.request()` a hand-built multipart body at `/admin/dinners/:id/edit`, then visit the public page and assert the friend question's label. Depth is carried by the route-action test.

---

## Pre-ship checks

1. **Audit stored forms.** Run `syncLinkedRows` over every `FormVersion.schema` in a production snapshot and report which rows it would change. Risk 1 in `design.md` §12 is a real data-loss path for editors who deliberately worded the two copies differently.
2. **Add a `logger` warning** when `syncLinkedRows` actually changes something, so the blast radius stays observable after release.
3. **Confirm the §8 relaxation** — allowing unlink while `rowLocked` — with whoever owns the CSV export. Gating it behind `!rowLocked` instead is a one-line change; the popover already has the explanatory branch.
4. **Run the whole Cypress spec**, not just the new test. Every assertion in `admin-form-builder.cy.ts` touches accessible names that S4.1 perturbs.

---

## Follow-ups (not in scope)

- **Split `signup-form-builder.tsx`.** At ~950 lines after this work, on a file the architecture review already calls debt, it stops paying for itself. Suggested: `app/components/signup-form-builder/{index,row-view,row-card,editable-row,link}.tsx`.
- **Audit `ui/button.tsx`'s missing default `type`** repo-wide — but do **not** change the default, which would break every `form.*.getButtonProps` intent button in the builder. A lint rule is the safer fix.
- Add a focus ring to the discounts popover trigger (`event-view.tsx:106`), which has none.
- `docs/customizable-signup-form/design.md:207` and §10 describe the sync-nudge as the final shape. Update them once this ships.
