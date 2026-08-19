# Radix -> Base UI migration

Whole-project migration of every Radix primitive to `@base-ui/react`, run in a
single pass rather than progressively. Reports below follow the layout the
shadcn `migrate-radix-to-base` skill produces, one per component.

| Component   | File                               | Radix parts replaced                                      |
| ----------- | ---------------------------------- | --------------------------------------------------------- |
| button      | [button.md](./button.md)           | `Slot` / `asChild`                                        |
| label       | [label.md](./label.md)             | `Label.Root`                                              |
| accordion   | [accordion.md](./accordion.md)     | `Root` / `Item` / `Header` / `Trigger` / `Content`        |
| collapsible | [collapsible.md](./collapsible.md) | `Root` / `Trigger` / `Content`                            |
| dialog      | [dialog.md](./dialog.md)           | `Overlay` / `Content` / `Title` / `Description` / `Close` |
| popover     | [popover.md](./popover.md)         | `Content` (positioning)                                   |
| icons       | [icons.md](./icons.md)             | `@radix-ui/react-icons`                                   |

`radix-ui` and `@radix-ui/react-icons` are removed from `package.json`;
`@base-ui/react@1.7.0` and `lucide-react@1.33.0` are added.

## Verification

- `npm run typecheck`, `npm run lint`, `npm run build`: clean.
- `vitest run`: 482 tests across 58 files pass.
- 37 screen states captured with Playwright before and after (public site, auth
  flows, admin area, plus open dialogs, popover, accordion and carousel
  states). Every page kept its exact dimensions; the only differing pixels sit
  inside icon glyphs.
- 906 buttons, inputs, selects, textareas and links across 20 pages compared
  attribute by attribute (`type`, `name`, `value`, `form`, `formnovalidate`,
  `disabled`, `role`) against a running `origin/dev` build: zero differences.
- Cypress could not run in the migration environment (its binary is not
  downloadable there), and it caught a regression the local checks missed --
  Base UI's injected `type="button"` disabled Conform's intent buttons. Fixed,
  covered by a unit test, and written up in [button.md](./button.md). One spec
  assertion was also updated -- see [collapsible.md](./collapsible.md).

## Flagged, not fixed

- **`components.json` still says `"style": "new-york"`.** That is a legacy,
  pre-`radix-`/`base-` style name, so the shadcn CLI will keep delivering Radix
  variants for future `shadcn add` runs. Switching the style would restyle the
  app, so the choice is left open: either move to a `base-` style deliberately,
  or keep hand-porting new components.
- **`tailwindcss-animate` is now unused.** Base UI's `data-starting-style` /
  `data-ending-style` transitions replaced its last consumers
  (`animate-in`, `fade-in-0`, `zoom-in-95`, `animate-accordion-*`). The plugin
  is still installed and still declared in `app/tailwind.css`.
- **Icon set changed.** Base UI ships no icons, so removing every Radix package
  meant moving to lucide-react. This is a deliberate visual change, not a
  side effect of the primitive migration -- see [icons.md](./icons.md).
