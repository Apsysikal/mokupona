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
  version: number; // the schema version the `data` was written at (the STORED version)
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
— **gaps are unrepresentable, not merely detected.** `version` is derived from
the chain length, so it can't drift from the schema.

```ts
class MigrationBuilder<Head extends z.ZodTypeAny> {
  private constructor(
    private readonly schemas: z.ZodTypeAny[], // every version, oldest first
    private readonly migrations: Array<(d: unknown) => unknown>,
    private readonly head: Head, // newest shape so far
  ) {}

  static from<S extends z.ZodTypeAny>(v1: S) {
    return new MigrationBuilder([v1], [], v1);
  }

  // fn's input = current head, output = next schema; head advances to `next`
  migrate<Next extends z.ZodTypeAny>(
    next: Next,
    fn: (d: z.infer<Head>) => z.infer<Next>,
  ) {
    return new MigrationBuilder<Next>(
      [...this.schemas, next],
      [...this.migrations, fn as (d: unknown) => unknown],
      next,
    );
  }

  // `current` must infer to the same type the chain ends on, or this won't compile.
  // This is the compile-time stitch across the client/server file boundary.
  seal(current: z.ZodType<z.infer<Head>>) {
    return {
      version: this.schemas.length,
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
export const migrationRegistry = {
  hero: heroMigrations,
  // ...only kinds that have at least one migration
};
```

- The **client** imports `blockRegistry` only.
- The **server** imports both. Migrations and old schemas never enter the client bundle.
- A kind still on v1 (no migrations yet) needs no `migrationRegistry` entry —
  `readBlock` falls back to `{ version: 1, schemas: [currentSchema], migrations: [] }`.
  A new block kind only needs its view file until its first migration.

> **Deferred decision:** nothing guarantees the two maps agree on the set of
> kinds (a kind in one but not the other). `seal` ties each chain to its schema,
> but cross-registry completeness is a runtime concern. A startup assert (every
> kind in `blockRegistry` either has a `migrationRegistry` entry or is
> intentionally absent) would buy it back with a legible error. Left to
> implementation for now.

## Reading a block (server)

```ts
function readBlock(kind: string, storedVersion: number, raw: unknown) {
  const { schema } = blockRegistry[kind]; // current schema (isomorphic)
  const chain = migrationRegistry[kind]; // chain (server only), may be absent
  const schemas = chain?.schemas ?? [schema];
  const migrations = chain?.migrations ?? [];

  let value: unknown = schemas[storedVersion - 1].parse(raw); // 1. validate the STORED shape
  for (const m of migrations.slice(storedVersion - 1)) {
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

Migration is **lazy**: `readBlock` brings data up to the current shape on read,
but the migrated data is only **persisted on save** (the editor flow). So the DB
row stays at its stored version until a save catches it up — the gap between
stored and current is the normal steady state, not an edge case.

Because the loader returns data already migrated to the current shape, **the
version it returns to the client must be the current version, not the raw stored
version.** The stored version is a server-side DB fact used only by `readBlock`;
it must not reach the client labeled as "the version of this data," or the
client would hold current-shaped data tagged with an old number.

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

1. Load the page; each block's data is migrated to the current shape (used as the form's default values).
2. Render each block's `editorComponent` with that data.
3. Compose the page form schema from the blocks' current schemas (Conform).
4. On save, persist each block's data **and stamp the current version**
   (server-side), catching the row up.

New blocks take default data from the schema, or render the form empty.

## Default data

Defined on the schema where needed:

```ts
const schema = z.object({ heading: z.string().default("Untitled") });
```

## Pages

A page holds metadata and an ordered list of blocks, hidden behind a service layer.

```ts
type Page = {
  title: string;
  description: string;
  blocks: Block[];
};

type PageService = {
  getPage: (slug: string) => Page;
  // Composes the page form schema from each block's current schema (for Conform).
  getPageSchema: () => z.ZodTypeAny;
  updatePage: (
    slug: string,
    title: string,
    description: string,
    blocks: Block[],
  ) => void;
};
```

## Open / deferred decisions

- **Cross-registry sync assert** (kinds present in both registries) — deferred to implementation.
- **Block ordering** — `position` as integers means reordering rewrites
  siblings; fractional indexing is an option if reordering gets painful.
- **Per-block render failure** — decide whether a block that fails validation on
  the public path renders a fallback, is skipped, or fails the page.
- **Page form composition** — how block fields are namespaced (stable id vs
  position) when the same kind appears twice; prototype before committing.
