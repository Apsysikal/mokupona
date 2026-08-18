# mokupona design system — Claude Design bundle

Self-contained HTML preview cards for the claude.ai/design project **"mokupona design
system"** (`projectId: 3208dbb3-75a3-424b-80b0-a1f2a78606aa`).

Two rounds built this directory:

1. **Phase 3 of the [design-harmonization plan](../plan.md)** (2026-07-06) — nine
   foundation and primitive cards distilled from
   [design-system-spec.md](../design-system-spec.md) (local copy: [spec.md](./spec.md)),
   with the six §11 calls and the round-2 native-token harmonization (§12) applied.
2. **Component extraction** (2026-08-18) — 34 further cards covering every component that
   ships in `app/`, read straight out of the code rather than derived from the spec. The
   full mapping lives in [../component-inventory.md](../component-inventory.md).

## Browsing

`index.html` is the gallery: every card, grouped, each entry naming the source files it
was extracted from. Open it directly, or let the Claude Design pane build the same
grouping from each card's first-line `<!-- @dsCard group="…" title="…" -->` marker.

| Group          | Cards | Covers                                                                    |
| -------------- | ----- | ------------------------------------------------------------------------- |
| Overview       | 1     | the index                                                                 |
| Foundations    | 7     | colour, type, spacing/radius, headings, motion & effects, icons, page shell |
| Primitives     | 12    | `app/components/ui` — button through table, plus avatar, chips, segments   |
| Forms          | 4     | field anatomy, the public signup form, the list field, the form builder    |
| Navigation     | 5     | site nav, admin tabs, section nav, footer, links & dividers                |
| Content blocks | 3     | hero, text section, images & media                                         |
| Events         | 3     | event cards, event facts, dinner detail layout                             |
| Admin          | 5     | page header, list rows, overview, empty states, form shell                 |
| Account & auth | 4     | auth shell, notices & status, Google sign-in, account cards                |

## Editing

Nine cards are **hand-written** — `tokens-colors`, `type-ramp`, `spacing-radius`,
`headings`, `buttons`, `badges-pills`, `eyebrows`, `cards`, `form-fields`. Edit those files
directly.

The other 34 plus `index.html` are **generated**. Do not edit them in place; edit the body
fragment in [`../bundle-src/cards/`](../bundle-src/cards/) — or the shared stylesheet in
`../bundle-src/base.css` — and rebuild:

```
node docs/design-harmonization/bundle-src/build.mjs
```

Each fragment starts with a one-line JSON meta comment (`group`, `title`, `file`,
`sources`, `note`); the build inlines the stylesheet, writes the `@dsCard` marker, and
regenerates the index. Adding a card means adding a fragment — nothing else. Hand-written
cards are listed in `MANUAL_CARDS` in `build.mjs` so the index can still link them.

## Constraints every card honours

- One standalone HTML document, no external requests — CSS inline, icons as inline SVG.
- Fonts fall back from Open Sans to the system sans; no webfont is fetched.
- Dark surfaces only, on the shipped palette: `background` #15110E, `card` #1B1511,
  `foreground` #F5F1EC, `primary` #ED825E, `accent-light` #F1B48C, `destructive` #A71D31.
- Every card names its source files, so a card and its implementation stay findable from
  one another.

## Sync

`DesignSync`: `finalize_plan` with this directory as `localDir` and the existing
`projectId` → `write_files` with the changed paths. Refresh `spec.md` from the parent spec
first if it has changed (`cp ../design-system-spec.md spec.md`).
