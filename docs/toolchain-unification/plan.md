# Unifying the toolchain on oxc — Plan

Status: **exploration, revised 2026-08-16**. Nothing is wired up. This
documents what was measured against the current `dev` tree, which pieces
transfer cleanly, which do not, and a staged order to adopt them in. The
candidate configs next to this file are runnable — copy them to the repo root
to reproduce anything below.

The first revision was corrected in three places after the migration was
actually carried out on a branch: the `import/order` warning count and what
`sortImports` does to it (the reason it is now **deferred**), the type-aware
finding count, and the stage ordering. Corrections are marked inline rather
than quietly edited, since the original was already published.

## The finding

**Half the migration already happened.** We are on Vite 8, and Vite 8 depends
on Rolldown directly:

```
$ node -e "console.log(require('vite/package.json').dependencies)"
{ lightningcss: '^1.33.0', picomatch: '^4.0.5', postcss: '^8.5.23',
  rolldown: '~1.2.0', tinyglobby: '^0.2.17' }
```

There is no Rollup in the tree. Rolldown embeds oxc as its parser and
transformer, so oxc is already what parses and compiles every file in
`npm run build` (client 1.68s + SSR 0.56s, 3.3s wall). Nobody had to decide
that — it arrived with the Vite 8 upgrade.

What is still _not_ oxc is the part we own the config for: **ESLint 10** with
six plugins, **Prettier 3** with `prettier-plugin-tailwindcss`, and **tsc**.
That is the whole scope of this document.

## What it buys, measured

All numbers from this repo (273 source files, 336 files seen by the
formatter), binaries invoked directly, three runs each, median:

| Step             | Today                            | oxc equivalent              | Delta       |
| ---------------- | -------------------------------- | --------------------------- | ----------- |
| Lint, cold cache | `eslint .` — **3.33s**           | `oxlint` — **0.21s**        | −3.1s, 15×  |
| Lint, warm cache | `eslint --cache` — **1.23s**     | `oxlint` — **0.21s**        | −1.0s       |
| Format check     | `prettier --check .` — **4.90s** | `oxfmt --check` — **1.93s** | −3.0s, 2.5× |
| Typecheck        | `tsc` — **8.28s**                | unchanged                   | —           |

**Speed is not the argument.** Saving three seconds on a CI job that spends
far longer on `npm ci` is noise, and warm-cache ESLint is already within a
second of oxlint. The honest case for this is the other column: **four tools
and ~130 lines of lint/format config collapse to two binaries and two JSON
files**. Ten devDependencies go away (`eslint`, its five plugins, `globals`,
`typescript-eslint`, `prettier`, `prettier-plugin-tailwindcss`) and three
arrive (`oxlint`, `oxlint-tsgolint`, `oxfmt`) — net −7. And
`oxlint --type-aware` gives us a rule class we do not have today (below). Take
it for the config surface, not the stopwatch.

## Lint: what transfers, verified rule by rule

Each of these was checked by feeding oxlint the translated config and reading
back whether it accepts the rule, then by planting a deliberately violating
file to confirm it actually fires.

| `eslint.config.js` rule                      | oxlint | Note                                         |
| -------------------------------------------- | ------ | -------------------------------------------- |
| `no-restricted-imports` (DAL guard)          | ✅     | Fires, same message, same `app/**` scoping   |
| `react-hooks/rules-of-hooks`                 | ✅     | 1:1                                          |
| `react-hooks/exhaustive-deps`                | ✅     | 1:1                                          |
| `@typescript-eslint/consistent-type-imports` | ✅     | as `typescript/consistent-type-imports`      |
| `react/jsx-no-leaked-render`                 | ❌     | **No oxlint equivalent.** See below          |
| `import/order`                               | ❌     | Not implemented, deliberately. See below     |
| `eslint-plugin-jest-dom`                     | n/a    | Registered with **zero rules enabled** today |
| `eslint-plugin-cypress`                      | n/a    | Registered with **zero rules enabled** today |

The last two rows are free: both plugins are declared in `eslint.config.js`
but neither block sets any rules, so they lint nothing. Dropping them costs us
nothing we currently have.

The DAL guard from `docs/data-access-layer` is the rule that most needs to
survive a migration, and it does. Probe file importing `~/db.server` from
`app/`:

```
$ oxlint app/__probe.tsx
app/__probe.tsx:1:1: error eslint(no-restricted-imports): '~/db.server' import is
restricted from being used by a pattern. help: Only app/models/** may import the
database layer. Use or add a model function instead.
```

### `react/jsx-no-leaked-render` is a real loss

There is no oxlint port, and no near-equivalent under another name —
`react/no-leaked-conditional-rendering` is not registered either. The same
probe file confirms ESLint catches `{items.length && <span/>}` today and
oxlint says nothing about it.

The cost is bounded, though. The rule flags zero files today, and a direct
grep shows why: **there is not a single `&&` inside a JSX expression container
anywhere in the repo.** All 27 `&&` occurrences in `app/**/*.tsx` are in
`cn()` class strings, plain JS conditions, or object spreads. Conditional
rendering is uniformly ternary (`{eyebrow ? (…) : null}`) — exactly the
`validStrategies: ["ternary"]` the rule was configured for. So it has been
enforcing a convention the codebase already follows by hand.

Upstream status: no dedicated tracking issue, only the umbrella oxc#1022
(open since 2023, _Help Wanted_). Four port attempts in eight months — two
abandoned, one stalled, one (oxc#23536) ready-for-review since June with no
maintainer review and no stated technical blocker. Plausible it lands; not
something to plan a date around. Accept the gap: dropping it turns a
convention from enforced to conventional, with zero current exposure.

### `import/order` is not coming, and that is on purpose

oxc has declined to implement `import/order` — the position is that the
configuration surface is too large and that the behaviour belongs in the
formatter. oxfmt's `sortImports` (a port of the
`eslint-plugin-perfectionist/sort-imports` algorithm) is the intended
replacement. That makes import ordering a **formatting** concern here, not a
lint concern, which is a genuine change in how the repo thinks about it.

### Bonus: type-aware rules we do not have today

`oxlint --type-aware` (via `oxlint-tsgolint`, tracking typescript-go) runs in
**1.9s** and found **10** real things on a clean tree (an earlier revision of
this document said 6 — it listed only the notable ones):

- 4 × `no-floating-promises` in `cypress/support/` (`create-invite.ts:38`,
  `create-role-session.ts:24`, `create-user.ts:28`, `delete-user.ts:30`) —
  each entry script drops the promise from its async main
- 3 × `no-base-to-string` (`app/routes/dinners_.$dinnerId.tsx:140`,
  `join.tsx:55`, `join.tsx:105`) — a rejected Conform payload is unvalidated,
  so `submission.payload["email"]` can be an object and writes
  `[object Object]` into the field you then search on
- 1 × `unbound-method` at `app/features/images/image-form-action.server.ts:18`
- 1 × `restrict-template-expressions` in `app/features/forms/fields/non-list.ts`
  — the exhaustiveness guard's message reads `Unhandled case for type:
[object Object]`
- 1 × `no-useless-default-assignment` in `app/features/cms/blocks/hero/view.tsx`

Two more worth turning on deliberately, from a sweep of oxlint's full rule
surface:

- **`typescript/no-misused-promises`** — 4 hits, 2 of them live bugs in auth
  UI. `app/features/auth/components/google-button.tsx:36` and
  `app/routes/me.tsx:424` both do `onClick={() => authClient.someAsync(...)}`.
  A network failure there is an unhandled rejection: sign-in or account
  linking fails silently, with no feedback.
- **`typescript/only-throw-error`** with
  `allow: [{ from: "lib", name: "Response" }]` — bare it fires 13 times on our
  own `throw new Response(...)` / `throw redirect(...)` idiom; with `Response`
  allowlisted it is **exactly 0** while still catching a thrown string or
  plain object. A free permanent guard on an idiom used in every loader,
  action and guard.

The rest of oxlint's ~626 rules are not worth sweeping in. `style` alone
produces 5,906 findings and `restriction` 2,878. One trap to know about:
the `suspicious` category looks reasonable at 1,303 findings, but **1,205 of
those are `react/react-in-jsx-scope`**, which is simply wrong for React 19's
automatic runtime. If that category is ever enabled, that rule must be
explicitly `off`.

Getting typed linting under ESLint would mean adding
`typescript-eslint`'s type-checked configs and paying tsc-project-service
costs on every lint run. Here it is a flag and two seconds. This is the most
concrete _capability_ gain in the whole exercise, and it is independent of
everything else — it could be adopted on its own.

## Format: oxfmt is closer than expected

`oxfmt --migrate=prettier` read our config out of `package.json` and
translated it, including the Tailwind plugin:

```
Found Prettier configuration at: /home/user/mokupona/package.json
  - "printWidth" is not set in Prettier config, defaulting to 80
  - Migrated prettier-plugin-tailwindcss options to sortTailwindcss
  - Migrated ignore patterns from `.prettierignore`
```

**Tailwind class sorting is byte-identical.** Deliberately scrambled classes,
both formatters:

```jsx
// input
<div className="text-sm p-4 flex bg-red-500 items-center hover:bg-red-600 md:p-8">
// prettier + prettier-plugin-tailwindcss AND oxfmt, identical output:
<div className="flex items-center bg-red-500 p-4 text-sm hover:bg-red-600 md:p-8">
```

With `sortImports` off, running oxfmt over the whole repo touches **2 source
files** — both the same union-type wrap, which oxfmt writes in the leading-`|`
style:

```diff
-export type AutoLinkPart =
-  { type: "text"; value: string } | { type: "link"; url: string };
+export type AutoLinkPart =
+  | { type: "text"; value: string }
+  | { type: "link"; url: string };
```

It also reformats `fly.toml`, which Prettier never touched — oxfmt formats
TOML. The candidate config adds `fly.toml` to `ignorePatterns` to keep that
out of scope.

**The catch: oxfmt is at 0.63.0**, versus oxlint's mature 1.78.0. But the
0.x label overstates the risk, and this was measured rather than assumed:
the same 278 source files formatted with seven pinned oxfmt versions from
0.30.0 (February) through 0.63.0 (August) — 34 minor releases, six months —
produce byte-identical output in **all but one file**. And that one change was
a _convergence_: 0.63.0's output for
`app/features/images/providers/cloudinary.server.ts` is byte-identical to
Prettier 3.9.6 where 0.57.0's was not. The drift moved toward the oracle.

What keeps this from being a non-issue:

- **There is no 1.0 date.** oxfmt's Q3 2026 goal is removing the last Prettier
  dependency for Markdown; the 1.0 on the roadmap is for the oxc compiler
  core, not the formatter.
- **Output changes ship as bug fixes, not breaking changes.** Across 64
  releases, the 8 `[BREAKING]` entries are about which backend owns a file
  type and about config schema — never JS layout. So the changelog will not
  warn you before a reformat.
- One open non-idempotency bug (oxc#24960, leading line comments on a
  trailing call argument).

The mitigation is the version range: on a 0.x version npm's caret pins the
minor, so `"oxfmt": "^0.63.0"` accepts 0.63.5 but not 0.64.0. Every
output-affecting upgrade becomes a deliberate, reviewable act. That is what
Sentry (`^0.60.0`), Turborepo (`^0.34.0`) and openclaw (exact `0.60.0`) all
do. **Low risk if pinned; medium if left to float.**

## The 117-file question — defer it

**Correction.** An earlier revision of this document claimed the `sortImports`
commit "fixes the 11 `import/order` warnings" and that "ESLint's 11 standing
warnings go to zero." Both halves are wrong. That was inferred from reading a
diff, not measured. Measured on a pristine `git archive` of HEAD with the
generated Prisma client in place:

| Tree                         | `import/order` warnings |
| ---------------------------- | ----------------------- |
| Today                        | **0**                   |
| oxfmt, `sortImports` **off** | **0**                   |
| oxfmt, `sortImports` **on**  | **156**                 |

Two separate errors fed the wrong claim.

**The 11 warnings were an environment artifact, not a standing debt.** They
appear only when `prisma/generated/` is absent — `eslint-plugin-import-x`
cannot resolve `#prisma/generated/client`, so it misclassifies the import
group and objects to a blank line that is in fact correct. Isolated directly:

```
without prisma/generated  →  11 import/order warnings
with    prisma/generated  →   0
```

There is no `postinstall` in `package.json`, and the CI lint job runs only
`npm ci` before `npm run lint`. So those 11 warnings were **CI-only, and
nobody could reproduce them locally.** That is worth fixing on its own merits,
whatever happens to the linter (see "Two fixes worth making regardless").

**And `sortImports` does not resolve `import/order` — it collides with it.**
156 warnings, of which 49 are "type import should occur before import of X".
oxfmt and `eslint-plugin-import-x` disagree structurally on where type imports
go and on how `~/` is classified. Tuning oxfmt toward perfectionist's
documented group order makes it worse, not better (268 warnings, 128 files of
churn).

That collision is harmless _if_ ESLint is leaving at the same time — the rule
disappears with it. What makes deferral the right call is the **rollback
asymmetry**:

- Reverting the formatter is free. Running our Prettier 3.9.6 +
  `prettier-plugin-tailwindcss` over an oxfmt-formatted tree changes **0
  files** — Prettier accepts oxfmt's output byte-for-byte, import order
  included, because Prettier does not reorder imports.
- Reverting the import sorting is not. `eslint --fix` over the sorted tree
  touches 102 files and lands in a **third** distinct ordering, still
  differing from today's tree in 108 files. You do not get your bytes back. A
  `git revert` restores them exactly, but after months of development across a
  116-file blast radius, expect conflicts in most of them.

So `sortImports` is the one irreversible step in this migration, and the
reason originally given for taking it early was false. Defer it. Revisit when
oxfmt hits 1.0 or when `sortNamedImports` (oxc#23456) lands — by then ESLint
is gone, there is no `import/order` to contradict, and it becomes a choice to
_add_ import ordering rather than to _migrate_ it.

## Vite+

Vite+ went beta on 2026-07-01 (alpha in March), and is **MIT-licensed and
free** — VoidZero considered a paid enterprise tier and dropped it. `vp`
wraps exactly the tools discussed here — Vite, Vitest, Rolldown, Oxlint,
Oxfmt, tsdown — plus a monorepo-aware task runner, and adds `vp check`
(format + lint + typecheck in one) and `vp migrate`.

**Caveat: I could not test it.** Vite+ installs via
`curl -fsSL https://vite.plus | bash`, and both `vite.plus` and `voidzero.dev`
are blocked by this environment's egress proxy, so everything in this section
is desk research while everything above is measured. Someone should run `vp`
locally before we commit to it.

That said, the shape of the value is clear enough to judge: the headline
features are **monorepo task graphs, task caching, and managing the runtime
and package manager**. This repo is a single app on npm with four independent
CI jobs and a 3.3s build. There is no task graph to cache. `vp check` is nice,
but it is `oxfmt --check && oxlint && tsc` behind one word, and an npm script
does that today.

Nothing is lost by waiting: Vite+ reads the same `.oxlintrc.json` and
`.oxfmtrc.json` we would write anyway, so adopting oxlint and oxfmt directly
_is_ the migration path into Vite+, not a detour from it.

## Two fixes worth making regardless

Both surfaced while measuring this, and neither depends on migrating
anything. They are the cheapest wins in the document.

**1. The CI lint job never generates types.** It runs `npm ci` then
`npm run lint`, with no `prisma generate` and no `react-router typegen`. That
is the sole cause of the 11 phantom `import/order` warnings above, and under
type-aware linting it would additionally produce 7 bogus
`no-redundant-type-constituents` findings from unresolved error types. Two
steps in `.github/workflows/ci.yml` fix it permanently.

**2. ESLint is not linting `cypress/` at all.** `cypress/eslint.config.js`
exists, enables no rules, and names no `files` patterns. ESLint 10 resolves
config from the linted file's directory, so that file shadows the root config
for everything beneath it. Measured: of 257 files linted, **exactly one** is
under `cypress/` — the config itself. All 16 spec and support files have been
silently unlinted. Deleting that file brings them under the root config.

This also explains why the 4 `no-floating-promises` in `cypress/support/`
survived: no linter was ever looking at them.

## Recommendation — staged, and `sortImports` deferred

The earlier revision sequenced formatter-first on the reasoning that
"`import/order` can only be dropped from ESLint once oxfmt owns import
sorting." That is false. `import/order` can simply be dropped — oxlint does
not implement it, so it lapses when ESLint leaves, and nothing has to take
ownership of it. Removing that false dependency frees the two migrations to
be sequenced on their own merits.

**Stage 1 — oxlint replaces ESLint.** Add `oxlint` + `.oxlintrc.json`, turn
on `--type-aware` with `oxlint-tsgolint`, fix the 10 findings it surfaces,
drop `eslint` and its seven plugins. Add the two generator steps to the CI
lint job and delete `cypress/eslint.config.js`. Budget for oxlint's default
rules surfacing ~34 findings ESLint never had — most are test-file style
rules to scope or disable, and 5 are genuine false positives (chai property
getters in Cypress, a custom assertion helper) that need config, not code
changes. This stage is pure gain and depends on nothing else.

**Stage 2 — oxfmt replaces Prettier, `sortImports` off.** Drop `prettier`,
`prettier-plugin-tailwindcss`, and the `prettier` block in `package.json`.
One reformat commit, **2 files**. Pin `"oxfmt": "^0.63.0"` — on a 0.x version
the caret pins the minor, so every output-affecting upgrade becomes an
explicit, reviewable act. Rollback verified free.

**Stage 3 — `sortImports`, later and on its own merits.** See above. Not part
of this migration.

**Stage 4 — reassess Vite+.** Once oxfmt reaches 1.0 and someone has run `vp`
on a branch.

## What I would not do

- **Do not sell this on speed.** The wall-clock win is ~3s per CI job.
- **Do not take `sortImports` with the formatter.** It is the only
  irreversible step here, and the reason first given for it was wrong.
- **Do not adopt `vp` as the entry point yet** — beta, untested here, and its
  strengths are monorepo problems this repo does not have.
- **Do not run oxlint and ESLint side by side** beyond a short verification
  window. Two linters is a worse position than either one alone. This
  includes recovering `react/jsx-no-leaked-render` by loading
  `eslint-plugin-react` through oxlint's alpha JS-plugin API — it costs an
  alpha dependency to regain one preventive rule with zero exposure.

## Files here

- `oxfmtrc.candidate.json` — output of `oxfmt --migrate=prettier`, with
  `sortImports` **off** (deferred, see above) and `fly.toml` ignored because
  oxfmt formats TOML and Prettier did not. The migrator's other
  `ignorePatterns` were dropped: oxfmt reads `.gitignore` by default, which
  already covers them, verified by identical `--list-different` output with
  and without. One of them (`/app/styles/tailwind.css`) was a dead path
  anyway — the file is at `app/tailwind.css`, so Prettier has been formatting
  it all along despite the ignore.
- `oxlintrc.candidate.json` — hand-translated from `eslint.config.js`, with
  the two unsupported rules removed and the vitest plugin scoped to test files
  (it otherwise fires `valid-expect` on Cypress specs). Copy to
  `.oxlintrc.json`. Note this is the _parity_ config; a real migration also
  needs to disposition the ~34 findings oxlint's defaults add (mostly vitest
  style rules, plus `no-unused-expressions` off for `cypress/**`, where chai
  property getters read as unused expressions).

Editor setup, for personal config — there is no devcontainer to pin it in:
the official extension is **`oxc.oxc-vscode`**, and it covers both oxlint and
oxfmt. Format-on-save needs `editor.formatOnSaveMode: "file"`, since oxfmt
formats whole files and not ranges. Beware `alphatr.oxc-vscode-enhance`, a
similarly-named third-party extension.

Reproduce with:

```sh
npm i -D --no-save oxlint@latest oxlint-tsgolint@latest oxfmt@latest
cp docs/toolchain-unification/oxlintrc.candidate.json .oxlintrc.json
cp docs/toolchain-unification/oxfmtrc.candidate.json .oxfmtrc.json
./node_modules/.bin/oxlint --type-aware
./node_modules/.bin/oxfmt --check
```

Versions measured: oxlint 1.78.0, oxfmt 0.63.0, oxlint-tsgolint (TypeScript
v7 line), against vite 8.2.0 / vitest 4.1.10 / eslint 10.8.0 / prettier 3.9.6
/ typescript 6.0.3.
