# Design Harmonization → Claude Design — Plan

Status: **not started** (created 2026-07-05, from a Claude Code session)

Goal: validate and extend [design-audit.md](./design-audit.md) against the codebase, distill the findings into an opinionated design system (tokens + component canon), and publish it as a browsable Claude Design project on claude.ai/design.

## How to resume

Open Claude Code in this repo and say something like:

> Read docs/design-harmonization/plan.md and continue from the current phase.

Key fact for the next session: **Claude Design does not read the repo.** A design-system project there is a bundle of self-contained HTML preview cards (each starting with a `<!-- @dsCard group="…" -->` marker) plus spec/token docs, pushed up via the `DesignSync` tool (`list_projects` → `create_project` if needed → `finalize_plan` → `write_files`). The audit is the brief for Claude Code locally; only the distilled output gets synced. There is a `/design-sync` skill (installable via `/find-skills`) that packages the bundle conventions and render self-check — use it if available, otherwise drive DesignSync by hand.

## Phase 1 — Validate & extend the audit

- [ ] Re-verify the audit's file/line references against current code (audit dated 2026-07-05; lines may have drifted)
- [ ] Sweep dimensions the audit does not cover:
  - [ ] focus / hover / disabled / active states
  - [ ] transitions & durations
  - [ ] icon usage and sizing conventions (audit only counts sizes)
  - [ ] form field styling (input, textarea, select, checkbox, label consistency)
  - [ ] shadows & z-index layers
  - [ ] breakpoint usage patterns
  - [ ] dark-mode / color-scheme assumptions
- Scope: `app/components/**`, `app/routes/**`, `app/features/**`; theme lives in `app/tailwind.css`
- Output: `docs/design-harmonization/drift-inventory.md` (confirmed + extended findings)

## Phase 2 — Distill decisions

Turn the inventory into an opinionated spec (`docs/design-harmonization/design-system-spec.md` + proposed `@theme` changes for `app/tailwind.css`):

- [ ] Type scale: name the de-facto body scale (11/13/15/17/19px) and display steps (26/28/30/34/38 → md 32–52px); collapse the five `leading-[1.0x]` values; pick one negative tracking
- [ ] Radius: settle button radius (kill `rounded-[7px]/[9px]/[10px]`), define 2 card radius tiers
- [ ] Color tokens: teal "friends" oklch → token (e.g. `--color-info`), primary radial-glow gradient (2 opacities), `bg-gray-950/85` SaveBar, unify hairline borders on `--border`
- [ ] Layout: one content max-width (1040 vs 1080), one image/text split ratio, named prose widths
- [ ] Spacing: decide off-grid half-steps (4.5–9.5, 13, 18.5…) — bless as tokens or round to scale
- [ ] Component canon: Button (+`icon-sm` size), Badge (+pill variant), Eyebrow/Kicker component (2 variants, color prop, one tracking value), Card tiers, shared secondary-CTA (border-b)
- [ ] Write down the judgment calls explicitly: admin vs. public typographic voice; lowercase-headings brand device — where it applies

## Phase 3 — Build bundle & sync to Claude Design

- [ ] Generate self-contained preview HTML per foundation/component, each with `@dsCard` marker: tokens/colors, type ramp, spacing/radius, buttons, badges/pills, eyebrows, cards, headings, form fields
- [ ] Bundle dir suggestion: `docs/design-harmonization/ds-bundle/` (or scratchpad; must be the `localDir` of the finalize_plan)
- [ ] DesignSync: `list_projects` → pick existing or `create_project` ("mokupona design system") → `finalize_plan` → `write_files`
- [ ] Record the projectId here for future incremental re-syncs: `projectId: ______`

## Later (code convergence, separate effort)

Apply the spec back to the codebase (replace arbitrary values with tokens, adopt canon components), re-syncing the Claude Design project incrementally as components land. Priority order per the audit §6: radius → type scale → eyebrow → color tokens → layout → spacing → buttons/badges.
