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

## Resolved

- **`components.json` now declares `"style": "base-vega"`.** With
  `iconLibrary: "lucide"`, an emptied `tailwind.config` and the `ui` / `lib` /
  `hooks` aliases spelled out, `shadcn add` delivers Base UI source and lucide
  icons -- verified with a throwaway `tooltip` add that pulled in no Radix
  package. See [shadcn-config.md](./shadcn-config.md).
- **`tailwindcss-animate` is gone.** The `@plugin` directive and the dependency
  were both dropped. `app/tailwind.css` imports `tw-animate-css` and
  `shadcn/tailwind.css` instead -- the two stylesheets the `base-vega` registry
  components expect -- and `shadcn` and `tw-animate-css` joined the
  devDependencies.

## House rule for `shadcn add`

- **Never re-add the 14 components in `app/components/ui/` with `--overwrite`.**
  They carry deliberate deviations from stock shadcn: `h-11` buttons at
  `text-base font-semibold`, `rounded-lg` fields, `rounded-2xl` cards, the
  `destructive-outline` variant, the `icon-sm` size. An overwrite reverts all
  of it.
- **New adds arrive in `base-vega` proportions** -- `h-9`, `text-sm`,
  `rounded-md`, plus `data-slot` attributes that only `carousel.tsx` uses today.
  Each one needs a sizing and typography pass before it sits next to the
  existing components.
- **Land the CLI output first, adjust in a second commit,** so the divergence
  from the registry stays visible in the diff.

## Flagged, not fixed

- **Icon set changed.** Base UI ships no icons, so removing every Radix package
  meant moving to lucide-react. This is a deliberate visual change, not a
  side effect of the primitive migration -- see [icons.md](./icons.md).
- **Links are styled with `buttonVariants`, not rendered through `Button`.**
  Base UI's Button always applies `role="button"`, so the shadcn docs direct
  link-shaped buttons at the `buttonVariants` helper instead -- see
  [button.md](./button.md).
