# mokupona design system — Claude Design bundle

Phase 3 output of the [design-harmonization plan](../plan.md). Self-contained HTML preview
cards for the claude.ai/design project; distilled from [design-system-spec.md](../design-system-spec.md)
(local copy: [spec.md](./spec.md)) with the six §11 calls **and** the round-2 native-token
harmonization (spec §12) applied, 2026-07-06.

## Governing principle

**Tailwind-native tokens only, nearest to each shipped value; no fractional steps; no custom token
where a native utility exists.** Custom values are the brand palette alone: `background` #15110E,
`card` #1B1511, `foreground` #F5F1EC, `primary` #ED825E, `accent-light` #F1B48C, `destructive`
#A71D31. The system adds zero `@theme` tokens and deletes five.

## Cards

Each card is a complete standalone HTML document whose first line is a
`<!-- @dsCard group="…" title="…" -->` marker. No external requests — CSS inline, icons as
inline SVG/data URIs. Fonts fall back from Open Sans to system sans.

| File                | Group       | Shows                                                                                                                            |
| ------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| tokens-colors.html  | Foundations | surfaces, the one foreground/15 hairline, text tiers as foreground/80·65·50·40, accent, red-300/sky-300 semantics, .glow-primary |
| type-ramp.html      | Foundations | native body ramp (text-xs→lg) + display ladder (2xl→5xl, one step up at md), tracking-tight, one font-light display weight       |
| spacing-radius.html | Foundations | rounded-lg/2xl/full tiers (+xs/sm decorative), no-fractions mapping table, density presets, max-w-5xl/2xl/md/xs                  |
| headings.html       | Foundations | one voice, two densities — the extrabold admin fork harmonized away                                                              |
| buttons.html        | Components  | text-base base, 6 variants, whole-step sizes h-12/11/9 + size-9/size-7, text-red-300 destructive-outline                         |
| badges-pills.html   | Components  | badge variants + pill variant + unified Chip, sky-300 info chip                                                                  |
| eyebrows.html       | Components  | tracked (text-xs uppercase tracking-widest) / kicker (text-sm), tones on foreground opacities                                    |
| cards.html          | Components  | rounded-2xl, comfortable vs compact+interactive, empty state, no shadow                                                          |
| form-fields.html    | Components  | input/textarea/select/checkbox family, **file-upload zone + file row**, one focus recipe, one hairline                           |

## Baked-in decisions (2026-07-06)

**Round 1 (§11):** rounded-2xl cards · max-w-5xl pages · tracking-widest eyebrows · no --color-tan ·
no lowercase device · dark plumbing kept+documented.
**Round 2 (§12):** native-only tokens, whole steps only, text-base buttons, one font-light display
weight (no admin extrabold), one foreground/15 hairline (input border merged), text tiers as
foreground opacities, red-300/sky-300 semantics, native max-w prose widths, file-upload field.

## Sync (after user review — do not sync before)

`DesignSync`: `list_projects` → `create_project` ("mokupona design system") if absent →
`finalize_plan` with this directory as `localDir` → `write_files`. Record the projectId in
[../plan.md](../plan.md) afterwards. Before syncing, refresh `spec.md` if the parent spec changed:
`cp ../design-system-spec.md spec.md`.
