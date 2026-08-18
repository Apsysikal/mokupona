# Linked Fields — Alternatives Considered

**Status:** Record of the exploration that produced `design.md`
**Last updated:** 2026-08-01

Four directions were designed in full before the chosen one. The approved design is a synthesis of **B** (data model, progressive enhancement) and **D** (layout, chain affordance). This file records the other three and, more usefully, the constraints that killed them.

---

## Findings common to all four

These held regardless of direction and are the reason the chosen design looks the way it does.

- **Linkage is already derived from the shared field key.** Nobody proposed storing a link edge; the key _is_ the edge (`fields/base.ts:5`, `fields/index.ts:52-96`, `read.server.ts:207-230`).
- **The existing "twin" button is a one-shot copy** (`signup-form-builder.tsx:80,151-162,553-556,631-653`). After insert the rows drift freely. That drift is the actual defect behind the request.
- **`DEFAULT_FORM` already ships four linked pairs** (`name`, `vegetarian`, `student`, `restrictions`), all currently identical — so server normalization is a no-op on it and `builder.test.ts:13` is a free regression guard.
- **Sync must live server-side** in `builderRowsToDescriptors`, the one chokepoint both actions and validation pass through. Client mirroring is decoration.
- **Two structural blockers**, found by reading rather than assumed:
  1. `RowHeader` renders its `chip` slot **inside** `CollapsibleTrigger`, i.e. inside a `<button>`. A popover trigger cannot nest there.
  2. `ui/button.tsx` has **no default `type`**, so any `<Button>` inside the admin `<Form>` is a submit button — and per HTML spec a submit button silently ignores `popovertarget`.
- **The multipart tax.** The event form is `encType="multipart/form-data"` with a `cover` file input, so every no-JS intent round-trip drops a staged file selection. This is pre-existing and applies to every intent button already in the builder.

---

## A — Minimal in-row indicator (rejected early)

Chain chip in the row header, Radix popover cloned from the discounts popover, `form.update` on blur mirroring label/required/type/options. Smallest possible diff (~400 LOC, 5 files, ~1 day).

**Why not:** no unlink affordance at all — once `lockFieldKeys` is on, a pair is linked forever. It also leaves both rows editable, so it inherits every drift problem it was meant to solve and only papers over them with a blur handler. Superseded by B, which is barely larger and structurally sound.

Worth keeping from it: the argument for **not** normalizing `type` server-side, so a genuine type disagreement stays a hard error rather than being silently laundered. The approved design rejects this (§4 of `design.md`) because a display-only mirror cannot create a type mismatch through the UI — but the reasoning is sound for any design that keeps both sides editable.

---

## B — Authoritative mirror (adopted, in part)

The friend copy stops being an editable row and becomes a read-only readout of the signer's, with a hairline "elbow" in the gutter showing descent. Native `popover` explainer. ~600 LOC, 1.5–2 days.

**Adopted:** the data model, the server-authoritative sync, the native-popover reasoning, and the `<noscript><style>` fix for the builder's existing no-JS breakage. All of §4, §6 and §9 of `design.md` come from here.

**Not adopted:** the presentation. B renders the mirror as a definition list, which is honest but reads as a different kind of object from the row above it. The approved design keeps D's field-shaped controls and makes them presentational instead — visually continuous, and it makes unlink a state change rather than a layout change.

---

## C — Merged card with scope selector (rejected)

A linked pair collapses into **one** card carrying an "Asked of: ☑ the person signing up ☑ each friend they bring" fieldset. Sync becomes structurally impossible to get wrong because there is only one thing to edit. Adds an `EditorRow[]` view-model layer between builder rows and descriptors; the persisted shape is unchanged. ~900 added / 350 removed, 3–4 days.

Genuinely strong in three ways, all worth remembering:

- Ticking "Friends" needs **zero index math** — card order is canonical for both scopes.
- Pre-existing drift surfaces as an amber notice quoting the friend copy verbatim, with a one-click "use the friend copy's wording instead". Nothing is picked silently.
- The scope toggle is two native checkboxes with **no intent and no round-trip**, so it is the only design where unlink-equivalent works scriptless _and_ costs nothing.
- It retires the twin button, the `as never` type hole, one nesting level of `useFormMetadata`, and the `small` card variant.

**Why not:**

1. **Friend order stops being independent.** "Ask friends their name last" becomes unexpressible, and order-divergent stored forms get rewritten on first save behind a banner people will skim. This is the single riskiest behaviour change of any of the four.
2. **The editor stops resembling the public form.** The nested friends list was a free structural preview; a numbered summary is a weaker substitute.
3. **Per-scope wording becomes structurally impossible**, not merely absent — reversing it means unwinding the merge.
4. The `name` card is hazardous: it is pinned-signer _and_ friend-linked, and unticking Friends there strips friend names from the roster and CSV.

**Note for the record:** C was, for a while, the only design that satisfied "unlink at any point", because its scope toggle never touches the key. The versioning finding (`design.md` §8) removed that advantage — key renames after signups turn out to be safe, costing only a split CSV column. Without that finding, C would likely have won.

---

## D — Live two-way sync (adopted, in part)

Both rows stay fully editable and mirror each other as you type, debounced ~600ms. The chain names its counterpart ("Linked to Friends → Nickname"), co-highlights both cards on hover, and carries "show the friends copy" plus unlink. ~1000 LOC, 2–3 days.

**Adopted:** the visual language — field-shaped controls on both sides, the chain chip naming its counterpart, the popover as the "what is this / what can I do" surface, and the unlink action living in it. Also its instinct to reduce prop drilling by moving `TwinTarget` into context.

**Not adopted:** two editable copies. That is what forces the debounce — writing into a peer's uncontrolled input goes through `form.update()`, which remounts it, so per-keystroke sync means a remount and a full-form revalidation per keystroke and disturbs the caret if the editor is in that field. The approved design makes the friend side display-only, and the debounce requirement disappears with the editability that caused it.

Also rejected from D: Radix Popover (JS-only, and portalling puts a submit button outside the form tree), and unlink as an `onClick` (see below).

**Rejected explicitly:** a literal drawn connector line between the two cards. It needs measurement plus a `ResizeObserver` plus collapse handling, for no information a named counterpart does not already convey.

---

## Mechanisms evaluated

### Client sync

|                             | Verdict                                                                                                                                                                                                                                                                                                        |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useInputControl`           | Rejected. Simulates real DOM events by design — the echo hazard imported voluntarily — and can only control the _local_ input; the twin lives in another component instance. Also costs controlled-value state on every row, since hooks cannot be conditional and `EditableRowView` is shared by both scopes. |
| `form.update()` on blur     | Viable, and correct for any two-editable-rows design. Keeps inputs uncontrolled; loop prevention is structural because the remount fires no `change`/`blur`. Rejected here only because a display-only mirror needs no write at all.                                                                           |
| **Render the peer's value** | **Chosen.** No write, no remount, no caret to disturb, no loop. Instant sync falls out for free.                                                                                                                                                                                                               |

### Unlink

|                                 | Verdict                                                                                                                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onClick` + `form.update`       | Rejected. JS-only, for no benefit over the intent.                                                                                                                           |
| **`form.update` intent button** | **Chosen.** Real submit button, so it round-trips scriptless; intercepted locally when JS is present, so it costs nothing then. Consistent with every other builder control. |
| Scope checkbox (C's approach)   | Rejected with C. Would have avoided the key rename entirely.                                                                                                                 |

### Explainer

|                         | Verdict                                                                                                                                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Radix `Popover`         | Rejected. JS-only; portals content out of the form tree; uses the Dialog pattern, heavier than a toggletip warrants.                                                                                                             |
| `<details>`/`<summary>` | Rejected. Hiding the marker to match the discounts popover breaks state announcement in VoiceOver/JAWS/NVDA, and the `aria-expanded` fix needs a scripted `onToggle` — making a no-JS-first design's accessibility depend on JS. |
| **Native `popover`**    | **Chosen.** UA supplies open/Esc/light-dismiss and implicit `aria-expanded`/`aria-details`. Stays in the form tree.                                                                                                              |
