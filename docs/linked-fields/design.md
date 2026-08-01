# Linked Fields — Design

**Status:** Approved direction, ready to implement
**Last updated:** 2026-08-01

A question asked of both the signer and each friend is stored as two rows that share a field key. Today the builder only helps you _create_ the second row; afterwards the two drift apart silently. This design makes the link **visible**, makes the signer side **authoritative**, and makes unlinking an explicit, reversible act.

---

## 1. Goal & scope

### Goals

- Show, in the builder, that two rows are linked — with a chain affordance and a click-through explanation, matching the discounts popover on the public dinner page.
- Keep a linked pair in step automatically: editing the signer's row updates the friend's copy.
- Let an editor **unlink** a pair at any point, after which both rows are ordinary standalone questions.
- Work as a progressive enhancement: correct data and a usable explanation with JavaScript disabled.

### Non-goals

- Per-scope wording (different labels for signer and friend). Explicitly deferred — see §11.
- Linking across anything other than the two signup scopes.
- Changing the persisted `FieldDescriptor[]` shape, the public signup form, or the CSV/roster read path.

### Decisions taken

| Question | Decision |
|---|---|
| One authoritative side, or two peers? | **Signer is authoritative.** The friend copy is display-only while linked. |
| Different copy per scope? | **No**, for now. §11 records what it would cost to add later. |
| Unlink at any time? | **Yes**, including after signups — at the cost of a split CSV column (§8). |
| Explainer component | **Native `popover` attribute**, not Radix (§6). |
| Unlink mechanism | **Conform `update` intent**, not an `onClick` (§7). |

---

## 2. What "linked" already means

Linkage is **derived from the shared field key** and is never stored as an edge. Three existing facts depend on it:

- `app/features/forms/fields/base.ts:5` — the key (`data.name`) is _"input name path, answers key, CSV column key, cross-scope merge key. IMMUTABLE once submissions exist"_.
- `app/features/forms/fields/index.ts:52-96` — `FormSchema.superRefine` enforces per-scope name uniqueness **and** cross-scope "same name ⇒ same type".
- `app/features/signup-form/read.server.ts:207-230` — a top-level field whose name also appears in `friends.itemFields` is _per-attendee_; one without a counterpart is _submission-level_ and is replicated onto every friend.

`docs/customizable-signup-form/design.md:207` states the policy: signer and friend item fields are defined independently and _"linked by sharing the same `name`"_.

**This design does not change that.** Linkage stays derived. That is what makes unlink cheap: it is a rename, not a state transition.

### What exists today

`app/components/signup-form-builder.tsx` has a one-shot copy button — `TwinTarget` (:80), `friendTwinTarget`/`signerTwinTarget` (:151-162), `showTwinButton` (:553-556), rendered at :631-653 as `form.insert.getButtonProps` with the labels "Also ask each friend" / "Also ask the signer". It copies type/label/key/options once at insert time and then lets the rows diverge freely. The chain indicator is the **inverse branch** of the same condition.

That insert payload carries a known type hole — `satisfies Record<string, unknown> as never`, flagged in `docs/app-architecture-review/analysis.md:300-305`. This work replaces that block and should close it.

---

## 3. The model

**Signer authoritative, friend mirrored.** While a pair shares a key:

- the signer's row is an ordinary editable row;
- the friend's row renders its linked properties as **display-only** controls and contributes them to the payload through hidden inputs;
- the linked properties are **`type`, `label`, `required`, `options`**. The key is the identity and is never mirrored.

Because the friend side cannot be edited while linked, drift is not corrected — it is **unrepresentable**. That is the core of the design and the reason the client mirror costs nearly nothing (§5).

```
LINKED                                    UNLINKED (after intent)
┌─ signer ─────────────┐                  ┌─ signer ─────────────┐
│ restrictions   [edit]│◀── authority     │ restrictions   [edit]│
└──────────────────────┘                  └──────────────────────┘
┌─ friends ────────────┐                  ┌─ friends ────────────┐
│ restrictions [mirror]│                  │ restrictions_2 [edit]│
└──────────────────────┘                  └──────────────────────┘
```

---

## 4. Server-side normalization — the authority

The client mirror is decoration. The invariant is enforced in **one pure function on the only path to persistence**.

`builderRowsToDescriptors` (`app/features/signup-form/builder.ts:90`) is the chokepoint: it is called from inside the Zod layer at `:74` (`SignupFormSchema.safeParse(builderRowsToDescriptors(rows))`) **and** by both route actions (`admin.dinners.new.tsx:67`, `admin.dinners.$dinnerId_.edit.tsx:114`). Normalizing there covers validation and persistence for every write path, scripted or not.

```ts
// app/features/signup-form/builder.ts

// What a shared field key ties together. The key itself is the identity, not
// a synced property; nothing scope-local may join this list.
export const LINKED_ROW_PROPS = ["type", "label", "required", "options"] as const;

/**
 * Rows sharing a field key are one question asked in two scopes — the sharing
 * read.server.ts:207 splits submission-level from per-attendee answers on.
 * Canonical side is the first occurrence in flattened order (all top-level
 * rows, then the friends list's itemFields): the same order and the same
 * first-wins reference FormSchema.superRefine already uses when it reports a
 * cross-scope type mismatch.
 *
 * Pure, and on the only path to persistence, so a form posted with JavaScript
 * disabled is stored correctly synced with zero client code.
 */
export function syncLinkedRows(rows: BuilderRow[]): BuilderRow[] {
  const canonical = new Map<string, LinkedProps>();

  const claim = <T extends BuilderItemRow>(row: T): T => {
    const first = canonical.get(row.name);
    if (first === undefined) {
      canonical.set(row.name, {
        type: row.type, label: row.label,
        required: row.required, options: row.options,
      });
      return row;
    }
    // spread, not merge: `options` is dropped when the canonical row is not a
    // select, so a mirror can never resurrect a stale option list
    return { ...row, ...first };
  };

  // lists are containers, not questions — the friends row's own name never
  // links (a top-level field colliding with it is a same-scope duplicate,
  // which FormSchema already rejects)
  const claimed = rows.map((row) =>
    row.type === "list" ? row : (claim(row as BuilderItemRow) as BuilderRow),
  );

  // second pass: every signer row has claimed before any item row mirrors
  return claimed.map((row) =>
    row.type === "list" && row.itemFields
      ? { ...row, itemFields: row.itemFields.map(claim) }
      : row,
  );
}
```

`builderRowsToDescriptors` then opens with `return syncLinkedRows(rows).map(...)`.

**Canonical rule: first occurrence in flattened scope order wins** — signer, then friends. This is not invented; `flattenIntoScopes` (`fields/index.ts:32-50`) already emits that order and `typeByName` is already built first-seen-wins, phrasing its error as `found "<first>" and "<second>"`.

**Consequence, accepted deliberately:** the cross-scope type-mismatch error becomes unreachable from the builder — legacy mismatched data is normalized to the signer's type on next save. The check stays as defence-in-depth for the public path and gets a test pinning the new behaviour.

`DEFAULT_FORM` ships four linked pairs (`name`, `vegetarian`, `student`, `restrictions`), all currently identical, so `syncLinkedRows` is a no-op on it and `builder.test.ts:13`'s exact round-trip assertion is a free regression guard.

---

## 5. The mirror, and why sync is instant

The friend row keeps D's visual — real-looking fields, not a definition list — but they are presentational:

- **visible controls carry no `name`** and are `readOnly` (text/textarea) or `aria-disabled` (select/checkbox);
- **hidden inputs carry the payload**, one per linked property, rendered from the signer row's live Conform metadata.

One rule for every field type, no per-type special-casing.

> **Use `readonly`, never `disabled`, on anything that carries a `name`.** Disabled controls are not submitted; the values would vanish from the FormData and Conform's payload would lose those fields on every save. Disabled also removes them from tab order and is announced poorly. Here the visible controls have no `name` at all, so their state is purely cosmetic and the hidden inputs do the work.

**Sync is instant and costs no extra code.** The mirror renders the signer's value rather than holding its own, and Conform already tracks input values, so typing in the signer's Label updates the mirror's display and its hidden inputs on every keystroke.

This is the one thing the two-editable-rows approach cannot have. Writing into a peer's uncontrolled input goes through `form.update()`, which bumps the peer's field `key` and remounts it — per keystroke that is a remount plus a full-form revalidation each time, and it disturbs the caret if the editor happens to be in that field. Hence the 600ms debounce such a design needs. **A display-only mirror has no caret to disturb and no controlled-input state to own, so the debounce requirement disappears with the editability that caused it.**

---

## 6. The explainer — native popover

`popover="auto"` + `popovertarget` gives, from the user agent, with no JavaScript: open/close, `Esc`, light dismiss, top-layer rendering (so it is never clipped by the row's `Collapsible`), and **implicit `aria-expanded` / `aria-details` on the invoker**.

That last item is why this beats `<details>`. Matching the discounts popover's look means hiding the disclosure marker, and a marker-less `<summary>` [loses state announcement in VoiceOver, JAWS and NVDA](https://www.scottohara.me/blog/2022/09/12/details-summary.html). The fix is a manual `aria-expanded`, which only stays correct via a scripted `onToggle` — making the accessibility of a no-JS-first design depend on JS. Native `popover` has no such problem.

```tsx
/**
 * Click-revealed explainer matching the dinner page's discounts popover
 * (event-view.tsx:104-116) but built on the native `popover` attribute rather
 * than Radix, so it works with JavaScript disabled — including the implicit
 * aria-expanded/aria-details the UA puts on a popovertarget invoker.
 *
 * A toggletip, not a tooltip: click to open, focus never moves, and the same
 * words also exist as static advance notice on the row.
 *
 * `type="button"` is load-bearing, not stylistic. ~/components/ui/button
 * renders a <button> with no default type; inside the admin <Form> that means
 * submit, and per spec a submit button silently ignores popovertarget — the
 * trigger would open nothing AND post the whole multipart form.
 */
<button type="button" popoverTarget={id} className="tt-trigger">
  how linking works
  <InfoCircledIcon aria-hidden className="size-4" />
</button>
<div id={id} popover="auto" className="w-72 rounded-2xl border bg-popover p-4 shadow-md">
  …
</div>
```

Positioning uses CSS anchor positioning inside an `@supports` block — a pure CSS branch, no feature detection shipped. Without anchor support the panel renders viewport-centred, which reads as a small dialog; acceptable on an admin-only screen.

A further benefit specific to §7: Radix portals its content to `document.body`, so a submit button inside it leaves the `<form>` element and works only because Conform's `getButtonProps` sets `form={formId}` explicitly. A native popover keeps the panel in the form tree.

---

## 7. Unlink — a Conform intent

The unlink control lives in the popover and is an **intent button**, not an `onClick`:

```tsx
<Button
  variant="destructive-outline"
  size="sm"
  {...form.update.getButtonProps({
    name: friendRow.getFieldset().name.name,
    value: nextFreeKey,          // `${key}_2`, skipping taken names
  })}
>
  <LinkBreak2Icon /> Unlink
</Button>
```

`getControlButtonProps` returns **no `type`**, so this is a real submit button. With JS, Conform intercepts and applies the rename locally — instant, no round-trip. Without JS it posts; the action returns `submission.reply()` (intent submissions carry `status: undefined` and so never reach the success branch) and the form re-renders with the rename applied.

**The elegant part: the intent changes exactly one value.** Because linkage is derived from the shared key, once the friend key becomes `restrictions_2` the chip disappears, the `readOnly` comes off, the hidden inputs stop being emitted and the visible controls take the real `name` — all of it falls out of the derivation, identically on server and client. There is no separate "enable the fields" step to keep in sync between the two modes.

Notes:

- The new key is baked into the button at render time. If a row named `restrictions_2` appears between render and click, the result is a generic duplicate-key error rather than an unlink-specific one. Narrow window; re-render recomputes it.
- With JS the popover does not self-close after the intent applies — call `hidePopover()` in the same handler. Without JS the page re-renders and the question is moot.
- Two distinct glyphs: `Link2Icon` for the linked state, `LinkBreak2Icon` on the unlink action. Never icon-only, never colour-alone (WCAG 1.4.1).

---

## 8. `lockFieldKeys`, versioning, and unlink after signups

`lockFieldKeys` is `eventHasSignups(dinnerId)` (`admin.dinners.$dinnerId_.edit.tsx:36-39,150`), and `rowLocked = lockFieldKeys && isStoredRow(row.key)` (`signup-form-builder.tsx:257`). Taken at face value it forbids unlink once a dinner has signups — which would break this design's third goal.

**It does not have to.** Investigating the write and read paths:

- `saveFormSchemaInTx` (`app/models/form.server.ts:62-81`) **forks a new `FormVersion`** when the current one has submissions, rather than mutating it. Each `FormSubmission` is pinned to its version.
- `flattenSubmission` (`read.server.ts:196-214`) reads every submission against **its own** version's descriptors.

So renaming a key does **not** orphan or destroy stored answers — old submissions keep resolving under the old key permanently.

The real cost is in `getAttendeeRosterForEvent` (`read.server.ts:120-137`): roster/CSV columns are a **union across versions with submissions, latest first**. After an unlink the export gains a second column — `restrictions` filled for everyone who signed up before, `restrictions_2` for everyone after.

That is not corruption, and for this specific operation it is arguably the honest export: two genuinely different questions were asked of two cohorts over the event's life.

**Decision:** allow unlink when `rowLocked` is true, behind a confirmation that says plainly that the export will gain a second column from this point on. Every other consequence of `lockFieldKeys` (free-text key editing, removal of stored fields) is unchanged.

> This is the one place the design deliberately relaxes an existing guard. If reviewers prefer the conservative reading, gating unlink behind `!rowLocked` is a one-line change and the rest of the design is unaffected — the popover already renders an explanatory branch for that case.

---

## 9. Progressive enhancement

**Fully functional with JavaScript disabled**, with the holes named.

Works scriptless:

- Save, and the sync — §4 runs server-side on every write.
- The explainer — §6, UA-owned.
- Unlink — §7, a real submit button.
- The chain chip, the mirror's readout and its hidden inputs — server-rendered from values that already agree, because the previous save normalized them.
- `Add field`, `Also ask each friend`, `Move up/down`, `Remove` — all existing Conform intents, all real submit buttons.

**One blocker must be fixed for that claim to be true.** `RowCard` (`signup-form-builder.tsx:344-380`) is a Radix `Collapsible` whose open state comes from React state: `isRowOpen` (:126-130) returns `!isStoredRow(rowKey)`, and `toggledRows` is `useState`. Scriptless, every **stored** row renders `data-[state=closed]:hidden` — `display:none`, with no way to open it. The builder is currently unusable without JS. Fix, in the honeypot's idiom (`honeypot-field.tsx` hides itself with an inline `<style>` precisely so it works pre-hydration), inverted:

```tsx
{/* Row bodies collapse through React state; scriptless, every stored row
    would render permanently hidden with no way to open it. Same inline-<style>
    escape hatch honeypot-field.tsx uses, inverted: no JS ⇒ everything open,
    which is also the right no-JS affordance. */}
<noscript><style>{`[data-row-body]{display:block !important}`}</style></noscript>
```

Remaining JS-only conveniences, none in this feature: the label→key auto-slug (:570-586), the `window.confirm` guards (:482-490, :202-214), and "Reset to default".

**The multipart cost, accepted knowingly.** The event form is `encType="multipart/form-data"` with a `cover` file input (`admin-event-route-form.tsx:56`). No browser repopulates a file input after a round-trip, so a scriptless editor who has staged a cover image loses that selection when they use any intent — including unlink. Bounded: `cover` is optional on the edit screen, and with JS intents never round-trip. Mitigate with a `<noscript>` note under the Cover field advising that the image be chosen last. This is pre-existing and applies equally to every intent button already in the builder.

**No `useHydrated`, no `remix-utils`.** Nothing branches on hydration; the three branches are CSS (`<noscript><style>`, the `@supports` anchor block, the cover note), matching `optimized-image.tsx:93-102`.

---

## 10. Accessibility

- **Toggletip, not tooltip.** Click-opened, focus never moves. The bubble is never referenced by `aria-describedby` — a screen reader user would otherwise hear the content before pressing the button, making the button appear to do nothing.
- **Advance notice**, static and server-rendered, present before any editing: `<p id={noteId}>Edit this question on the signer's “…” row. Changes there apply here too.</p>`, wired via `getInputProps(field, { ariaDescribedBy: noteId })`. Conform merges it with its own error id — that is what the option is for. Satisfies WCAG 3.2.2's "advised beforehand" clause with zero JS.
- **One live region** per builder, server-rendered and initially non-empty so nothing is falsely announced on load: `<p role="status" aria-live="polite" aria-atomic="true" className="sr-only">`. It states the current set of shared keys and changes only when that set changes — typing `r`, `re`, `res`… never matches until the exact full key, so it flips exactly once. Announcements fire on commit/blur, never per keystroke.
- **Focus is never moved by sync.** Only by user-initiated actions.
- **Two distinct glyphs plus text**, never colour alone (WCAG 1.4.1).
- The chain chip must **not** nest inside `CollapsibleTrigger` — `RowHeader` (:396-445) renders its `chip` slot inside a `<button>`, and a popover invoker cannot go there. Either lift the chip out of the trigger or put the affordance in the card body.
- WCAG 3.2.2 is satisfied because updating another field's value on the same page is a change of **content**, not of **context**.

---

## 11. Deferred: per-scope wording

Not needed now. Recorded because the choice is not free.

This design removes the capability: the friend row has no editable label while linked. Re-adding it later means dropping `label` from `LINKED_ROW_PROPS` on both client and server and restoring the friend-side input — a small change, but it also reopens the drift question this design closed.

Worth knowing when the request comes: `read.server.ts` already merges both scopes' answers into **one** CSV column, so a divergent label was always partly a fiction in the export. If per-scope wording becomes real, the column model likely needs revisiting too.

---

## 12. Risks

1. **Existing forms with drifted labels lose the friend wording** on the next save of anything. Audit stored `FormVersion.schema` rows before shipping, and log when `syncLinkedRows` actually changes something so the blast radius is observable.
2. **`required` propagates.** The signer's pinned `name` is hard-coded `required="on"` (:519), so a friend `name` row inherits `required: true` and can no longer be optional. Defensible — a nameless friend breaks the roster — but it is a behaviour change, not a no-op.
3. **Hidden inputs are invisible.** If the client's canonical lookup and the server's `syncLinkedRows` ever diverge, the screen shows one thing and the DB stores another with no error. The consistency test in the implementation plan exists solely for this and is the load-bearing test of the design.
4. **The unlink relaxation of `lockFieldKeys`** (§8) is a deliberate loosening of an existing guard. Flagged for review.
5. **`ui/button.tsx` has no default `type`.** Any `<Button>` inside a `<Form>` is a submit button. This breaks `popovertarget` outright and causes accidental submits generally. Worth auditing repo-wide, but **not** by changing the default — that would break every `form.*.getButtonProps` intent button in the builder.
