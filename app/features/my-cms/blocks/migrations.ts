import type { BlockRegistryKey } from "./engine";
import { migrations as heroBlockMigrations } from "./hero";
import { migrations as imageBlockMigrations } from "./image";
import { migrations as textSectionBlockMigrations } from "./text-section";
import type { Migration, MigrationRegistry } from "./types";

class MigrationRegistryBuilder<R extends MigrationRegistry = {}> {
  private constructor(private registry: R) {}

  static create(): MigrationRegistryBuilder {
    return new MigrationRegistryBuilder({});
  }

  addMigration<K extends BlockRegistryKey>(
    kind: K,
    migration: Migration,
  ): MigrationRegistryBuilder<R & Record<K, Migration>> {
    const { baseVersion, currentVersion, schemas, migrations } = migration;
    const expectedSchemas = currentVersion - baseVersion + 1;

    if (schemas.length !== expectedSchemas) {
      throw new Error(
        `Migration "${String(kind)}": expected ${expectedSchemas} schema(s) for versions ` +
          `${baseVersion}..${currentVersion}, got ${schemas.length}`,
      );
    }

    if (migrations.length !== schemas.length - 1) {
      throw new Error(
        `Migration "${String(kind)}": expected ${schemas.length - 1} migration fn(s) ` +
          `for ${schemas.length} schema(s), got ${migrations.length}`,
      );
    }

    return new MigrationRegistryBuilder({
      ...this.registry,
      [kind]: migration,
    });
  }

  build(): R {
    return this.registry;
  }
}

export const registry = MigrationRegistryBuilder.create()
  .addMigration("hero", heroBlockMigrations)
  .addMigration("text-section", textSectionBlockMigrations)
  .addMigration("image", imageBlockMigrations)
  .build();
