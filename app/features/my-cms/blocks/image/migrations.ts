import { BlockMigrationBuilder } from "../migrations";
import { schema } from "./model";

export const migrations = BlockMigrationBuilder.from(schema).finish(schema);
