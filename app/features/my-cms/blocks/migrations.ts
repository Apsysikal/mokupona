import type z from "zod";

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
    fn: (d: z.infer<Head>) => z.infer<Next>,
  ) {
    return new BlockMigrationBuilder(
      this.baseVersion,
      [...this.schemas, nextSchema],
      [...this.migrations, fn as (d: unknown) => unknown],
      nextSchema,
    );
  }

  finish(current: z.ZodType<z.infer<Head>>) {
    return {
      baseVersion: this.baseVersion,
      currentVersion: this.baseVersion + this.schemas.length - 1,
      schemas: this.schemas,
      migrations: this.migrations,
    };
  }
}
