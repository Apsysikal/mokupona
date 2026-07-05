# mokupona Design System — Spec (Phase 2)

Opinionated distillation of [drift-inventory.md](./drift-inventory.md) into a canon: tokens, a
component canon, and the explicit judgment calls. This is the **source of truth** for Phase 3
(the Claude Design bundle) and the later code-convergence effort.

> **⏸ Status (2026-07-05): work HALTED at the Phase 3 boundary by user instruction.**
> Phases 1–2 are complete (this spec + [drift-inventory.md](./drift-inventory.md)); no code was
> changed. **Phase 3 — the outward-facing sync to claude.ai/design — was NOT run** and needs explicit
> approval. Two things gate the resume: (1) go-ahead to run the external sync (bundle-locally-first vs.
> sync-straight-away); (2) the **6 reversible design calls in §11** below (recommended defaults given).
> See [plan.md](./plan.md) for the full resume checklist.

**Brand in one line:** a dark-only "supper club" — warm near-black surfaces, a single burnt-orange
accent, one humanist sans (Open Sans) doing all the work through **size / weight / tracking / case**.
No second typeface, no light mode.

Decisions are marked **[decided]** (apply as-is) or **[call]** (a genuine judgment call — the
default given is my recommendation, but it's the user's to overturn). Everything traces back to a
drift-inventory finding.

---

## 1. Two voices, one system — the central ruling  **[call]**

The app has two typographic registers and Phase 1 confirmed they're now *shipped*, not accidental:

| | **Public** (marketing, dinners, auth) | **Admin** (dashboard, CRUD) |
|---|---|---|
| Display weight | `font-light` (300) | `font-extrabold` (800) |
| Voice | editorial, airy, lowercase flourishes | utilitarian, dense, confident |
| Cards | `rounded-2xl`, generous padding, hover-less | `rounded-[14px]`, compact, `hover:border-primary/30` |
| Motion | none | page-entrance `fade-in slide-in-from-bottom` |

**Ruling: keep two registers, but make them *deliberate variants of one system*, not two systems.**
They share every token below (color, radius scale, spacing, focus, motion primitives); they differ
only in **which display weight and density preset** they select. Concretely:

- Public uses `font-weight: display-light`; Admin uses `font-weight: display-bold`. Same px steps.
- Public uses the `comfortable` density; Admin uses `compact` density (padding/gap presets, §6).
- Everything else (radius tiers, hairline color, focus ring, eyebrow, chips, buttons) is **shared**.

This preserves the intentional contrast the designer built while killing the *incidental* drift
(different radii, different hairline opacities, different eyebrow trackings) that rode in with it.

---

## 2. Color tokens  **[decided]**

Extend `@theme` in [tailwind.css](app/tailwind.css). Every off-token color from the inventory maps
to one of these:

| New/kept token | Value | Replaces |
|---|---|---|
| `--color-info` | `oklch(75% 0.09 220)` | teal "friends" raw oklch (signup-form-builder :76,:281). Use `/0.4` border, `/0.16` bg. |
| `--color-danger-text` | `#E0899A` | Button `destructive-outline text-[#E0899A]` **and** `text-red-300/200` (signup-form-builder :517). One "readable red on dark". |
| `--color-tan` | `#E0A87F` | avatar tint hex (admin-ui :121). (Or fold into `--color-accent-light`; see call below.) |
| `--border` (existing) | `rgb(245 241 236 / 0.1)` | **all** hairlines: `border-foreground/8`, `/12`, `/[0.22]`, `white/10`, `white/20`. The theme token wins everywhere. |

**Radial glow → one utility, not scattered rgba.** The `bg-[radial-gradient(circle,rgba(237,130,94,.16/.20),transparent_70%)]`
appears 3× at 2 opacities. Define a `.glow-primary` utility once (default `.16`, a `--glow-strong`
modifier for `.20`) using the primary color, so the accent is never re-encoded as raw rgba.

**Reversible call — `#E0A87F`:** it's one of three avatar rotation tints and is genuinely close to
`--color-accent-light` (#F1B48C) but distinct. Default recommendation: **add `--color-tan`** (the
rotation reads better with a real third hue). Cheaper alternative: drop it and rotate only
`accent-light` / `fg-secondary`. → user's call.

---

## 3. Type scale  **[decided]**

Register the de-facto scales as named `--text-*` tokens with line-height baked in. Kills every
`text-[Npx]`, every `leading-[1.0x]`, and both negative trackings.

### Body ramp

| Token | px / rem | Line-height | Role | Replaces |
|---|---|---|---|---|
| `--text-2xs` | 11 / 0.6875rem | 1.4 | fine print, footer | `text-[11px]` |
| `--text-xs` (keep) | 12 | — | badges, eyebrows | — |
| `--text-sm` (keep) | 14 | — | inputs, dense UI | — |
| `--text-body-sm` | 13 / 0.8125rem | 1.5 | **workhorse** label/meta (used 11×+) | `text-[13px]` |
| `--text-body` | 15 / 0.9375rem | 1.6 | body copy, buttons | `text-[15px]` |
| `--text-body-lg` | 17 / 1.0625rem | 1.6 | lead body (md steps) | `text-[17px]`, `md:text-[19px]` folds up to lg |

### Display ramp — 3 steps + subhead, line-height & tracking baked in

| Token | base → md | Line-height | Tracking | Role | Replaces |
|---|---|---|---|---|---|
| `--text-display` | 34 → 52 | 1.06 | -0.02em | hero h1 | `text-[34px] md:text-[52px]` |
| `--text-title` | 28 → 44 | 1.1 | -0.02em | page h1 | `28/30 → 42/44` |
| `--text-heading` | 26 → 34 | 1.1 | -0.01em→**-0.02em** | section h2 | `26 → 32/34` |
| `--text-subheading` | 20 (`text-xl`) | 1.3 | normal | card/panel h3 | `text-xl` |

**Collapse rulings:**
- Five "tight" leadings (`1.06/1.08/1.1/1.12/1.15`) → **two**: `1.06` (display only) and `1.1`
  (everything else display-ish). Baked into the tokens above.
- Two body leadings (`1.75/1.8`) → **one**: `1.6` for `body`/`body-lg`, `1.5` for `body-sm`.
- Two negative trackings (`-.01 / -.02em`) → **one**: `-0.02em` for all display text (`--tracking-display`).

**Weight:** public display = `font-light` (300); admin display = `font-extrabold` (800). This is the
*only* place the two registers diverge in type (§1).

### `lowercase` brand device  **[call]**

Currently on some public headings (dinner-view, dinner-card) but not siblings (hero, dinners._index).
**Ruling: `lowercase` is a public-only flourish reserved for _recurring/editorial_ headings**
(dinner titles, section labels like "gatherings"), **not** for page-level h1s or any admin text.
Apply it consistently to that set or drop it — default: **keep, scoped to dinner/section titles.**

---

## 4. Radius  **[decided / one call]**

Collapse **six** radii (`md 6 · lg 8 · [10] · [14] · xl 12 · 2xl 16`) to a **three-tier scale**:

| Tier | Value | Utility | Applies to | Kills |
|---|---|---|---|---|
| control | 8px (`--radius`, 0.5rem) | `rounded-lg` | buttons, inputs, segmented control, small chips-as-rect | `rounded-[7px]`, `[9px]`, `[10px]` on controls |
| card | **16px** (`rounded-2xl`) | `rounded-2xl` | all content/list cards, panels, empty states | `rounded-[10px]`, **`rounded-[14px]`**, `rounded-xl` cards |
| pill | full | `rounded-full` | badges-as-pills, chips, avatars, progress | ad-hoc pills |

- Decorative one-offs stay literal: `rounded-[3px]` (text-section band), `rounded-[5px]` (checkbox) —
  these are intentional micro-details, not tiers. Leave them.
- **Reversible call — card radius 14 vs 16:** admin deliberately chose 14px, public uses 16px. I pick
  **16px** (already the public standard, a native Tailwind step, and 2px is below the just-noticeable
  threshold at these sizes). If the designer prefers the tighter admin feel, define `--radius-card: 14px`
  instead and apply it both places. Either way: **one value, both registers.**

---

## 5. Eyebrow / kicker  **[decided]**

Eight tracking values across two idioms → **one `<Eyebrow>` component, two variants, one tracking.**

```
<Eyebrow variant="tracked" tone="primary|label|faint">GATHERINGS</Eyebrow>   // uppercase, letter-spaced
<Eyebrow variant="kicker"  tone="primary|light">the next dinner</Eyebrow>    // sentence-case, no tracking
```

- **`tracked`**: `text-xs font-semibold uppercase tracking-[var(--tracking-eyebrow)]`, one value
  `--tracking-eyebrow: 0.2em` (compromise across `.16–.28`; the existing `.24em` component default is
  the fallback if the designer prefers it). `tone` sets color: `primary` / `fg-label` / `fg-faint`.
- **`kicker`**: `text-body-sm font-semibold` in `text-primary` (or `text-accent-light`), no tracking,
  no uppercase — absorbs the idiom-B spans (dinner-view :49, dinner-card :41, hero :37, auth-layout).
- `SectionDivider` keeps its hairline rule but its label becomes `<Eyebrow variant="tracked" tone="label">`.
- Admin's `.02/.04/.06em` eyebrows all collapse into `tracked` (they're the same role).

---

## 6. Spacing & density  **[decided]**

Tailwind v4 allows any 0.25 step, so "off-scale" isn't automatically wrong. Ruling by category:

- **Bless the `.5` half-steps.** `gap/px-4.5` (used 11×/10×), `p-5.5`, `gap-6.5`, `size-4.5`, etc. are
  used consistently and read as deliberate optical tuning. Keep them; they're the app's real rhythm.
- **Round the quarter-steps.** `py-3.25`, `py-2.75`, `py-3.75`, `px-3.75` (all admin) → nearest half:
  `py-3.5`, `py-2.5/3`, `px-3.5`. These are drift, not tuning.
- **Tokenize structural one-offs.** Odd wholes that are really fixed dimensions — `h-13` nav CTA,
  `h-[58px]` nav, `py-15`/`h-72.5` hero, image heights (`h-[250px] md:h-[400px]` etc.) — leave as
  literal fixed values (they're layout constants, not spacing rhythm) but **collect the recurring image
  heights** into 2–3 named tokens (§7).
- **Two density presets** back the two registers (§1):
  - `comfortable` (public): card padding `p-6`→`md:p-7`, section gaps `gap-4.5`→`gap-5.5`.
  - `compact` (admin): card padding `p-4`→`p-4.5`, row gaps `gap-3.5`.

---

## 7. Layout constants  **[decided / one call]**

- **One page width.** Collapse `1040 / 1080 / 1160` → **`--width-page: 1040px`** (the dominant, 3×).
  *(Reversible call: 1080 if a touch more room is wanted; 1040 is least-surprise.)*
- **Prose widths** → three named tokens, absorbing `760/560/520/460/420/400/340/320`:
  `--width-prose: 720px` (long text), `--width-prose-narrow: 460px` (forms, CTAs),
  `--width-prose-tight: 340px` (captions, empty-state copy).
- **One image/text split.** `44/56 · 46/54 · 47/53` → **`46 / 54`** (already in auth-layout). Express
  as a named grid template `--grid-split: 46fr 54fr` (or keep the `md:w-[46%]/[54%]` pair). The two
  reversed grid templates (`1fr_1.6fr`, `1.55fr_1fr`) round to `1fr_1.2fr` / `1.2fr_1fr`.

---

## 8. Focus, motion & elevation  **[decided]** — new in Phase 1

### Focus — one ring, everywhere
Four focus languages today (`focus:` vs `focus-visible:`, `ring-1`/`inset-ring-2`/`ring-2`,
`bg-accent`). Ruling:

- **Always `focus-visible:`** (keyboard-only) for form controls & buttons. Fix Select trigger
  (`focus:`→`focus-visible:`) and any `focus:` ring.
- **One ring recipe:** `focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring`.
  Inputs may keep the `inset-ring` flavor but standardize on **width 2** and `--ring`. Badge drops
  `ring-offset-2`.
- Menu/list items (`focus:bg-accent`) are a different, legitimate pattern (roving focus) — leave.

### Motion — three tokens
- `--duration-fast: 150ms` (default color/border transitions), `--duration-base: 250ms`
  (chevrons, small transforms — absorbs `200`), `--duration-slow: 400ms` (progress bars).
- **Add `transition-colors` to Textarea** (currently missing) and to the two border-b secondary CTAs
  (currently abrupt).
- **Extract the admin page-entrance** (`animate-in fade-in slide-in-from-bottom-1.5 duration-300`,
  copy-pasted 6×) into a shared `<PageIn>` wrapper or an `.animate-page-in` utility.
- Motion stays a **register signal**: admin animates in, public doesn't. Keep — but from one source.

### Elevation — borders, not shadows
Surfaces use **hairline borders, not shadows** (no ad-hoc card carries a shadow). Shadows are reserved
for **floating layers only** (popover/dropdown/select/tooltip/toast). Ruling: **remove `shadow-sm`
from `Card`** and `shadow-xs` from Select trigger (align to Input, which has none). Keep the
`shadow-md/lg` on portalled overlays. Z-index stays the clean two-tier `z-10` (sticky) / `z-50`
(overlay) — just name them in the token doc.

---

## 9. Component canon  **[decided]**

| Component | Ruling |
|---|---|
| **Button** | base `rounded-lg text-body font-semibold`; add size **`icon-sm` (`h-7 w-7`)** for the 4× `compactButton`; `destructive-outline` uses `--color-danger-text` (no hex); `outline` border → `--border`. |
| **Badge** | add **`pill`** variant (`rounded-full`) covering the dinner-card "next dinner" pill and admin `FilterChip`; `secondary` border → `--border` (drop `white/20`). |
| **Chip** | **one** chip primitive with `tracked`/pill shape, `active` state `border-primary/35 bg-primary/12 text-accent-light` — reconciles `section-nav` chips, `FilterChip`, and auth segmented control. |
| **Eyebrow** | §5 — one component, two variants, one tracking. |
| **Card** | two tiers (§4), no shadow (§8), hairline `--border`, `comfortable`/`compact` density (§6). Admin hover-border is a `interactive` prop, not a fork. |
| **SecondaryCTA** | extract the `border-b border-foreground/35 hover:border-foreground` link (duplicated in dinner-card + hero) into one component **with** `transition-colors`. |
| **Field family** | align **Select trigger to Input**: `h-11`, `rounded-lg`, input surface bg, `focus-visible:`, drop its shadow. Unify `<Label>` vs ad-hoc labels on one recipe (`text-body-sm text-fg-muted`, decide lowercase yes/no — default: **not** lowercase for field labels; reserve lowercase for headings). |
| **Icon** | canonical sizes: `size-4` (16, default UI), `size-[15px]`→**`size-4`** where it's just "small", keep `size-[17px]`/`[19px]` only if truly needed → prefer **`size-5` (20)** for nav/action. One `Logo` size token. Icon+label gap → `gap-1.5` (tight) / `gap-2.5` (standard); kill `gap-1.75`. |

---

## 10. Proposed `@theme` additions

Concrete diff for [tailwind.css](app/tailwind.css) `@theme` block — **proposal only; applied in the
later code-convergence effort, not now.**

```css
/* --- color --- */
--color-info: oklch(75% 0.09 220);       /* "friends" chip */
--color-danger-text: #E0899A;            /* readable red on dark (button + list remove) */
--color-tan: #E0A87F;                    /* avatar tint 3  [call: or drop] */

/* --- type: body ramp (px→rem, lh baked) --- */
--text-2xs: 0.6875rem;      --text-2xs--line-height: 1.4;   /* 11 */
--text-body-sm: 0.8125rem;  --text-body-sm--line-height: 1.5;   /* 13 */
--text-body: 0.9375rem;     --text-body--line-height: 1.6;   /* 15 */
--text-body-lg: 1.0625rem;  --text-body-lg--line-height: 1.6;   /* 17 */

/* --- type: display ramp --- */
--text-heading: 1.625rem;   --text-heading--line-height: 1.1;    /* 26 */
--text-title: 1.75rem;      --text-title--line-height: 1.1;      /* 28 */
--text-display: 2.125rem;   --text-display--line-height: 1.06;   /* 34 */
/* md steps applied via responsive utilities: heading→34, title→44, display→52 */

--tracking-display: -0.02em;
--tracking-eyebrow: 0.2em;   /* [call: .24em to match current component] */

/* --- radius (three tiers; --radius stays 0.5rem) --- */
--radius-card: 1rem;         /* 16px, all cards  [call: 0.875rem/14px] */

/* --- layout --- */
--width-page: 1040px;        /* [call: 1080px] */
--width-prose: 720px;
--width-prose-narrow: 460px;
--width-prose-tight: 340px;

/* --- motion --- */
--duration-fast: 150ms;
--duration-base: 250ms;
--duration-slow: 400ms;
```

Plus: remove `shadow-sm` from `Card`, add the `.glow-primary` utility, and delete the vestigial
`.dark`/`@custom-variant dark` (or keep + document the single-theme decision).

---

## 11. Open calls for the user  ⏸ *(outstanding — blocks Phase 3)*

Six reversible judgment calls are embedded above — collecting them here for a quick yes/no pass.
**These are unresolved as of the 2026-07-05 halt.** Each lists its recommended default `(rec.)`; the
user may accept all, decide each individually, or override.

1. **Card radius:** 16px (rec.) vs admin's 14px.
2. **Page width:** 1040px (rec., dominant) vs 1080px.
3. **Eyebrow tracking:** 0.2em compromise (rec.) vs keeping 0.24em.
4. **Avatar tint `#E0A87F`:** add `--color-tan` (rec.) vs drop it.
5. **`lowercase` device:** keep, scoped to dinner/section titles (rec.) vs drop entirely.
6. **Vestigial dark-mode plumbing:** delete (rec.) vs keep + document.

Everything else is **[decided]** and ready for the Phase 3 bundle.
