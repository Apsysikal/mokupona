# CMS

Design notes for the block-based CMS. Pages (starting with the home page) are
rendered from blocks stored in the database. Each block is an opaque, versioned
chunk of JSON that a code-defined registry knows how to validate, migrate, and
render.

## Blocks

A block is a single row in the database:

```ts
type Block = {
  id: string; // row id
  kind: string; // which block type, e.g. "hero"
  version: number; // STORED version — a stable absolute identifier, NOT the chain length
  position: number; // order within the page
  pageId: string; // the page this block belongs to
  data: string; // JSON; opaque until validated against the kind's schema
};
```

`data` is just text until we run it through the block's schema. Everything a
block kind knows about itself lives in code, split across two definitions:

- a **view** (isomorphic) — the current schema and the components. Shipped to
  client and server.
- a **migration chain** (server only) — the old schemas and the functions that
  bring old data up to the current shape.

These feed two registries (see [Registries](#registries)).

## Defining a block

### The view — isomorphic (`hero.block.tsx`)

```ts
import { z } from "zod";
import { HeroComponent, HeroEditor } from "./hero-component";

export const heroSchema = z.object({
  heading: z.string(),
  subtitle: z.string(),
});

export const heroView = defineView(
  "hero",
  heroSchema,
  HeroComponent,
  HeroEditor,
);
```

`defineView` is a thin typed helper — it pins the components to the current
schema's shape so they can't drift from it:

```ts
function defineView<S extends z.ZodTypeAny>(
  kind: string,
  schema: S,
  component: React.ComponentType<{ data: z.infer<S> }>,
  editorComponent: React.ComponentType<{ data: z.infer<S> }>,
) {
  return { kind, schema, component, editorComponent };
}
```

### The migrations — server only (`hero.server.ts`)

```ts
import { z } from "zod";
import { heroView, heroSchema } from "./hero.block"; // importing a schema value is safe & isomorphic

// Old schemas live here — only migrations need them, so they never reach the client.
const heroV1 = z.object({ title: z.string() });
const heroV2 = z.object({ title: z.string(), subtitle: z.string() });

const heroMigrations = MigrationBuilder.from(heroV1)
  .migrate(heroV2, (d) => ({ ...d, subtitle: "" }))
  .migrate(heroSchema, (d) => ({ heading: d.title, subtitle: d.subtitle }))
  .seal(heroSchema); // compile error if the chain doesn't END at the current schema

export { heroMigrations };
```

## The MigrationBuilder

To create type-safe migrations we use a migrations builder. It brings all the
types together and keeps the data flow from migration to migration on track, and
it prevents _missing_ migrations because an incomplete chain won't compile.

`Head` is threaded through every `.migrate`, so each migration's input is typed
as the previous migration's output. A missing or out-of-order step won't compile
— **gaps are unrepresentable, not merely detected.** Versions are stable absolute
identifiers: the chain carries a `baseVersion` (the oldest schema it still holds)
and derives `currentVersion = baseVersion + schemas.length - 1`. Auto-numbering
keeps the no-gaps guarantee; the base only moves when a chain is truncated (see
[Truncating a chain](#truncating-a-chain)).

```ts
class MigrationBuilder<Head extends z.ZodTypeAny> {
  private constructor(
    private readonly baseVersion: number, // version of the OLDEST schema still held
    private readonly schemas: z.ZodTypeAny[], // every version still held, oldest first
    private readonly migrations: Array<(d: unknown) => unknown>,
    private readonly head: Head, // newest shape so far
  ) {}

  // `baseVersion` defaults to 1; it only moves when an old chain is truncated.
  static from<S extends z.ZodTypeAny>(v1: S, baseVersion = 1) {
    return new MigrationBuilder(baseVersion, [v1], [], v1);
  }

  // fn's input = current head, output = next schema; head advances to `next`
  migrate<Next extends z.ZodTypeAny>(
    next: Next,
    fn: (d: z.infer<Head>) => z.infer<Next>,
  ) {
    return new MigrationBuilder<Next>(
      this.baseVersion,
      [...this.schemas, next],
      [...this.migrations, fn as (d: unknown) => unknown],
      next,
    );
  }

  // `current` must infer to the same type the chain ends on, or this won't compile.
  // This is the compile-time stitch across the client/server file boundary.
  seal(current: z.ZodType<z.infer<Head>>) {
    return {
      baseVersion: this.baseVersion,
      currentVersion: this.baseVersion + this.schemas.length - 1, // stable absolute id
      schemas: this.schemas,
      migrations: this.migrations,
    };
  }
}
```

> `seal` catches renamed/missing fields cleanly; Zod's structural typing is
> looser about extra-optional fields, so treat it as a strong guard, not a
> perfect one.

## Registries

Two maps keyed by `kind`, matching the client/server split:

```ts
// block-registry.ts — isomorphic (client + server)
export const blockRegistry = {
  [heroView.kind]: heroView,
  // ...other views: { schema, component, editorComponent }
};

// migration-registry.ts — server only (never imported by the client)
// Keys are constrained to real views: the server file may import the isomorphic
// blockRegistry (imports flow server → isomorphic, nothing leaks back to the
// client), so a migration for a kind that has no view won't compile. `Partial`
// because a chain is optional — a kind still on v1 has no entry.
export const migrationRegistry = {
  hero: heroMigrations,
  // ...only kinds that have at least one migration
} satisfies Partial<Record<keyof typeof blockRegistry, MigrationChain>>;
```

- The **client** imports `blockRegistry` only.
- The **server** imports both. Migrations and old schemas never enter the client bundle.
- A kind still on v1 (no migrations yet) needs no `migrationRegistry` entry —
  `readBlock` falls back to `{ baseVersion: 1, currentVersion: 1, schemas: [currentSchema], migrations: [] }`.
  A new block kind only needs its view file until its first migration.

> **Kind drift — resolved by construction, no runtime assert.** `blockRegistry`
> is the single source of truth for the set of kinds. `type Kind = keyof typeof
blockRegistry` is exported isomorphically (the editor's "add a block" menu uses
> it). `migrationRegistry` is typed `Partial<Record<Kind, …>>`, so its keys can't
> drift from the views. The `ResolvedBlock` / `BlockInput` unions are _derived_
> from the registry (see [Pages](#pages)), never hand-maintained — adding a view
> grows them automatically. The only residue is a row whose kind was removed from
> code, which is data, not code, and is handled in `readBlock` (see below).

## Reading a block (server)

```ts
function readBlock(kind: string, storedVersion: number, raw: unknown) {
  const view = blockRegistry[kind];
  // Unknown kind = a row whose block type was removed from code. By invariant a
  // kind is only retired *after* its rows are removed (a ritual like truncation),
  // so a live unknown-kind row is a bug — throw loudly rather than degrade. This
  // guard sits ahead of the lookup because there's no schema/component/editor to
  // fall back to. Swappable for a status:"error" arm later; the change stays
  // local to readBlock + one union arm.
  if (!view) throw new Error(`block: unknown kind ${kind}`);
  const { schema } = view; // current schema (isomorphic)
  const chain = migrationRegistry[kind]; // chain (server only), may be absent

  // A kind with no chain behaves as a single-version chain at version 1.
  const baseVersion = chain?.baseVersion ?? 1;
  const currentVersion = chain?.currentVersion ?? 1;
  const schemas = chain?.schemas ?? [schema];
  const migrations = chain?.migrations ?? [];

  // Guard: stored version must fall inside the window the running code can serve.
  // Below base = a row a backfill missed; above current = data from newer code.
  if (storedVersion < baseVersion || storedVersion > currentVersion) {
    throw new Error(
      `block ${kind}: stored version ${storedVersion} outside [${baseVersion}, ${currentVersion}]`,
    );
  }

  const idx = storedVersion - baseVersion; // absolute id -> array index
  let value: unknown = schemas[idx].parse(raw); // 1. validate the STORED shape
  for (const m of migrations.slice(idx)) {
    // 2. types link the steps; no parse between
    value = m(value);
  }
  return schema.parse(value); // 3. validate the CURRENT shape before rendering
}
```

**Validation policy:** validate twice — the stored shape on the way in (raw DB
data is `unknown`), and the final shape before rendering. The steps between are
trusted because the types link them.

- _Alternative:_ parse at every step if you'd rather a broken migration blame
  itself at its own step. That catches _shape_ breaks earlier but not _logic_
  bugs (only tests catch those), at the cost of extra parses. **Chosen default:
  entry + final.**

**Performance:** with lazy migration (below), the chain runs on every read. To
prevent migrations running on every visit, a cache can be introduced later
(invalidated on the kind's current version). If a kind accumulates many
migrations and we want to drop old ones, that's done via a one-off backfill that
rewrites stored rows to the current version.

## Versions: stored vs current

There are two version numbers and they are deliberately different:

- **Stored version** — what's on the DB row right now. May be stale (e.g. `2`).
- **Current version** — the registry's latest (e.g. `3`), matching the one live
  component and schema.

Both are **stable absolute identifiers**, not positions in the chain: a stored
number always means the same schema, even after older versions are dropped.
`currentVersion` is derived as `baseVersion + schemas.length - 1`.

Migration is **lazy**: `readBlock` brings data up to the current shape on read,
but the migrated data is only **persisted on save** (the editor flow). So the DB
row stays at its stored version until a save catches it up — the gap between
stored and current is the normal steady state, not an edge case.

The version never crosses to the client. The loader returns data already
migrated to the current shape, and the server stamps `currentVersion` on save
(see [Pages](#pages)), so the client has no use for a version number. Keeping it
server-only means stored-vs-current can't leak as a client concern at all.

## Truncating a chain

Old schemas are server-only, so a long chain costs nothing on the client and the
read cache covers the per-read cost — truncation is for code tidiness, not
performance, and isn't needed until a chain gets genuinely unwieldy. When it is,
the ritual is three steps that only make sense together:

1. **Backfill** every row of the kind up to `currentVersion` (the one-time eager
   sweep that breaks laziness — unedited rows won't migrate on their own).
2. **Re-base** the chain: drop the leading schemas and migrations and pass the
   new oldest version to `MigrationBuilder.from(schema, baseVersion)`. Stored
   numbers keep their meaning — that's the whole point of absolute versions.
3. **Deploy.** Any straggler the backfill missed now trips `readBlock`'s bounds
   guard loudly instead of mis-indexing silently.

> _Note:_ before the first truncation, add a test that fails if any kind's
> `currentVersion` ever decreases across commits — deferred until truncation is real.

## Client / server split

- **Client** needs: current `schema`, `component`, `editorComponent`, optionally
  default data. (`blockRegistry`.)
- **Server** needs: all of the above **plus** the migration chain, because it
  migrates `data` after reading old rows from the DB. (`blockRegistry` +
  `migrationRegistry`.)

## Rendering flows

### Public page

```tsx
const page = await loadPage(slug); // loader runs readBlock per block; data is current-shaped

return (
  <>
    {page.blocks.map((block) => {
      const { component: Component } = blockRegistry[block.kind];
      return <Component key={block.id} data={block.data} />;
    })}
  </>
);
```

### Editor

1. Load the page; each block resolves to its current shape (the form's default
   values). A block that fails _data_ validation comes back `status: "error"`;
   the editor seeds the form with salvaged values and flags what it reset (see
   [Salvaging broken blocks](#salvaging-broken-blocks)) so it's fixed in place,
   never crashing its `editorComponent`. Delete is always available.
2. Render each block's `editorComponent` with that data.
3. Compose the page form schema via `buildPageSchema()` (from `blockRegistry`,
   Conform). React list keys come from Conform, not the block id.
4. Add / move / delete are **form-only** intents (`insert` / `remove` /
   `reorder`) — they mutate the form, never the DB. Progressively enhanced: move
   buttons work without JS; drag is a JS-only layer on top.
5. On save, the whole ordered list goes to `updatePage` (see [Pages](#pages)).
   Strict: a block must be valid to be saved, so broken blocks are fixed or
   deleted first; delete never requires valid data.

New blocks take default data from the schema, or render the form empty.

## Default data

Defined on the schema where needed:

```ts
const schema = z.object({ heading: z.string().default("Untitled") });
```

## Salvaging broken blocks

When a row fails its **entry** validation (bad data, not a bad migration — see
[Reading a block](#reading-a-block-server)), the editor neither crashes nor drops
to a raw-JSON editor. It runs a flat, best-effort `salvage`: parse each field on
its own, keep what's valid, fall back to the field's `.default()` for the rest,
and return the names of the fields it had to reset so the editor can show an error
beneath the block. The salvaged object seeds the form as a _draft_ — a field with
no default that couldn't be recovered stays empty and the form flags it, so the
strict save-gate still guarantees only valid blocks persist.

Salvage lives **beside** the canonical schema, never inside it: the schema stays
strict so `readBlock` and the public renderer keep detecting brokenness. Flat
objects only — a nested/array field that fails is reset whole, not recursed into.

```ts
function salvage<S extends z.ZodObject<z.ZodRawShape>>(
  schema: S,
  raw: unknown, // the failed row's parsed JSON — may be anything
): { data: Partial<z.infer<S>>; reset: string[] } {
  const data: Record<string, unknown> = {};
  const reset: string[] = [];
  for (const [key, field] of Object.entries(schema.shape)) {
    const hit = field.safeParse((raw as any)?.[key]);
    if (hit.success) {
      data[key] = hit.data; // valid as-is (a missing field with a .default() lands here too)
      continue;
    }
    reset.push(key); // unreadable — note it for the message under the block
    const def = field.safeParse(undefined); // recover the field's .default() if it has one
    if (def.success) data[key] = def.data; // else leave empty; the form flags it on save
  }
  return { data: data as Partial<z.infer<S>>, reset };
}
```

> Migration bugs (final-parse failures) and out-of-bounds rows are _not_ salvaged
> — the data was fine, the fault is ours. Those render read-only and alert us
> rather than inviting an editor to overwrite good data with a lossy fix.

## Pages

A page holds metadata and an ordered list of blocks, hidden behind a service layer.

```ts
// The stored Block (data: string) is the raw DB row; it never leaves the
// persistence layer. ResolvedBlock is the READ output — validated + migrated to
// the current shape, discriminated on kind, carrying validation status because a
// stored row might be broken (provenance).
// `Kind` and both unions derive from blockRegistry — never hand-maintained.
// Adding a view grows them automatically, so they can't drift from the kind set.
type Kind = keyof typeof blockRegistry;
type DataOf<K extends Kind> = z.infer<(typeof blockRegistry)[K]["schema"]>;

type ResolvedBlock =
  | {
      [K in Kind]: { id: string; kind: K; status: "ok"; data: DataOf<K> };
    }[Kind]
  | {
      id: string;
      kind: string;
      status: "error";
      error: z.ZodError;
      raw: string;
    };

// BlockInput is the WRITE input — typed domain data the editor's action has
// already validated. No status/error arm (form data is valid or never submitted),
// `id` optional (absence = insert). Read carries provenance; write carries intent.
type BlockInput = {
  [K in Kind]: { id?: string; kind: K; data: DataOf<K> };
}[Kind];

type Page = {
  id: string; // identity — updatePage keys by this
  slug: string; // mutable metadata (user-editable URL) — getPage keys by this
  title: string;
  description: string;
  blocks: ResolvedBlock[]; // ordered; resolved, may be status: "error"
};

type PageService = {
  getPage: (slug: string) => Promise<Page>;
  // Keyed by id. `blocks` is the full ordered desired state — already valid
  // BlockInput (the action validated the form; the service may defensively
  // re-parse domain data, but never touches raw form data). `id` absent = insert.
  updatePage: (input: {
    id: string;
    slug: string;
    title: string;
    description: string;
    blocks: BlockInput[];
  }) => Promise<void>;
};
```

`updatePage` is a command (returns `void` — after save the editor's loader
revalidates and re-reads through `getPage`). In one transaction it diffs the
incoming blocks against the page's stored rows **by id**:

- id **absent** → insert (the DB default mints the cuid),
- id **present** → update,
- a stored id **missing from the payload** → delete.

`position` is renumbered from array order; `currentVersion` is stamped
server-side. Writes are scoped to the page (`WHERE pageId = …`).

## Open / deferred decisions

- **Per-block render failure (public path)** — resolved blocks carry
  `status: "error"`; still to decide whether the _public_ renderer shows a
  fallback, skips, or fails the page. (Editor path is settled: strict — fix or
  delete before save.)

Resolved during design:

- **Kind drift** — `blockRegistry` is the single source of truth. `Kind`,
  `ResolvedBlock`, and `BlockInput` derive from it; `migrationRegistry` is keyed
  `Partial<Record<Kind, …>>`. Drift between the registries and the unions is
  unrepresentable, so no startup assert is needed. (See
  [Registries](#registries).)
- **Retired block kinds** — deleting a block kind is a ritual like truncation:
  its rows are removed or rewritten _first_. A live row of an unknown kind is
  therefore a bug, and `readBlock` throws loudly. Reversible to a graceful
  `status: "error"` arm later, kept local to `readBlock`.

- **Block ordering** — whole-list-replace renumbers `position` from array order
  on save; fractional indexing only reopens if we move to incremental (per-intent) saves.
- **Page form composition** — the form schema lives in the registry/form layer
  (not `PageService`), behind a single `buildPageSchema()` derived from
  `blockRegistry`: index-based `z.array(discriminatedUnion("kind", …))`, imported
  by the editor's action to validate the form. Global today (every page accepts
  every block, any order); per-page restrictions (allowed kinds, positioning)
  would make it `buildPageSchema(pageContext)` — that one function is the seam,
  deferred until needed. Render stability uses Conform's managed list key, not
  the block id.
- **Block identity** — client/editor never mints ids; absent id ⇒ insert (DB
  mints the cuid), present id ⇒ update. (Concurrent edits / stale clients out of
  scope for now.)
