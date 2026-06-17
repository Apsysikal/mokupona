import type z from "zod";

import type { Migration } from "./types";

/**
 * Builds a per-block migration chain, threading the head schema's type so each
 * `addMigration` is type-checked against the previous version's output (and
 * `NoInfer` pins the target version to its schema, not the migration's return).
 *
 * Lives in its own leaf module (only type imports) so per-block `migrations.ts`
 * files can use it without importing the registry module — which would form an
 * import cycle (registry -> blocks -> per-block index -> per-block migrations).
 */
export class BlockMigrationBuilder<Head extends z.ZodType> {
  private constructor(
    private readonly baseVersion: number,
    private readonly schemas: z.ZodType[],
    private readonly migrations: Array<(d: unknown) => unknown>,
    private readonly head: Head,
  ) {}

  static from<S extends z.ZodType>(baseSchema: S, baseVersion = 1) {
    return new BlockMigrationBuilder(baseVersion, [baseSchema], [], baseSchema);
  }

  addMigration<Next extends z.ZodType>(
    nextSchema: Next,
    fn: (d: z.output<Head>) => NoInfer<z.output<Next>>,
  ): BlockMigrationBuilder<Next> {
    return new BlockMigrationBuilder<Next>(
      this.baseVersion,
      [...this.schemas, nextSchema],
      [...this.migrations, fn as (d: unknown) => unknown],
      nextSchema,
    );
  }

  finish(): Migration {
    return {
      baseVersion: this.baseVersion,
      currentVersion: this.baseVersion + this.schemas.length - 1,
      schemas: this.schemas,
      migrations: this.migrations,
    };
  }
}
