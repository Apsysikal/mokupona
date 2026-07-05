# Design Harmonization → Claude Design — Plan

Status: **⏸ HALTED at the Phase 3 boundary** (2026-07-05, by user instruction).

- **Complete:** Phase 1 ([drift-inventory.md](./drift-inventory.md)) and Phase 2 ([design-system-spec.md](./design-system-spec.md)). All output is uncommitted doc files on `dev`; **no code was changed.**
- **Not started / awaiting approval:** Phase 3 (build the preview-card bundle + sync to claude.ai/design). This is an **outward-facing publish** and was deliberately **not run** — it needs explicit user go-ahead.
- **Blocking decisions before Phase 3:** (1) approve running the external sync at all (and whether to build the bundle locally first vs. sync straight away); (2) resolve the **6 reversible design calls** in [design-system-spec.md](./design-system-spec.md) §11 (recommended defaults are provided — the user may accept all, decide each, or override).
- **To resume:** answer the §11 calls, then say whether to build the Phase 3 bundle locally or push straight to claude.ai/design.

Goal: validate and extend [design-audit.md](./design-audit.md) against the codebase, distill the findings into an opinionated design system (tokens + component canon), and publish it as a browsable Claude Design project on claude.ai/design.

## How to resume

Open Claude Code in this repo and say something like:

> Read docs/design-harmonization/plan.md and continue from the current phase.

Key fact for the next session: **Claude Design does not read the repo.** A design-system project there is a bundle of self-contained HTML preview cards (each starting with a `<!-- @dsCard group="…" -->` marker) plus spec/token docs, pushed up via the `DesignSync` tool (`list_projects` → `create_project` if needed → `finalize_plan` → `write_files`). The audit is the brief for Claude Code locally; only the distilled output gets synced. There is a `/design-sync` skill (installable via `/find-skills`) that packages the bundle conventions and render self-check — use it if available, otherwise drive DesignSync by hand.

## Phase 1 — Validate & extend the audit ✅

- [x] Re-verify the audit's file/line references against current code (audit dated 2026-07-05; lines may have drifted)
- [x] Sweep dimensions the audit does not cover:
  - [x] focus / hover / disabled / active states
  - [x] transitions & durations
  - [x] icon usage and sizing conventions (audit only counts sizes)
  - [x] form field styling (input, textarea, select, checkbox, label consistency)
  - [x] shadows & z-index layers
  - [x] breakpoint usage patterns
  - [x] dark-mode / color-scheme assumptions
- Scope: `app/components/**`, `app/routes/**`, `app/features/**`; theme lives in `app/tailwind.css`
- Output: [drift-inventory.md](./drift-inventory.md) ✅

**Key Phase 1 outcomes:** the audit predated the admin redesign, so drift is *wider* than reported —
a 6th card radius `rounded-[14px]` (8×), raw hex in the canonical Button (`#E0899A`) and avatar tints
(`#E0A87F`), 3 new eyebrow tracking values (8 total), and an admin `font-extrabold` heading voice vs
public `font-light`. One finding resolved: the `bg-gray-950/85` SaveBar is gone. Focus-ring treatment
is the single biggest cross-cutting inconsistency (4 different languages). Z-index and dark-mode are
clean. See drift-inventory Part D for the updated priority order.

## Phase 2 — Distill decisions ✅

Output: [design-system-spec.md](./design-system-spec.md) (opinionated spec + proposed `@theme` block).

- [x] Type scale: named body ramp (`--text-2xs/-body-sm/-body/-body-lg`) + display steps (`heading/title/display` 26/28/34 → 34/44/52); five leadings → two; one negative tracking (`-0.02em`)
- [x] Radius: three-tier scale (control 8 / card 16 / pill full) — kills `[7]/[9]/[10]/[14]px`
- [x] Color tokens: `--color-info` (teal), `--color-danger-text` (#E0899A + red-300/200), `--color-tan` (#E0A87F), `.glow-primary` utility, all hairlines → `--border`; `bg-gray-950/85` already resolved
- [x] Layout: one page width (`--width-page: 1040`), 3 named prose widths, one 46/54 split
- [x] Spacing: bless `.5` half-steps, round quarter-steps, tokenize structural one-offs; two density presets
- [x] Component canon: Button (+`icon-sm`), Badge (+`pill`), unified Chip, Eyebrow (2 variants/1 tracking), Card tiers, SecondaryCTA, Select→Input alignment, icon sizes
- [x] Judgment calls written explicitly: **kept two registers as variants of one system** (public `font-light` / admin `font-extrabold`, comfortable/compact density); lowercase scoped to dinner/section titles
- [x] Bonus (Phase-1-surfaced): one focus-ring recipe, three motion-duration tokens, borders-not-shadows elevation ruling

**6 reversible calls flagged for the user** (spec §11): card radius 14 vs 16 · page width 1040 vs 1080 · eyebrow tracking .2 vs .24em · keep/drop `--color-tan` · lowercase scope · delete vestigial dark-mode plumbing.

## Phase 3 — Build bundle & sync to Claude Design

- [ ] Generate self-contained preview HTML per foundation/component, each with `@dsCard` marker: tokens/colors, type ramp, spacing/radius, buttons, badges/pills, eyebrows, cards, headings, form fields
- [ ] Bundle dir suggestion: `docs/design-harmonization/ds-bundle/` (or scratchpad; must be the `localDir` of the finalize_plan)
- [ ] DesignSync: `list_projects` → pick existing or `create_project` ("mokupona design system") → `finalize_plan` → `write_files`
- [ ] Record the projectId here for future incremental re-syncs: `projectId: ______`

## Later (code convergence, separate effort)

Apply the spec back to the codebase (replace arbitrary values with tokens, adopt canon components), re-syncing the Claude Design project incrementally as components land. Priority order per the audit §6: radius → type scale → eyebrow → color tokens → layout → spacing → buttons/badges.
