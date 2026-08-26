# shadcn config migration plan

Resolves the first flagged item in [README.md](./README.md): `components.json`
still declares `"style": "new-york"`, so `shadcn add` keeps delivering Radix
components into a Base UI codebase.

## Target style: `base-vega`

shadcn's December 2025 release replaced the single `new-york` style with a
`{library}-{style}` pair. Libraries: `radix-`, `base-`, `aria-`. Styles: `vega`,
`nova`, `maia`, `lyra`, `mira`, `luma`, `sera`, `rhea`. `default` and `new-york`
still resolve, and still serve Radix source — `/r/styles/new-york/button.json`
imports `@radix-ui/react-slot` today.

`base-vega` is the match. Vega is the continuation of the classic shadcn look;
every other style restyles the primitives themselves. Comparing the `button`
base class across the eight `base-*` styles:

| Style  | Shape / type                                    | Default size |
| ------ | ----------------------------------------------- | ------------ |
| vega   | `rounded-md`, `text-sm`, `font-medium`          | `h-9 px-2.5` |
| nova   | `rounded-lg`, `text-sm`                         | `h-8 px-2.5` |
| maia   | `rounded-4xl`                                   | `h-9 px-3`   |
| lyra   | `rounded-none`, `text-xs`                       | `h-8 px-2.5` |
| mira   | `rounded-md`, `text-xs/relaxed`                 | `h-7 px-2`   |
| luma   | `rounded-4xl`                                   | `h-9 px-3`   |
| sera   | `rounded-none`, `uppercase`, `tracking-widest`  | `h-10 px-6`  |
| rhea   | `rounded-2xl`                                   | `h-8 px-3`   |

Our components were forked from `new-york`, whose variant and size skeleton
(`default`/`destructive`/`outline`/`secondary`/`ghost`/`link`, `rounded-md`,
`text-sm`, `font-medium`) survives unchanged in vega. The shadcn Radix-to-Base
migration guide (discussion #9562) also names `base-vega` as the replacement for
`new-york`.

The style affects component class strings only. All style indexes ship
`"cssVars": {}` (verified for `base-vega`, `base-nova`, `base-maia`,
`radix-vega`), so our palette, `--radius` and font stack are untouched by the
switch.

## Step 1 — rewrite `components.json`

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "base-vega",
  "rsc": false,
  "tsx": true,
  "iconLibrary": "lucide",
  "tailwind": {
    "config": "",
    "css": "app/tailwind.css",
    "baseColor": "gray",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "~/components",
    "ui": "~/components/ui",
    "utils": "~/lib/utils",
    "lib": "~/lib",
    "hooks": "~/hooks"
  }
}
```

Four changes:

- **`style`** — `new-york` to `base-vega`.
- **`iconLibrary`** — must be set explicitly. The CLI defaults it with
  `iconLibrary ||= style === "new-york" ? "radix" : "lucide"`, so today it would
  reinstate `@radix-ui/react-icons`. Registry sources ship an `IconPlaceholder`
  import that the CLI rewrites per this field.
- **`tailwind.config`** — emptied. It currently names `tailwind.config.ts`,
  which does not exist; this project is Tailwind v4, CSS-first.
- **`aliases`** — `ui`, `lib` and `hooks` spelled out. Resolution already works
  without them (`ui` falls back to `components + "/ui"`, and
  `@/registry/base-vega/lib/utils` maps to `aliases.utils`), but `lib` and
  `hooks` gate the rewrite of every other registry `lib/` and `hooks/` import.

`baseColor: "gray"` stays. It is only read by `init` and
`migrate base-color`; with `cssVariables: true` and a bespoke palette it is inert.

## Step 2 — CSS prerequisites in `app/tailwind.css`

Base UI components from the registry depend on two upstream stylesheets and five
colour tokens we do not define. Without them, added components look wrong rather
than fail loudly — Tailwind v4 silently drops unknown variants.

**2a. Import the registry's stylesheets**, directly after the existing
`@import "tailwindcss"`:

```css
@import "tw-animate-css";
@import "shadcn/tailwind.css";
```

- `shadcn/tailwind.css` (from the `shadcn` package, currently only used via
  `npx`) defines the custom variants the components use: `data-open`,
  `data-closed`, `data-checked`, `data-unchecked`, `data-selected`,
  `data-disabled`, `data-active`, `data-horizontal`, `data-vertical`, plus the
  `no-scrollbar`, `scroll-fade-*` and `shimmer-*` utilities.
- `tw-animate-css` supplies `animate-in` / `animate-out`, `fade-in-0`,
  `zoom-in-95`, `slide-in-from-*` and `slide-out-to-*`, used by dialog, popover
  and select.

Both are declared by the `base-vega` style index (`dependencies` /
`devDependencies`), so add `tw-animate-css` and `shadcn` as devDependencies.

**2b. Drop `tailwindcss-animate`.** `@plugin "tailwindcss-animate"` and the
dependency both go; the only `animate-*` class left in the app is our own
`animate-page-in` utility. `tw-animate-css` covers the same utility names, so
this is a swap, not a removal of capability.

**2c. Add the missing tokens** to `:root` and their `@theme` mappings. Values
chosen to match what the existing components already hard-code:

| Token                    | Value                       | Matches                           |
| ------------------------ | --------------------------- | --------------------------------- |
| `--muted`                | `rgb(245 241 236 / 0.05)`   | `bg-foreground/5` (input shell, ghost/outline hover) |
| `--muted-foreground`     | `rgb(245 241 236 / 0.65)`   | `text-foreground/80`, `placeholder:text-foreground/50` |
| `--secondary`            | `var(--card)`               | Button `secondary` = `bg-card`    |
| `--secondary-foreground` | `var(--card-foreground)`    | as above                          |
| `--input`                | `var(--border)`             | Input's default border            |

Plus `--color-muted`, `--color-muted-foreground`, `--color-secondary`,
`--color-secondary-foreground` and `--color-input` in the `@theme` block.

`--chart-1..5` and the `--sidebar-*` family are not needed until a chart or
sidebar component is added.

## Step 3 — verify with a throwaway add

```
npx shadcn@latest add tooltip
```

Then check, and revert unless tooltip is actually wanted:

- the file lands at `app/components/ui/tooltip.tsx`;
- `cn` imports rewrite to `~/lib/utils`;
- the source imports `@base-ui/react/tooltip`, not `@radix-ui/*`;
- icons come from `lucide-react`;
- `npm run typecheck`, `npm run lint` and `npm run build` stay clean;
- no Radix package reappears in `package.json`.

## Step 4 — house rule for future adds

The 14 components in `app/components/ui/` stay as they are. They carry
deliberate deviations from stock shadcn (`h-11` buttons at `text-base
font-semibold`, `rounded-lg` fields, `rounded-2xl` cards, the
`destructive-outline` variant, `icon-sm` size) and re-adding them with
`--overwrite` would revert all of it.

Consequence: `shadcn add` output arrives in vega proportions (`h-9`, `text-sm`,
`rounded-md`, `data-slot` attributes) and needs a sizing and typography pass
before it sits next to our existing components. Land the CLI output first, adjust
in a second commit, so the divergence stays visible in the diff.

## Step 5 — close out the README

Update the "Flagged, not fixed" section of [README.md](./README.md): the
`components.json` item and the `tailwindcss-animate` item are both resolved here.
