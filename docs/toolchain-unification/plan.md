# Unifying the toolchain on oxc — Plan

Status: **exploration, 2026-08-16**. Nothing is wired up. This documents what
was measured against the current `dev` tree, which pieces transfer cleanly,
which do not, and a staged order to adopt them in. The candidate configs next
to this file are runnable — copy them to the repo root to reproduce anything
below.

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

The cost is bounded, though: **the rule currently flags zero files in the
repo.** It is purely preventive. So the choice is to accept the gap until oxc
ports it, not to un-fix existing code.

### `import/order` is not coming, and that is on purpose

oxc has declined to implement `import/order` — the position is that the
configuration surface is too large and that the behaviour belongs in the
formatter. oxfmt's `sortImports` (a port of the
`eslint-plugin-perfectionist/sort-imports` algorithm) is the intended
replacement. That makes import ordering a **formatting** concern here, not a
lint concern, which is a genuine change in how the repo thinks about it.

### Bonus: type-aware rules we do not have today

`oxlint --type-aware` (via `oxlint-tsgolint`, tracking typescript-go) runs in
**1.9s** and found real things on a clean tree:

- 4 × `no-floating-promises` in `cypress/support/` (`create-invite.ts:38`,
  `create-role-session.ts:24`, `create-user.ts:28`, `delete-user.ts:30`)
- 1 × `no-base-to-string` at `app/routes/dinners_.$dinnerId.tsx:140` —
  `submission.payload["email"]` may stringify as `[object Object]`
- 1 × `unbound-method` at
  `app/features/images/image-form-action.server.ts:18`

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

**The catch: oxfmt is at 0.63.0.** oxlint is at 1.78.0 and mature; the
formatter is explicitly pre-1.0, and `sortImports` sits behind that. Two
files of drift today says nothing about drift after the next six minor
releases. This is the single biggest reason to stage rather than do it all at
once.

## The 117-file question

Turning on `sortImports` rewrites **117 files, +251/−281**. Two things about
that:

It is not arbitrary churn — it _fixes_ the 11 `import/order` warnings ESLint
has been emitting continuously (all "There should be no empty line within
import group", across `app/models/*.server.ts` and friends). And oxfmt's
default `internalPattern` is `["~/", "@/", "#"]`, which already matches both
of our aliases, so `~/db.server` and `#prisma/generated/client` land in the
internal group with no configuration:

```diff
 import type { Prisma, Role, User } from "#prisma/generated/client";
-
 import { prisma } from "~/db.server";
```

It also corrects grouping ESLint was missing. In `app/root.tsx` the
`~/features/**` imports currently sit _after_ the `./`-relative ones; oxfmt
moves them to the internal group ahead of parent/sibling, which is what
`eslint.config.js` asks for and `import-x` was not enforcing (no resolver is
configured for `~/`, so it never classified those as internal).

Practically: one mechanical commit, added to `.git-blame-ignore-revs`, landed
on its own when no long-lived branches are open.

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

## Recommendation — staged, formatter first

The order matters: `import/order` can only be dropped from ESLint once oxfmt
owns import sorting, so the formatter has to move first.

**Stage 1 — oxfmt replaces Prettier.** Drop `prettier`,
`prettier-plugin-tailwindcss`, and the `prettier` block in `package.json`;
add `oxfmt` and `.oxfmtrc.json` with `sortImports` **off**. One reformat
commit, 2 files. `npm run format` becomes `oxfmt`. Reversible in a single
revert.

**Stage 2 — import sorting moves to the formatter.** Set
`"sortImports": true`, delete the `import/order` block and the
`eslint-plugin-import-x` dependency. One mechanical commit, 117 files,
blame-ignored. ESLint's 11 standing warnings go to zero.

**Stage 3 — oxlint replaces ESLint.** Add `oxlint` + `.oxlintrc.json`
(candidate attached, verified), turn on `--type-aware` with
`oxlint-tsgolint`, fix the 6 findings it surfaces, drop `eslint` and its six
plugins. `npm run lint` becomes `oxlint --type-aware`; the ESLint CI job
keeps its name. This is where we accept losing `react/jsx-no-leaked-render`
(zero current violations) rather than keeping a second linter alive for one
rule — running both would be the opposite of unifying.

**Stage 4 — reassess Vite+.** Once oxfmt reaches 1.0 and someone has run `vp`
on a branch. `vp check` and `vp test` would then replace three npm scripts,
and the configs from stages 1–3 carry over unchanged.

Stages 1–3 are each independently revertible and each land a real reduction.
Stage 3 alone is also defensible as a first move if the 117-file commit is
unwelcome right now — the type-aware findings do not depend on the formatter.

## What I would not do

- **Do not sell this on speed.** The wall-clock win is ~3s per CI job.
- **Do not adopt `vp` as the entry point yet** — beta, untested here, and its
  strengths are monorepo problems this repo does not have.
- **Do not run oxlint and ESLint side by side** beyond a short verification
  window. Two linters is a worse position than either one alone.

## Files here

- `oxfmtrc.candidate.json` — output of `oxfmt --migrate=prettier`, plus
  `sortImports: true` and the `fly.toml` ignore. Copy to `.oxfmtrc.json` to
  reproduce.
- `oxlintrc.candidate.json` — hand-translated from `eslint.config.js`, with
  the two unsupported rules removed and the vitest plugin scoped to test files
  (it otherwise fires `valid-expect` on Cypress specs). Copy to
  `.oxlintrc.json`.

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
