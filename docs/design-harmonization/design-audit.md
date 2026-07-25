# Design Audit — UI Variants & Non-Standard Tailwind Values

Audit of `app/components/**`, `app/routes/**`, and `app/features/**` (2026-07-05).
Goal: inventory every button/badge/card/title variant and every off-scale Tailwind value, as groundwork for harmonizing sizing and spacing.

Context: Tailwind v4 (`^4.2.1`), single sans font family (no serif anywhere — headings differentiate only via size/weight/tracking/lowercase). Theme tokens live in `app/tailwind.css` (`--color-fg-secondary/-muted/-label/-faint`, `--radius: 0.5rem`).

---

## 1. Buttons

### Canonical component — `app/components/ui/button.tsx:8`

Base: `rounded-lg text-[15px] font-semibold`
Variants: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`
Sizes: `default` (`h-11 px-6`), `sm` (`h-9.5 px-4.5 text-sm`), `lg` (`h-12 px-6`), `icon` (`h-9 w-9`)

Note: the base itself already uses two off-scale values (`text-[15px]`, and size `sm` uses half-steps `h-9.5 px-4.5`).

### `<Button>` usages that override visuals

| Location | variant/size | Override | Effect |
|---|---|---|---|
| `app/routes/dinners_.$dinnerId.tsx:309` | lg | `w-full rounded-[9px]` | radius 8px→9px |
| `app/routes/login.tsx:141` | lg | `mt-0.5 w-full rounded-[9px]` | radius 8px→9px |
| `app/routes/join.tsx:174` | lg | `mt-0.5 w-full rounded-[9px]` | radius 8px→9px |
| `app/routes/dinners._index.tsx:94` | outline, lg | `relative mt-1.5 rounded-[9px]` | radius 8px→9px |
| `app/components/site-nav.tsx:206` | lg | `mt-8 h-13 rounded-[10px] text-base` | h-12→h-13, radius→10px, text 15px→16px |
| `app/features/cms/blocks/hero/view.tsx:70` | default | `h-11.5` | h-11→h-11.5 |
| `app/components/signup-form-builder.tsx:487,501` | outline, icon | `compactButton` = `h-7 w-7` | icon 36px→28px |
| `app/components/signup-form-builder.tsx:516` | outline, icon | `compactButton` + `border-destructive/50 bg-destructive/10 text-red-300 hover:bg-destructive/30 hover:text-red-200` | ad-hoc destructive-tinted icon button (uses raw `text-red-300/200`) |
| `app/components/signup-form-builder.tsx:538` | ghost, icon (via `buttonVariants`) | `compactButton` + `data-[state=open]:text-primary` | shrunken trigger |

Unmodified `<Button>` usages exist throughout the admin routes (`admin._index`, `admin.dinners.*`, `admin.locations.*`, `admin.users.*`, `admin.board-members.*`), `dinner-card.tsx:74`, `site-nav.tsx:96`, and `admin-dinner-form.tsx:121,124`.

### Ad-hoc button-like elements (not `<Button>`)

| Location | What | Classes |
|---|---|---|
| `app/components/auth-layout.tsx:86-103` | Segmented control (login/join tabs) | `h-9.5 rounded-[7px] text-sm` + active `bg-primary text-primary-foreground font-semibold` — a third radius (7px) inside a `rounded-[10px]` container |
| `app/components/section-nav.tsx:52,64-69` | Nav chips | `rounded-full border px-3 py-1.5 text-sm md:rounded-md md:py-2` + active `border-primary/40 bg-primary/10 text-primary` — pill on mobile, rounded-md on desktop |
| `app/components/dinner-card.tsx:77` | Secondary CTA ("underline link") | `border-foreground/35 hover:border-foreground w-fit border-b pb-0.5 text-[15px]` |
| `app/features/cms/blocks/hero/view.tsx:62-65` | Secondary CTA — same pattern, duplicated | `border-foreground/35 hover:border-foreground w-fit border-b pb-0.5 text-[15px]` |
| `app/features/forms/fields/list/view.tsx:56` | Remove action | `text-primary text-xs lowercase hover:underline` |
| `app/features/forms/fields/list/view.tsx:87` | Add action | `text-primary text-[13px] font-medium lowercase hover:underline` |
| `app/components/site-nav.tsx:81` | Logout | `text-fg-secondary hover:text-foreground` (plain text link) |

**Button findings**

1. `rounded-lg` (8px) is overridden to **`rounded-[9px]` in 4 places, `rounded-[10px]` in 1, `rounded-[7px]` in 1**. Either change `--radius` / the Button base once, or accept `rounded-lg` — the 1–2px differences are not intentional design tiers.
2. `w-full rounded-[9px]` + `size="lg"` is a de-facto "form submit button" repeated 3× → candidate for a shared pattern or just the default lg look.
3. `compactButton` (`h-7 w-7`) used 4× in `signup-form-builder.tsx` → candidate for an `icon-sm` size in `buttonVariants`.
4. The destructive-tinted icon button hardcodes `text-red-300/200` instead of theme destructive tokens.
5. The border-b "secondary CTA" is duplicated verbatim in two files → extract or make a Button `link`-style variant.

---

## 2. Badges / pills / micro-labels

### Canonical component — `app/components/ui/badge.tsx:7`

Base: `rounded-md border px-2.5 py-0.5 text-xs font-semibold tracking-wide`
Variants: `default`, `secondary`, `destructive`, `outline`

### Usages & deviations

| Location | What | Classes / deviation |
|---|---|---|
| `app/components/signup-form-builder.tsx:75-76,287` | `FRIENDS_CHIP_CLASSES` on `<Badge variant="outline">` | `border-[oklch(75%_0.09_220/0.4)] bg-[oklch(75%_0.09_220/0.16)] text-[oklch(75%_0.09_220)]` — raw oklch color, not a theme token |
| `app/components/signup-form-builder.tsx:281` | Row card teal tint | `border-[oklch(75%_0.09_220/0.4)] bg-[oklch(75%_0.09_220/0.05)]` — same raw color again |
| `app/components/dinner-card.tsx:34` | "next dinner" pill | `bg-primary text-primary-foreground h-6.5 rounded-full px-3 text-xs font-bold md:h-7.5` — badge-shaped but `rounded-full` + `font-bold`, doesn't use `<Badge>` |
| `app/components/signup-form-builder.tsx:331,333,776` | Plain `<Badge>` / `variant="secondary"` | no overrides |

### Eyebrow / kicker labels (title-adjacent micro-labels)

Canonical: `Eyebrow` in `app/components/section.tsx:16` — `text-primary text-xs font-semibold tracking-[.24em] uppercase`.

Two coexisting idioms:

**A. Uppercase + letter-spaced** — tracking varies `.16em` / `.18em` / `.2em` / `.24em` / `.28em`:

| Location | Classes |
|---|---|
| `app/components/section.tsx:16` (Eyebrow) | `text-primary text-xs font-semibold tracking-[.24em] uppercase` |
| `app/components/section.tsx:35` (SectionDivider) | same but `text-fg-label` |
| `app/routes/dinners._index.tsx:30` | `<Eyebrow className="tracking-[.28em]">` — overrides its own component |
| `app/components/footer.tsx:5` | `text-[11px] tracking-[.2em] uppercase text-fg-faint` |
| `app/features/cms/blocks/text-section/view.tsx:29` | `text-xs font-bold tracking-[.24em] uppercase opacity-70` |
| `app/features/cms/blocks/hero/view.tsx:79` | `text-fg-faint text-xs tracking-[.18em] uppercase` |
| `app/features/forms/fields/list/view.tsx:53` | `text-fg-label text-xs font-semibold tracking-[.16em] lowercase` (lowercase!) |

**B. Plain `text-primary` kicker, no uppercase, no tracking:**

| Location | Classes |
|---|---|
| `app/components/dinner-view.tsx:49` | `text-primary text-xs font-semibold md:text-[13px]` |
| `app/components/dinner-card.tsx:41` | identical |
| `app/routes/dinners._index.tsx:81` | `text-primary text-[13px] font-semibold` |
| `app/features/cms/blocks/hero/view.tsx:37` | `text-primary text-[13px] font-semibold` |
| `app/components/auth-layout.tsx:40` | `text-accent-light text-[13px] font-semibold` |
| `app/components/auth-layout.tsx:66` | `text-accent-light text-xs font-semibold` |

**Badge/label findings**

1. The teal "friends" color is hardcoded as raw oklch in 2 places → should be a theme token (e.g. `--color-info`).
2. The dinner-card pill should be a `<Badge>` variant (needs a `rounded-full` pill variant).
3. Eyebrows need one component with defined tracking (pick one value, likely `.24em`) and a color prop (`primary` / `label` / `faint`); the kicker idiom (B) should be a second named variant, not ad-hoc spans.
4. Font size drifts between `text-xs` (12px), `text-[13px]`, and `text-[11px]` for the same role.

---

## 3. Cards / panels

### Canonical component — `app/components/ui/card.tsx`

`bg-card text-card-foreground rounded-xl border shadow-sm`; `CardHeader`/`CardContent` padding `p-6`; `CardTitle` = `leading-none font-semibold tracking-tight`.

**Used in exactly one place** (`app/components/admin-dinner-form.tsx:83`), and even there overridden: `border-white/10` border, `CardTitle` → `text-base font-bold md:text-lg`, `CardDescription` → `text-foreground/50`.

### Ad-hoc card-like containers

| Location | What | Classes | Radius |
|---|---|---|---|
| `app/components/dinner-card.tsx:24` | Dinner card | `border-foreground/12 bg-card overflow-hidden border` | **rounded-2xl** |
| `app/routes/dinners._index.tsx:76` | CTA panel | `border-foreground/12 bg-card border px-6 py-9.5 md:px-14 md:py-19` | **rounded-2xl** |
| `app/routes/dinners_.$dinnerId.tsx:209` | Reservation sidebar | `border-foreground/12 bg-card border p-5.5 md:p-7` | **rounded-2xl** |
| `app/features/forms/fields/list/view.tsx:50` | Form list panel | `border-foreground/12 bg-background border p-4` | **rounded-[10px]** |
| `app/components/signup-form-builder.tsx:388-390` | Builder row card | `border`, no bg | **rounded-lg / rounded-[10px]** (small vs normal) |
| `app/components/auth-layout.tsx:36` | Auth brand panel (desktop) | `bg-card border-foreground/8 border-r p-12` | — |
| `app/components/auth-layout.tsx:57` | Auth brand header (mobile) | `bg-card border-foreground/8 border-b px-6 pt-6.5 pb-7` | — |
| `app/components/auth-layout.tsx:95` | Segmented control shell | `bg-card border-foreground/12 border p-1` | **rounded-[10px]** |
| `app/components/admin-dinner-form.tsx:110` | Sticky SaveBar | `border-white/10 bg-gray-950/85 backdrop-blur md:rounded-xl` | md:rounded-xl |
| `app/routes/admin.dinners.$dinnerId.tsx:31`, `admin.dinners.$dinnerId_.signups.tsx:48` | Info banner | `bg-secondary rounded-md p-4`, no border | rounded-md |

**Card findings**

1. **Five radii in play for "card": `rounded-md` (6px), `rounded-lg` (8px), `rounded-[10px]`, `rounded-xl` (12px), `rounded-2xl` (16px).** Suggest a two-tier system: outer/content cards = one value (e.g. `rounded-2xl` or `rounded-xl`), nested/compact panels = one value (e.g. `rounded-lg`), and kill `rounded-[10px]`.
2. **Border color is ad-hoc**: `border-foreground/12`, `border-foreground/8`, `border-white/10`, and the theme `--border` (= `foreground/10`) all coexist for the same hairline role. The theme token should win.
3. `bg-gray-950/85` (SaveBar) is the only raw Tailwind palette background in the app — should be a token.
4. None of the ad-hoc cards carry the Card component's `shadow-sm` — either drop it from Card or add it consistently.
5. Padding drifts: `p-4`, `p-5.5`, `p-6` (Card), `p-7`, `p-12` — no clear tier.
6. Admin list pages (`admin.dinners._index.tsx:47`, `admin.users._index.tsx:48`, `admin.locations._index.tsx:47`, `admin.board-members.tsx:28`) use bare flex/divide-y rows — a deliberate-looking but undocumented divergence from the card-heavy public pages.

---

## 4. Titles / headings

### Page titles (h1) — two camps

Public/marketing/auth (pixel sizes + `font-light`):

| Location | Classes |
|---|---|
| `app/features/cms/blocks/hero/view.tsx:42` | `text-[34px] leading-[1.06] font-light tracking-[-.02em] md:text-[52px]` |
| `app/routes/dinners._index.tsx:31` | `text-[34px] font-light tracking-[-.01em] md:text-[44px]` |
| `app/components/dinner-view.tsx:55` | `text-[30px] leading-[1.08] font-light lowercase md:text-[42px]` |
| `app/routes/join.tsx:126` / `login.tsx:108` | `text-[30px] font-light` |
| `app/components/auth-layout.tsx:69` | `text-[28px] leading-[1.12] font-light` (mobile) |

Admin/utility (Tailwind scale + heavy/no weight):

| Location | Classes |
|---|---|
| `app/routes/admin.board-members.tsx:27`, `admin.users.$userId_.edit.tsx:106` | `text-4xl` (no weight) |
| `app/routes/me.tsx:29` | `text-2xl font-extrabold` |
| `app/components/admin-dinner-form.tsx:142` | `text-xl font-bold md:text-2xl` |
| `app/routes/dinners_.$dinnerId.tsx:325,334,341` | `font-semibold` (error boundary, no size) |

Same role spans `font-light` → `font-extrabold` and 20px → 36px+ with no system.

### Section titles (h2)

| Location | Classes |
|---|---|
| `app/components/auth-layout.tsx:43` | `text-[38px] leading-[1.12] font-light` |
| `app/routes/dinners._index.tsx:84` | `text-[28px] leading-[1.1] font-light md:text-[38px]` |
| `app/components/dinner-card.tsx:48` | `text-[26px] leading-[1.1] font-light lowercase md:text-[34px]` |
| `app/features/cms/blocks/text-section/view.tsx:51` | `text-[26px] leading-[1.15] font-light md:text-[32px]` |
| `app/features/cms/blocks/text-section/view.tsx:33` | `text-2xl leading-tight font-normal md:text-[32px]` (same block type, different weight) |
| `app/routes/dinners_.$dinnerId.tsx:217` | `text-xl font-normal` |
| `app/routes/admin.board-members.new.tsx:95`, `admin.board-members.$userId.edit.tsx:119` | `text-3xl` |

### Card/item titles

| Location | Classes |
|---|---|
| `app/components/ui/card.tsx:39` (CardTitle) | `leading-none font-semibold tracking-tight` — overridden in its only usage |
| `app/components/dinner-card.tsx:110` | h4 `text-[15px] font-normal lowercase md:text-[17px]` |
| `app/components/signup-form-builder.tsx:469` | span `truncate font-semibold text-xs/text-sm` |
| `app/routes/admin.board-members.tsx:52` | p `text-sm/6 font-semibold` |

**Title findings**

1. The display scale is entirely arbitrary px: `28/30/34/38/26` base, `32/34/38/42/44/52` at md. Suggest 3–4 named steps (e.g. `display` 34→52, `title` 28→38, `heading` 26→32, `subheading` 20) as theme `--text-*` tokens or a `<Heading level/size>` component.
2. Line-heights `leading-[1.06] / [1.08] / [1.1] / [1.12] / [1.15]` are five spellings of "tight" → collapse to one or two tokens.
3. Tracking `-.01em` vs `-.02em` on display text → pick one.
4. `font-light` is the public brand weight but admin uses `bold/extrabold/none` — decide whether admin intentionally has its own typographic voice, and write it down either way.
5. `lowercase` as a brand device appears on some public headings (`dinner-view.tsx:55`, `dinner-card.tsx:48,110`) but not siblings (`hero`, `dinners._index`) — inconsistent.

---

## 5. Non-standard Tailwind values — full inventory

### 5.1 Arbitrary font sizes (should become theme text tokens)

- `text-[11px]` — footer.tsx:5, dinner-card.tsx:105
- `text-[13px]` — 11×: label.tsx:8, dinner-card.tsx:56, dinner-view.tsx:83, auth-layout.tsx:40, hero/view.tsx:37, list/view.tsx:36,89, dinners_.$dinnerId.tsx:199,291, login.tsx:135, join.tsx:158, dinners._index.tsx:81 (+ `md:text-[13px]` dinner-card.tsx:41, dinner-view.tsx:49)
- `text-[15px]` — 9×: button.tsx:8, dinner-card.tsx:79,110, dinner-view.tsx:60,81,102, footer.tsx:45, auth-layout.tsx:63, hero/view.tsx:65, text-section/view.tsx:36,55, dinners._index.tsx:34
- `text-[17px]` (md:) — dinner-card.tsx:110, dinner-view.tsx:60, dinners._index.tsx:87
- `md:text-[19px]` — hero/view.tsx:53
- `text-[22px]` — site-nav.tsx:146
- `text-[26px]` — dinner-card.tsx:48, text-section/view.tsx:51
- `text-[28px]` — auth-layout.tsx:69, dinners._index.tsx:84
- `text-[30px]` — dinner-view.tsx:55, login.tsx:108, join.tsx:126
- `text-[34px]` — hero/view.tsx:42, dinners._index.tsx:31
- `text-[38px]` — auth-layout.tsx:43 (+ md: dinners._index.tsx:84)
- md-only: `md:text-[32px]` (text-section ×2), `md:text-[34px]` (dinner-card:48), `md:text-[42px]` (dinner-view:55), `md:text-[44px]` (dinners._index:31), `md:text-[52px]` (hero:42)

The de-facto body scale is 11 / 13 / 15 / 17 / 19 px — a full parallel type scale living outside the theme. Either register these as named sizes in `@theme` or move to the standard `text-xs/sm/base/lg` scale.

### 5.2 Arbitrary line-heights & tracking

- `leading-[1.06]` hero:42 · `[1.08]` dinner-view:55 · `[1.1]` dinner-card:48, dinners._index:84 · `[1.12]` auth-layout:43,69 · `[1.15]` text-section:51 · `[1.75]` text-section:55 · `[1.8]` dinner-view:60
- `tracking-[.16em]` list/view:53 · `[.18em]` hero:79 · `[.2em]` footer:5 · `[.24em]` section.tsx:16,35, text-section:29 · `[.28em]` dinners._index:30 · `[-.01em]` site-nav:146, dinners._index:31 · `[-.02em]` hero:42

### 5.3 Arbitrary radii

- `rounded-[3px]` text-section/view.tsx:25 (decorative band)
- `rounded-[5px]` checkbox.tsx:14
- `rounded-[7px]` auth-layout.tsx:88
- `rounded-[9px]` dinners_.$dinnerId.tsx:309, login.tsx:141, join.tsx:174, dinners._index.tsx:94
- `rounded-[10px]` auth-layout.tsx:95, site-nav.tsx:206, signup-form-builder.tsx:390, list/view.tsx:50

With `--radius: 0.5rem` and `--radius-md/-sm` already derived in the theme, 7/9/10px arbitrary radii sit right between `rounded-lg` (8px) and `rounded-xl` (12px) — pure drift, not tiers.

### 5.4 Arbitrary fixed dimensions

- Heights: `h-[58px]` site-nav.tsx:103,156 · `h-[1.5px]` site-nav.tsx:116,117 (hamburger lines) · `h-[100px] md:h-[130px]` dinner-card.tsx:103 · `h-[250px] md:h-[400px]` dinner-view.tsx:45 · `h-[200px] md:h-[360px]` image/view.tsx:18 · `min-h-[180px] md:min-h-[340px]` dinner-card.tsx:25 · `h-[320px]` dinners._index.tsx:79 · `min-h-[70px]` textarea.tsx:13
- Icon sizes: `size-[15px]` ×5 (dinner-card:42,58,63,68, dinner-view:50) · `size-[17px]` site-nav:63,147 · `size-[19px]` site-nav:106,159, auth-layout:62 — sit between `size-3.5` (14px) and `size-4` (16px) and `size-5` (20px); alongside these, standard `size-3.5/4/4.5/5.5` are also used → at least 7 icon sizes in play
- Decorative blobs: `size-[300px]` site-nav:153 · `size-[340px]` auth-layout:37 · `w-[460px]` dinners._index:79
- Offsets: `-top-[90px]` auth-layout:58 · `-top-[150px]` dinners._index:79 · `-right-[90px]` auth-layout:37 · `translate-y-[2px]` table.tsx:99,117

### 5.5 Arbitrary widths / max-widths / grid fractions

- Content max-widths: `max-w-[1040px]` text-section:47, image/view:22, dinners._index:28 · `max-w-[1080px]` dinners_.$dinnerId:196 · `max-w-[760px]` text-section:36 · `max-w-[560px]` dinners._index:34 · `max-w-[520px]` dinners._index:84 · `max-w-[460px]` dinners._index:87 · `max-w-[400px]` auth-layout:76 · `max-w-[340px]` auth-layout:46 — two competing page widths (1040 vs 1080) and six prose widths
- Percent splits: `md:w-[47%]`/`md:w-[53%]` hero:35,85 · `md:w-[44%]`/`md:w-[56%]` dinner-card:25,40 · `md:w-[46%]`/`md:w-[54%]` auth-layout:36,75 — three slightly different near-half splits for the same "image | text" layout
- Grid templates: `md:grid-cols-[1fr_1.6fr]` text-section:48 · `md:grid-cols-[1.55fr_1fr]` dinners_.$dinnerId:204
- Misc: `md:w-[220px]` section-nav:44 · `w-25` admin.dinners.$dinnerId_.signups.tsx:63

### 5.6 Arbitrary colors / gradients (bypassing theme tokens)

- `border-[oklch(75%_0.09_220/0.4)]` / `bg-[oklch(…/0.16)]` / `bg-[oklch(…/0.05)]` / `text-[oklch(…)]` — signup-form-builder.tsx:76,281 (the "friends" teal)
- `bg-[radial-gradient(circle,rgba(237,130,94,.16),transparent_70%)]` — auth-layout.tsx:14, dinners._index.tsx:79; `.20` variant site-nav.tsx:153 — the primary color re-encoded as raw rgba inside gradients (3×, 2 opacities)
- `bg-gray-950/85` — admin-dinner-form.tsx:110 (SaveBar)
- `text-red-300` / `text-red-200` — signup-form-builder.tsx:516
- Hairline drift: `border-foreground/12`, `border-foreground/8`, `border-white/10`, `border-white/20` (badge.tsx:12) vs theme `--border` (foreground/10)

(Legit/ignore: `bg-[var(--input-surface,var(--background))]` in input/textarea, `h-[var(--radix-*)]` in select, `data-[state=…]`/`group-[.toast]` selectors — these are mechanism, not drift.)

### 5.7 Off-grid spacing steps (Tailwind v4 allows any 0.25 step, but these sit between classic scale stops)

Half-steps above 3.5 (classic scale ends half-steps at 3.5):

- `gap-4.5` login:112, join:130, dinners_.$dinnerId:209, auth-layout:57,76, site-nav:212
- `size-4.5` checkbox.tsx:9,14,19, accordion.tsx:39, footer.tsx:45 · `px-4.5` button.tsx:24
- `gap-5.5` footer:46 · `size-5.5` site-nav:168, brand-lockup:25 · `px-5.5` site-nav:103,156 · `mb-5.5` dinners._index:43,60 · `p-5.5` dinner-card:40, dinners_.$dinnerId:209
- `py-6.5` auth-layout:75 · `pt-6.5` auth-layout:57 · `px-6.5` text-section:27 · `h-6.5` dinner-card:34 · `gap-6.5` site-nav:213
- `gap-7.5` site-nav:47 · `px-7.5` site-nav:172 · `h-7.5` (md:) dinner-card:34
- `py-8.5` text-section:27 · `pb-8.5` site-nav:172
- `h-9.5` button.tsx:24, auth-layout:88 · `py-9.5` dinners._index:76
- `h-11.5` hero/view:70 · `h-18.5` site-nav:44 · `h-72.5` hero:85

Off-scale whole numbers (not in classic 0-12,14,16,20,24… progression):

- `h-13` site-nav:206 · `-top-30` auth-layout:37 · `-right-15` auth-layout:58 · `w-25` admin signups:63 · `md:py-19`, `md:mb-18` dinners._index:76

(Standard half-steps ≤3.5 — `gap-1.5/2.5/3.5`, `py-0.5/1.5`, `px-2.5/3.5` etc. — are used ~40× and are fine; not listed.)

---

## 6. Harmonization priorities (suggested order)

1. **Radius**: settle the button radius (kill `rounded-[7px]/[9px]/[10px]` — 6 files) and define 2 card radius tiers. Cheapest win, most repeated drift.
2. **Type scale**: register the de-facto scales as theme tokens — body 13/15/17px and display 26/28/30/34/38 → md 32-52px — then replace all `text-[Npx]`. Fold the five `leading-[1.0x]` values into one "display" line-height.
3. **Eyebrow/kicker**: one component, two variants (tracked-uppercase, plain-kicker), color prop; fix the 5 tracking values.
4. **Color tokens**: theme-ify the teal oklch chip color, the radial-gradient glow (2 opacities of primary), `bg-gray-950/85`, and unify hairline borders on `--border`.
5. **Layout constants**: one content max-width (1040 vs 1080), one image/text split ratio (44/47/46%), named prose widths.
6. **Spacing**: decide whether off-grid steps (4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 13, 18.5…) are intentional optical tuning or drift; either bless a few named tokens or round to the classic scale.
7. **Buttons/badges**: add `icon-sm` size, a pill Badge variant, a shared secondary-CTA (border-b) component; decide the admin-vs-public heading voice question explicitly.
