# Drift Inventory — Validated & Extended (Phase 1)

Companion to [design-audit.md](./design-audit.md). Produced 2026-07-05 by re-verifying the
audit against current code (`dev` @ `1c8c631`) and sweeping the dimensions the audit did not
cover. This is the brief for Phase 2 (distillation).

> **Headline finding.** The audit was written **before** the admin redesign
> (`2d8f4f6 feat: redesign of the admin pages` + `1c8c631 fix: tests…`). All of `app/routes/admin.*`
> and `app/components/admin-*.tsx` / `admin-ui.tsx` were rebuilt afterward and carry a **new,
> parallel layer of drift** the audit never saw — most importantly a **sixth card radius
> `rounded-[14px]`**, **raw hex colors inside the canonical `Button`**, and **three new eyebrow
> tracking values**. One audit finding is now **resolved** (the `bg-gray-950/85` SaveBar).
> Net: the divergence is _wider_ than the audit reported, and the admin surface is now a
> distinct design dialect that Phase 2 must explicitly rule on.

Legend: ✅ confirmed as-is · ↔ confirmed but line/value drifted · ✳️ **new** (not in audit) ·
✔️ **resolved** since audit.

---

## Part A — Re-verification of the audit

### A1. Buttons (audit §1)

- ✅ Base still `rounded-lg text-[15px] font-semibold` ([button.tsx:8](app/components/ui/button.tsx:8)); sizes unchanged (`default h-11 px-6`, `sm h-9.5 px-4.5 text-sm`, `lg h-12 px-6`, `icon h-9 w-9`).
- ✳️ **New `destructive-outline` variant hardcodes a raw hex** `text-[#E0899A]` ([button.tsx:16](app/components/ui/button.tsx:16)). This is a _second_ home for the "hand-tinted red" the audit flagged only in signup-form-builder — and it's now in the canonical component.
- ✳️ **`outline` variant border is an arbitrary opacity** `border-foreground/[0.22]` ([button.tsx:18](app/components/ui/button.tsx:18)) — yet another hairline value competing with `--border`.
- ↔ `w-full rounded-[9px]` submit buttons: still 4× — [dinners_.$dinnerId.tsx:309](app/routes/dinners_.$dinnerId.tsx:309), [login.tsx:141](app/routes/login.tsx:141), [join.tsx:174](app/routes/join.tsx:174), [dinners._index.tsx:94](app/routes/dinners._index.tsx:94).
- ↔ `rounded-[10px]` nav CTA still at [site-nav.tsx:206](app/components/site-nav.tsx:206) (also `h-13 text-base`).
- ↔ Destructive-tinted icon button now at [signup-form-builder.tsx:517](app/components/signup-form-builder.tsx:517) (was :516) — still raw `text-red-300 hover:text-red-200`.
- ✅ Segmented control `rounded-[7px]` still at [auth-layout.tsx:88](app/components/auth-layout.tsx:88), inside a `rounded-[10px]` shell ([:95](app/components/auth-layout.tsx:95)).
- ✅ Border-b "secondary CTA" still duplicated verbatim: [dinner-card.tsx:79](app/components/dinner-card.tsx:79) and [hero/view.tsx:65](app/features/cms/blocks/hero/view.tsx:65).
- ✳️ **New chip idiom** — admin `FilterChip` `h-9 rounded-full border px-3.75 text-[13px] font-semibold` + active `border-primary/35 bg-primary/12 text-accent-light` ([admin-ui.tsx:78](app/components/admin-ui.tsx:78)). A _third_ pill/chip pattern alongside `section-nav` chips and the dinner-card pill.

### A2. Badges / eyebrows (audit §2)

- ✅ `Badge` base unchanged `rounded-md border px-2.5 py-0.5 text-xs font-semibold tracking-wide` ([badge.tsx:7](app/components/ui/badge.tsx:7)); `secondary` still carries `border-white/20` ([:12](app/components/ui/badge.tsx:12)) — a hairline outlier.
- ✅ "friends" teal raw oklch confirmed at [signup-form-builder.tsx:76](app/components/signup-form-builder.tsx:76) and [:281](app/components/signup-form-builder.tsx:281).
- ✅ dinner-card "next dinner" pill still bespoke `rounded-full` (not `<Badge>`) at [dinner-card.tsx:34](app/components/dinner-card.tsx:34).
- ✳️ **Eyebrow tracking sprawl got worse.** Audit listed 5 values (`.16 / .18 / .2 / .24 / .28em`). Admin added **three more**: `.06em` ([admin-ui.tsx:23](app/components/admin-ui.tsx:23), [admin._index.tsx:164](app/routes/admin._index.tsx:164)), `.04em` ([signups.tsx:113-122](app/routes/admin.dinners.$dinnerId_.signups.tsx:113)), `.02em` ([admin.dinners._index.tsx:169](app/routes/admin.dinners._index.tsx:169)). **Eight distinct tracking values now in play** for the same eyebrow role.
- ✅ `Eyebrow` component unchanged (`tracking-[.24em]`, [section.tsx:16](app/components/section.tsx:16)); still overridden to `.28em` at [dinners._index.tsx:30](app/routes/dinners._index.tsx:30).

### A3. Cards / panels (audit §3)

- ✳️ **Six card radii now, not five.** Audit had `md`/`lg`/`[10px]`/`xl`/`2xl`. The admin redesign adds **`rounded-[14px]` in 8 places** — [admin-dinner-form.tsx:84](app/components/admin-dinner-form.tsx:84), [admin.dinners.$dinnerId_.signups.tsx:109](app/routes/admin.dinners.$dinnerId_.signups.tsx:109), [admin.locations._index.tsx:71](app/routes/admin.locations._index.tsx:71), [admin._index.tsx:88](app/routes/admin._index.tsx:88), [:96](app/routes/admin._index.tsx:96), [:153](app/routes/admin._index.tsx:153), [admin.board-members.tsx:95](app/routes/admin.board-members.tsx:95), [admin.dinners._index.tsx:153](app/routes/admin.dinners._index.tsx:153). Sits between `rounded-xl` (12px) and `rounded-2xl` (16px) — pure drift.
- ✔️ **RESOLVED: `bg-gray-950/85` SaveBar is gone.** [admin-dinner-form.tsx:113](app/components/admin-dinner-form.tsx:113) now reads `border-foreground/10 bg-background/90 … backdrop-blur md:rounded-xl md:border` — the only raw Tailwind palette background in the app has been removed. Audit finding §3.3 can be closed.
- ↔ Public ad-hoc cards unchanged (`border-foreground/12 bg-card rounded-2xl`): [dinner-card.tsx:24](app/components/dinner-card.tsx:24), [dinners._index.tsx:76](app/routes/dinners._index.tsx:76), [dinners_.$dinnerId.tsx:209](app/routes/dinners_.$dinnerId.tsx:209).
- ✳️ **Admin settled on a card convention — but a different one than public.** Every admin list card is `border-foreground/10 … hover:border-primary/30 transition-colors` (see A6). It's internally consistent (good) but uses `/10` where public uses `/12`, `rounded-[14px]` where public uses `rounded-2xl`, and adds a hover-border affordance public cards lack.
- ✳️ **New raw hex avatar tints** `text-[#E0A87F] bg-[#E0A87F]/15` ([admin-ui.tsx:121](app/components/admin-ui.tsx:121)) — a fourth off-token color (alongside teal oklch, primary rgba glow, and the button `#E0899A`).
- ✳️ Empty-state + file-dropzone use `border-dashed`: [admin-ui.tsx:167](app/components/admin-ui.tsx:167) (`rounded-2xl border-dashed py-15`), [admin-dinner-form.tsx:264](app/components/admin-dinner-form.tsx:264) (`rounded-[10px] border-dashed py-6`) — same idiom, two radii.
- ✅ `Card` component still `rounded-xl border shadow-sm` ([card.tsx:9](app/components/ui/card.tsx:9)); now used by admin (with `rounded-[14px]` override), no longer "one place only."

### A4. Titles / headings (audit §4)

- ✅ Public display scale unchanged — arbitrary px `26/28/30/34/38` → md `32/42/44/52`, all `font-light` (hero, dinner-view, dinners._index, auth-layout, join/login).
- ✳️ **Admin now has a formalized, opposite heading voice.** `AdminPageHeader` h1 = `text-[26px] font-extrabold tracking-[-.02em] md:text-[32px]` ([admin-ui.tsx:26](app/components/admin-ui.tsx:26)); mirrored in [admin-dinner-form.tsx:154](app/components/admin-dinner-form.tsx:154). Same px steps as public **but `font-extrabold` vs public `font-light`** — the "admin vs public typographic voice" question the audit raised is now a concrete, shipped fork. Phase 2 must bless or reconcile it.
- ✅ `font-light` (19×) vs `font-extrabold` (3×, all admin) / `font-bold` (13×) split confirmed.
- ✅ `lowercase` brand device still inconsistent (9× lowercase, 12× uppercase) — on `dinner-view.tsx:55`, `dinner-card.tsx:48,110` but not hero / dinners._index.
- ✅ Five "tight" leading values confirmed (`1.06/1.08/1.1/1.12/1.15`) + body `1.75/1.8`.

### A5. Non-standard values (audit §5) — deltas only

- **Radii:** all audit entries confirmed; **add `rounded-[14px]` (8×)** and `rounded-[10px]` icon tiles at [admin.locations._index.tsx:73](app/routes/admin.locations._index.tsx:73) / [admin._index.tsx:159](app/routes/admin._index.tsx:159).
- **Colors:** add `text-[#E0899A]` ([button.tsx:16](app/components/ui/button.tsx:16)), `text-[#E0A87F]`/`bg-[#E0A87F]/15` ([admin-ui.tsx:121](app/components/admin-ui.tsx:121)), `border-foreground/[0.22]` ([button.tsx:18](app/components/ui/button.tsx:18)), `bg-foreground/3` ([admin-ui.tsx:50](app/components/admin-ui.tsx:50)), `bg-primary/12` (admin chips/tiles). **Remove `bg-gray-950/85`** (resolved). Teal oklch + radial-gradient glow (3×, opacities `.16`/`.20`) unchanged.
- **Max-widths:** audit's `1040`(×3)/`1080` confirmed; **add `max-w-[1160px]` and `max-w-[420px]`** — now _three_ competing page widths (1040 / 1080 / 1160) plus prose widths `760/560/520/460/420/400/340/320`.
- **Percent splits:** `44/56`, `46/54`, `47/53` all confirmed (three near-half splits). Grid templates `1fr_1.6fr` / `1.55fr_1fr` confirmed.
- **Off-grid spacing:** audit set confirmed; admin **adds** `py-3.25`, `py-2.75`, `py-3.75`, `px-3.75`, `size-6.5`, `size-8.5`, `pt-9.5`, `pb-4.5`, `py-15`, plus fixed `h-[7px]`, `h-[132px]`, `md:size-[118px]`, `md:h-[86px]`, `md:w-[104px]`. Most-used off-grid: `px-4.5` (11×), `gap-4.5` (10×), `p-5.5`/`py-3.25`/`gap-5.5` (5× each).

---

## Part B — Extended dimensions (not covered by the audit)

### B1. Interaction states (focus / hover / disabled / active)

**Focus is the biggest inconsistency in the app.** Four different focus languages coexist:

| Element                                | Focus treatment                                                             | File                                                                                                                                                |
| -------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Input / Textarea / fallback `<select>` | `focus-visible:border-0 focus-visible:inset-ring-2 focus-visible:ring-ring` | [input.tsx:16](app/components/ui/input.tsx:16), [textarea.tsx:13](app/components/ui/textarea.tsx:13), [forms.tsx:120](app/components/forms.tsx:120) |
| Button                                 | `focus-visible:ring-1 focus-visible:ring-ring` (outer ring)                 | [button.tsx:8](app/components/ui/button.tsx:8)                                                                                                      |
| Checkbox                               | `focus-visible:ring-1 focus-visible:ring-ring`                              | [checkbox.tsx:14](app/components/ui/checkbox.tsx:14)                                                                                                |
| Select trigger                         | **`focus:`** (not `focus-visible:`) `inset-ring-2`                          | [select.tsx:30](app/components/ui/select.tsx:30)                                                                                                    |
| Dropdown / Select items                | `focus:bg-accent` (no ring)                                                 | [dropdown-menu.tsx:108](app/components/ui/dropdown-menu.tsx:108), [select.tsx:153](app/components/ui/select.tsx:153)                                |
| Badge                                  | `focus:ring-2 focus:ring-offset-2`                                          | [badge.tsx:7](app/components/ui/badge.tsx:7)                                                                                                        |

- Ring width drifts `ring-1` / `inset-ring-2` / `ring-2`; some use `focus:` (mouse+keyboard) vs `focus-visible:` (keyboard only) — an **a11y inconsistency**, not just cosmetic.
- **Hover:** admin list cards share `hover:border-primary/30` (4×, consistent); public "read-more" links use `hover:border-foreground` **without** `transition-colors` (abrupt) at [dinner-card.tsx:79](app/components/dinner-card.tsx:79), [hero/view.tsx:65](app/features/cms/blocks/hero/view.tsx:65). Nav hover is inconsistent: `section-nav` and `admin-tabs` transition; `site-nav` desktop links and `footer` links change color with **no** transition.
- **Disabled:** only `disabled:opacity-50` (button, checkbox) + `disabled:pointer-events-none` (button). No disabled styling on inputs/textarea.
- **Active:** no `active:` states anywhere; "active/selected" is expressed via `aria-pressed` / `aria-current` / `data-[state]` conditional classes.

### B2. Transitions, durations & animations

- **Durations:** no system — `duration-200` (chevron rotate: [accordion.tsx:39](app/components/ui/accordion.tsx:39), collapsible), `duration-300` (page entrance, admin ×6), `duration-400` (seat progress: [admin-ui.tsx:108](app/components/admin-ui.tsx:108)), and **default (unset)** for every `transition-colors`. Four speeds, no tokens.
- **Property:** almost everything is `transition-colors`; plus `transition-opacity` ([dinner-card.tsx:96](app/components/dinner-card.tsx:96)), `transition-transform` (chevrons), `transition-[width]` (progress bar), `transition-all` ([accordion.tsx:33](app/components/ui/accordion.tsx:33)).
- ✳️ **Page-entrance animation is copy-pasted across 6 admin routes:** `animate-in fade-in slide-in-from-bottom-1.5 duration-300` ([admin._index.tsx](app/routes/admin._index.tsx), `admin.users._index`, `admin.board-members`, `admin.locations._index`, `admin.dinners._index`, `admin.dinners.$dinnerId_.signups`). Public pages have **no** entrance animation → a two-tier motion strategy. Candidate for a shared wrapper/utility.
- Easing: only the two `accordion-*` keyframes name `ease-out`; everything else uses Tailwind defaults.

### B3. Form fields

- Input & Textarea are mutually consistent (`h-11`/`min-h-[70px]`, `px-3.5`, `rounded-lg`, `border-input`, `bg-[var(--input-surface,var(--background))]`, `placeholder:text-fg-faint`, `text-sm`) — **except Textarea is missing `transition-colors`** ([textarea.tsx:13](app/components/ui/textarea.tsx:13) vs [input.tsx:16](app/components/ui/input.tsx:16)).
- **Select trigger diverges from Input:** `h-9` (vs `h-11`), `rounded-md` (vs `rounded-lg`), `bg-transparent` (vs input surface), carries `shadow-xs`, `focus:` not `focus-visible:` ([select.tsx:30](app/components/ui/select.tsx:30)). It does not read as the same control family.
- **Label inconsistency:** `Label` component = `text-[13px] text-fg-muted lowercase font-normal` ([label.tsx:8](app/components/ui/label.tsx:8)), but ad-hoc labels use `text-fg-secondary text-sm` (checkbox rows, [forms.tsx:160](app/components/forms.tsx:160)) and `text-[13px] text-fg-secondary` ([login.tsx:135](app/routes/login.tsx:135)) — different size, color, and case for the same role.
- Checkbox is its own thing: `size-4.5 rounded-[5px] border-foreground/30 checked:bg-primary` ([checkbox.tsx:14](app/components/ui/checkbox.tsx:14)).

### B4. Shadows

- Only named tiers, no arbitrary shadows: `shadow-xs` (destructive/secondary buttons [button.tsx:14,20](app/components/ui/button.tsx:14), select trigger, fallback select), `shadow-sm` (Card [card.tsx:9](app/components/ui/card.tsx:9)), `shadow-md` (popover/select/dropdown content), `shadow-lg` (dropdown subcontent, toast).
- **Card's `shadow-sm` is effectively dead:** the component is only used in admin with radius/border overrides, and no ad-hoc public card carries a shadow — so the elevation model is "borders, not shadows" on surfaces, shadows only on floating layers. Worth codifying (drop `shadow-sm` from Card, or make it intentional).
- **Select trigger is the only text input with a shadow** (`shadow-xs`) — reinforces B3's "select doesn't match the input family."

### B5. Z-index

- Two layers only, no arbitrary values: **z-10** = mobile sticky bars ([section-nav.tsx:44](app/components/section-nav.tsx:44), [admin-dinner-form.tsx:113](app/components/admin-dinner-form.tsx:113), both reset to `md:z-auto`/`md:` on desktop); **z-50** = all portalled overlays (popover, select, dropdown, tooltip, mobile menu). Collision-free thanks to portals. This dimension is **healthy** — a rare clean area. Recommend just naming the two tiers in the spec.

### B6. Breakpoints

- **`md:` is the de-facto sole breakpoint** (~73 uses, ~81%). `sm:` is a minor footnote (~16, phone-range flex tweaks). `lg:` appears **once** (Button `lg` size, [button.tsx:27](app/components/ui/button.tsx:27) — a size name, not a responsive prefix). `xl:` never. The system is genuinely two-state (mobile-stacked / desktop) — Phase 2 should state this as the intended model rather than an omission.

### B7. Dark-mode / color-scheme

- **Dark-only by design and it's clean.** Palette lives in `:root` (dark browns/orange); `<body class="dark">` is hardcoded (root.tsx) and `@custom-variant dark` is defined ([tailwind.css:6](app/tailwind.css:6)) but **zero `dark:` prefixes** exist. **Zero raw light-palette leftovers** (`text-white/black`, `bg-gray-*`, `slate`, `neutral` all absent). The `.dark` class + custom variant are **vestigial** — either remove them or document the single-theme decision. No action needed for harmonization beyond that note.

### B8. Icons

- **Two sources:** `@radix-ui/react-icons` (primary) + a tiny custom set `UtensilsIcon`, `CreditCardIcon` ([icons.tsx](app/components/icons.tsx)); plus `Logo`, `Arrow`, illustrations.
- **~9 distinct icon sizes:** standard `size-3.5/4/4.5/5.5/6.5` **and** arbitrary `size-[15px]` (7×, feature cards + admin detail back-links), `size-[17px]` (7×, search/nav/admin action buttons), `size-[19px]` (3×, Logo in nav). The arbitrary trio sits between `size-3.5` and `size-5`.
- **Color is well-behaved:** `currentColor` throughout; `text-fg-label` for metadata icons, `text-primary` for interactive/toggle icons. Custom SVG `strokeWidth` drifts slightly (1.5 vs 1.6; Logo `"2"`).
- **Icon+label gaps** span `gap-1/1.5/1.75/2/2.5/3/3.5` — most common `gap-1.5` and `gap-2.5`. `gap-1.75` ([admin-tabs.tsx:45](app/components/admin-tabs.tsx:45)) is an off-grid one-off.
- Logo has no canonical size (`size-5.5` in brand-lockup vs `size-[19px]` in nav).

---

## Part C — New drift introduced by the admin redesign (consolidated)

Because this all landed after the audit, it's worth listing in one place — Phase 2's admin/public
reconciliation hinges on it:

1. **`rounded-[14px]`** as the admin card radius (8×) — a 6th radius tier.
2. **Raw hex in the design system:** `text-[#E0899A]` (Button `destructive-outline`), `text-[#E0A87F]`/`bg-[#E0A87F]/15` (avatar tints).
3. **`border-foreground/[0.22]`** arbitrary hairline in Button `outline`; admin cards standardize on `border-foreground/10` (vs public `/12`).
4. **Three new eyebrow tracking values** (`.02/.04/.06em`) → 8 total.
5. **Admin heading voice = `font-extrabold`** (vs public `font-light`), same px steps — a deliberate-looking fork, undocumented.
6. **New off-grid spacing** (`py-3.25/2.75/3.75`, `px-3.75`, `size-6.5/8.5`, `py-15`, fixed `h-[7px]/[132px]`, `size-[118px]`…).
7. **`max-w-[1160px]`** → third page width.
8. **Copy-pasted page-entrance animation** across 6 routes.
9. **New chip idiom** (`FilterChip`, `rounded-full h-9 px-3.75`) — third chip pattern.

Positives worth preserving (admin got _more_ consistent internally): a shared `admin-ui.tsx`
component kit (`AdminPageHeader`, `AdminSearchField`, `FilterChip`, `SeatProgress`,
`InitialsAvatar`, `AdminEmptyState`), one card hover pattern, and the removal of `bg-gray-950/85`.

---

## Part D — Updated harmonization priorities

Refines audit §6 with what Phase 1 uncovered (changes in **bold**):

1. **Radius** — kill `rounded-[7/9/10px]` **and the new `rounded-[14px]`**; settle button radius and **2 card tiers that cover both public (`rounded-2xl`) and admin (`[14px]`) — pick one per tier.**
2. **Color tokens** — promoted in priority: teal oklch → token; radial-glow (2 opacities of primary) → token; **`#E0899A` and `#E0A87F` hex → tokens or existing `destructive`/`accent-light`**; unify hairlines (`/8`, `/10`, `/12`, `/[0.22]`, `white/10`, `white/20`) on `--border`. `bg-gray-950/85` already resolved.
3. **Type scale** — register body `13/15/17px` + display `26/28/30/34/38 → 32-52px`; collapse the 5 `leading-[1.0x]`; pick one negative tracking. **Explicitly decide the admin `font-extrabold` vs public `font-light` voice.**
4. **Eyebrow/kicker** — one component, one tracking value, color prop; **now reconciling 8 tracking values, not 5.**
5. **Focus & motion (new)** — one focus-ring token (`focus-visible:` + one ring width) across inputs/select/checkbox/button/badge; add Textarea's missing transition; name 2–3 duration tokens; extract the admin page-entrance animation.
6. **Layout constants** — one content max-width (**1040 / 1080 / 1160**), one image/text split (44/46/47%), named prose widths.
7. **Spacing** — bless or round the off-grid steps (now including the admin additions).
8. **Components** — `icon-sm` button size, pill Badge variant, shared secondary-CTA (border-b), align Select to the Input family, reconcile the three chip idioms; **document the admin component kit as canon.**

**Fastest wins:** radius (now 6 tiers, one new value repeated 8×) and the hex/hairline color tokens.
