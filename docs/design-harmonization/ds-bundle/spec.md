# mokupona Design System — Spec (Phase 2)

Opinionated distillation of [drift-inventory.md](./drift-inventory.md) into a canon: tokens, a
component canon, and the explicit judgment calls. This is the **source of truth** for Phase 3
(the Claude Design bundle) and the later code-convergence effort.

> **✅ Status (2026-07-06): all 6 §11 calls RESOLVED, plus a round-2 native-token harmonization
> (§12) ruled by the user on bundle review.** Phase 3 flow: build-locally → review → sync.
> The governing principle is now explicit: **Tailwind-native tokens only, nearest to each shipped
> value; no fractional steps; no custom token where a native utility exists.** Custom values are
> reserved for the brand palette (surfaces + accent pair + destructive) alone.
> See [plan.md](./plan.md) for current phase state.

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

**Ruling (revised in round 2): one voice, two densities.** The registers share *all* typography —
including display weight. The shipped admin `font-extrabold` headings (admin-ui.tsx:26,
admin-dinner-form.tsx:154, me.tsx:29) do **not** become a system rule; they converge onto the
public `font-light`. What remains register-specific:

- Public uses the `comfortable` density; Admin uses `compact` density (padding/gap presets, §6).
- Admin keeps its page-entrance motion; public stays static (§8).
- Everything else — type (weight included), radius, hairline, focus ring, eyebrow, chips, buttons —
  is **shared**.

**User ruling 2026-07-06:** weight is not a register signal. `font-light` for display sizes,
`font-semibold` for row-level titles and emphasis, in both registers.

---

## 2. Color tokens  **[decided — revised round 2: native + subtractive]**

Round 2 inverted the approach: instead of *adding* tokens, express everything possible in native
Tailwind colors and opacity steps, and *delete* custom tokens. Custom stays only for the brand:
`background` #15110E, `card` #1B1511, `foreground` #F5F1EC, `primary` #ED825E, `accent-light`
#F1B48C, `destructive` #A71D31.

| Was | Becomes | Notes |
|---|---|---|
| `--color-info` (new oklch) | **native `sky-300`** | "friends" chip: `border-sky-300/40 bg-sky-300/15 text-sky-300` |
| `--color-danger-text` #E0899A | **native `red-300`** | nearest native; signup-form-builder :517 already uses `text-red-300` — button.tsx:16's hex joins it |
| `--border` fg/0.1 **and** `--input` fg/0.16 | **one hairline: `foreground/15`** | merged (user: keep the brighter), nearest native opacity step; absorbs /8, /12, /[0.22], white/10, white/20 |
| `--color-fg-secondary` #C9C2BB | **`foreground/80`** | composited over the background these opacity |
| `--color-fg-muted` #A79E95 | **`foreground/65`** | steps match the shipped hexes to within |
| `--color-fg-label` #8A817A | **`foreground/50`** | a few RGB points — one source color, |
| `--color-fg-faint` #6B635B | **`foreground/40`** | native non-fractional opacities |
| ~~`--color-tan`~~ #E0A87F | dropped (call #4) | avatars rotate `accent-light` / `foreground/80` |

**Rule of thumb:** saturated deep colors (`destructive`, `primary`) are **surfaces**; `*-300`
native shades are **text on dark** (`red-300` errors/destructive text, `sky-300` info).

**Radial glow → one `.glow-primary` utility** at native opacities: default `primary/15`, strong
`primary/20` (was raw rgba at .16/.20).

**All transparency values use native steps** (multiples of 5): /[0.22]→/20, /12→/10, /16→/15,
/0.04→/5. No arbitrary bracket opacities.

---

## 3. Type scale  **[decided — revised round 2: all native, zero custom tokens]**

The custom `--text-*` ramp is gone. Every role maps to the nearest native `text-*` utility with its
**built-in line-height**. Kills every `text-[Npx]`, every `leading-[1.0x]`, both negative trackings —
and the six token candidates from round 1.

### Body ramp

| Utility | px | Role | Absorbs |
|---|---|---|---|
| `text-xs` | 12 | fine print, badges, eyebrows | `text-[11px]` |
| `text-sm` | 14 | labels, meta, inputs, dense UI | `text-[13px]` (the 11×+ workhorse) |
| `text-base` | 16 | body copy, **buttons** | `text-[15px]` |
| `text-lg` | 18 | lead body | `text-[17px]`, `md:text-[19px]` |

### Display ramp — one native step up at md, roles stay distinct

| Utility | px | Role | Absorbs |
|---|---|---|---|
| `text-xl` | 20 | card/panel h3 (subheading) | `text-xl` (unchanged) |
| `text-2xl → md:text-3xl` | 24 → 30 | section h2 | `26 → 32/34` |
| `text-3xl → md:text-4xl` | 30 → 36 | page h1 | `28/30 → 42/44` |
| `text-4xl → md:text-5xl` | 36 → 48 | hero h1 | `text-[34px] md:text-[52px]` |

**Collapse rulings:**
- Line-heights: the utilities' **built-in** values (text-5xl is already leading-none); all five
  custom tight leadings and both body leadings are deleted.
- Tracking: one native value — **`tracking-tight`** (−0.025em) on display text; absorbs −.01/−.02em.
- The md ladder steps exactly one native size per role, keeping the three display roles distinct at
  every breakpoint (title md rounds down to 4xl rather than colliding with display at 5xl).

**Weight (round-2 ruling, §1):** `font-light` (300) for the display family in **both** registers —
admin `font-extrabold` converges. `font-semibold` (600) is body-level emphasis, also shared. Weight
is not a register signal.

### `lowercase` brand device  **[RESOLVED: drop entirely]**

Was on some public headings (dinner-view, dinner-card) but not siblings (hero, dinners._index).
**User decision (2026-07-06): drop the `lowercase` device everywhere.** Headings render as typed.
Remove the `lowercase` class from dinner titles and section labels in the convergence pass; field
labels were never lowercase and stay that way (§9).

---

## 4. Radius  **[decided — card radius resolved: 16px]**

Collapse **six** radii (`md 6 · lg 8 · [10] · [14] · xl 12 · 2xl 16`) to a **three-tier scale**:

| Tier | Value | Utility | Applies to | Kills |
|---|---|---|---|---|
| control | 8px (`--radius`, 0.5rem) | `rounded-lg` | buttons, inputs, segmented control, small chips-as-rect | `rounded-[7px]`, `[9px]`, `[10px]` on controls |
| card | **16px** (`rounded-2xl`) | `rounded-2xl` | all content/list cards, panels, empty states | `rounded-[10px]`, **`rounded-[14px]`**, `rounded-xl` cards |
| pill | full | `rounded-full` | badges-as-pills, chips, avatars, progress | ad-hoc pills |

- Decorative one-offs go native too (round 2): `rounded-[3px]` (text-section band) → **`rounded-xs`**,
  `rounded-[5px]` (checkbox) → **`rounded-sm`**. No bracket radii anywhere.
- **Resolved call — card radius (2026-07-06): 16px.** Admin's deliberate 14px yields to the public
  16px standard (native Tailwind `rounded-2xl`; the 2px delta is below the just-noticeable threshold).
  **One value, both registers** — no `--radius-card` token needed, `rounded-2xl` is the utility.

---

## 5. Eyebrow / kicker  **[decided — tracking resolved: native `tracking-widest`]**

Eight tracking values across two idioms → **one `<Eyebrow>` component, two variants, one tracking.**

```
<Eyebrow variant="tracked" tone="primary|label|faint">GATHERINGS</Eyebrow>   // uppercase, letter-spaced
<Eyebrow variant="kicker"  tone="primary|light">the next dinner</Eyebrow>    // sentence-case, no tracking
```

- **`tracked`**: `text-xs font-semibold uppercase tracking-widest` — **RESOLVED (2026-07-06): the
  native Tailwind `tracking-widest` (0.1em)**, chosen over a custom `--tracking-eyebrow` token.
  Noticeably tighter than the shipped `.16–.28em` spread — a deliberate reset to the native scale,
  not a compromise value. No new token. `tone` sets color: `primary` / `foreground/50` / `foreground/40`.
- **`kicker`**: `text-sm font-semibold` in `text-primary` (or `text-accent-light`), no tracking,
  no uppercase — absorbs the idiom-B spans (dinner-view :49, dinner-card :41, hero :37, auth-layout).
- Tones map to the opacity tiers (§2): `label` = `text-foreground/50`, `faint` = `text-foreground/40`.
- `SectionDivider` keeps its hairline rule but its label becomes `<Eyebrow variant="tracked" tone="label">`.
- Admin's `.02/.04/.06em` eyebrows all collapse into `tracked` (they're the same role).

---

## 6. Spacing & density  **[decided — revised round 2: whole steps only]**

Round 2 overturns the round-1 "bless the half-steps" ruling. **No fractional steps anywhere** —
halves round **down**, quarters round to nearest:

| Shipped | Becomes | Notes |
|---|---|---|
| `gap-3.5`, `py-3.25/3.75`, `py-2.75` | `gap-3` / `py-3` | compact admin rhythm |
| `gap/px-4.5`, `size-4.5` | `gap-4` / `px-4` / `size-4` | rounding down keeps icons on the size-4 canon |
| `p-5.5`, `gap-5.5` | `p-5` / `gap-5` | |
| `gap-6.5` | `gap-6` | |
| `h-9.5` (sm button) | `h-9` | matches the shadcn sm convention |
| `h-13` nav CTA, `h-[58px]` nav | `h-12` / `h-14` | structural one-offs also go native |
| `py-15`, `h-72.5` hero | `py-14` / `h-72` | |
| `h-[250px] md:h-[400px]` images | `h-64 md:h-96` | no image-height tokens needed |

- **Two density presets** back the two registers (§1):
  - `comfortable` (public): card padding `p-6`→`md:p-7`, gaps `gap-4`→`md:gap-5`.
  - `compact` (admin): card padding `p-4`, row gaps `gap-3`.

---

## 7. Layout constants  **[decided — revised round 2: native max-w scale, no width tokens]**

- **One page width.** Collapse `1040 / 1080 / 1160` → **`max-w-5xl` (1024px), RESOLVED 2026-07-06.**
  The native Tailwind step, chosen over a custom `--width-page` token; 16px narrower than the
  dominant 1040 (imperceptible). No new token.
- **Prose widths** → three native `max-w-*` steps, absorbing `760/560/520/460/420/400/340/320`:
  **`max-w-2xl`** (672px, long text), **`max-w-md`** (448px, forms/CTAs),
  **`max-w-xs`** (320px, captions, empty-state copy). The round-1 `--width-prose*` tokens are dropped.
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

### Motion — three native duration utilities (round 2: no tokens)
- **`duration-150`** (default color/border transitions), **`duration-300`** (chevrons, small
  transforms — absorbs 200/250/300), **`duration-500`** (progress bars — absorbs 400). All native
  steps; the round-1 `--duration-*` tokens are dropped.
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
| **Button** | base `rounded-lg text-base font-semibold` (round 2: 16px native, was `text-[15px]`); sizes whole steps only — `default h-11 px-6` · `sm h-9 px-4 text-sm` (was h-9.5 px-4.5) · `lg h-12` · `icon size-9` · new **`icon-sm size-7`** for the 4× `compactButton`; `destructive-outline` text → native **`text-red-300`** (no hex); `outline` border → `border-foreground/20` (was /[0.22]). |
| **Badge** | add **`pill`** variant (`rounded-full`) covering the dinner-card "next dinner" pill and admin `FilterChip`; `secondary` border → the one `border-foreground/15` hairline (drop `white/20`). Type stays native `text-xs font-semibold tracking-wide`. |
| **Chip** | **one** chip primitive with pill shape, `active` state `border-primary/35 bg-primary/10 text-accent-light` (native opacities) — reconciles `section-nav` chips, `FilterChip`, and auth segmented control. |
| **Eyebrow** | §5 — one component, two variants, all native utilities. |
| **Card** | one radius (§4), no shadow (§8), one hairline, `comfortable`/`compact` density (§6). Admin hover-border is an `interactive` prop, not a fork. **No register weight fork** — display titles `font-light`, row titles `font-semibold`, both registers (§1). |
| **SecondaryCTA** | extract the `border-b border-foreground/35 hover:border-foreground` link (duplicated in dinner-card + hero) into one component **with** `transition-colors`; border opacity → native `/35`. |
| **Field family** | align **Select trigger to Input**: `h-11 rounded-lg text-sm px-3`, surface `bg-foreground/5`, border = the one `border-foreground/15` hairline (no separate `--input` token), `focus-visible:`, drop its shadow. Labels: one recipe `text-sm font-semibold text-foreground/65`, **not** lowercase. **New: file-upload field** — `rounded-lg border-dashed border-foreground/20 bg-foreground/5`, hover/focus `border-primary/35`, file rows on the hairline with a `text-red-300` remove action. |
| **Icon** | canonical sizes: `size-4` (16, default UI — also absorbs the size-4.5 half-step), `size-[15px]`→**`size-4`**, `size-[17px]/[19px]`→**`size-5`** (nav/action). Icon+label gap → whole steps: `gap-1` (tight) / `gap-2` (standard) — kills `gap-1.5`, `gap-1.75`, `gap-2.5`. |

---

## 10. Proposed `@theme` changes  **[revised round 2: subtractive, not additive]**

After the round-2 native-token harmonization, the system needs **zero new tokens**. The `@theme`
diff for [tailwind.css](app/tailwind.css) is now a *deletion* list — **proposal only; applied in
the later code-convergence effort, not now.**

**Delete:**
```css
--input                    /* merged into --border */
--color-fg-secondary       /* → text-foreground/80 */
--color-fg-muted           /* → text-foreground/65 */
--color-fg-label           /* → text-foreground/50 */
--color-fg-faint           /* → text-foreground/40 */
```

**Change:**
```css
--border: rgb(245 241 236 / 0.15);   /* was 0.1 — merged hairline+input, brighter kept */
```

**Keep (the entire custom surface):** `background`, `card`, `foreground`, `primary` (+foreground),
`accent-light`, `destructive`, `ring`, `--radius: 0.5rem` (drives rounded-lg/md/sm), `--font-sans`.

Everything else the system uses is a native utility: `text-*` ramp with built-in leadings,
`tracking-tight`/`tracking-widest`/`tracking-wide`, `rounded-xs/sm/lg/2xl/full`, whole-step
spacing, `max-w-xs/md/2xl/5xl`, `duration-150/300/500`, `red-300`/`sky-300`, native `/5`-step
opacity modifiers.

Plus: remove `shadow-sm` from `Card`, add the `.glow-primary` utility (primary/15, strong /20).
The vestigial `.dark`/`@custom-variant dark` plumbing is **kept + documented** (resolved call #6):
the app is single-theme dark-only by design, but the plumbing preserves optionality for a future
light mode — add a comment in `tailwind.css` saying exactly that during code convergence.

---

## 11. Open calls — ✅ ALL RESOLVED by the user, 2026-07-06

Decided individually (not as a blanket accept). Outcomes, with (rec.) marking where the
recommendation was followed:

1. **Card radius:** **16px** ✅ (rec.) — native `rounded-2xl`, both registers.
2. **Page width:** **1024px `max-w-5xl`** — overrode 1040; user preferred the native Tailwind step.
3. **Eyebrow tracking:** **0.1em `tracking-widest`** — overrode 0.2em; native step again, accepting
   visibly tighter eyebrows than shipped.
4. **Avatar tint `#E0A87F`:** **drop** — overrode add-token; fold into `--color-accent-light`.
5. **`lowercase` device:** **drop entirely** — overrode keep-scoped; headings render as typed.
6. **Vestigial dark-mode plumbing:** **keep + document** — overrode delete; preserves light-mode
   optionality, documented as a deliberate single-theme decision.

**Meta-pattern for future calls:** the user consistently chose native Tailwind values over custom
tokens and dropped optional flourishes, but kept optionality where deletion would burn a bridge
(dark-mode plumbing). Phase 3 is unblocked.

---

## 12. Round 2 — native-token harmonization (user rulings on bundle review, 2026-07-06)

On reviewing the first Phase 3 bundle, the user extended the native-first principle system-wide:

1. **Native tokens everywhere, nearest to each shipped value** — and *talk* in Tailwind utility
   names, not px, throughout docs and bundle.
2. **No fractional steps** (spacing, sizes): halves round down, quarters to nearest — overturns
   round 1's "bless the half-steps". Mapping table in §6.
3. **Type ramp all native** (§3): text-xs/sm/base/lg body, xl–5xl display, built-in leadings,
   `tracking-tight`; buttons `text-base`.
4. **One heading weight** (§1/§3): admin `font-extrabold` is *not* system canon — `font-light`
   display everywhere; weight is not a register signal. (The extrabold observation was real —
   admin-ui.tsx:26 et al. — but shipped ≠ blessed.)
5. **One hairline** (§2): `--border` and `--input` merge at `foreground/15` (brighter kept, native
   step). All transparency at native /5 steps.
6. **Text tiers → opacity** (§2): the four `fg-*` hex tokens become `foreground/80·65·50·40`.
7. **Semantic text colors → native palette** (§2): `red-300` (was #E0899A), `sky-300` (was custom
   oklch info).
8. **Prose widths → native max-w** (§7), **durations → native utilities** (§8), **decorative radii
   → rounded-xs/sm** (§4).
9. **Form fields gain a file-upload pattern** (§9).

Net effect on §10: the design system adds **zero** custom tokens and deletes five.
