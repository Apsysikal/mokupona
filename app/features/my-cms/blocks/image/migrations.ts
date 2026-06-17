import { BlockMigrationBuilder } from "../migration-builder";

import { schema } from "./model";

export const migrations = BlockMigrationBuilder.from(schema).finish();
