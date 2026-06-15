import type z from "zod";
import { registry as blockRegistry } from "./blocks";
import { registry as migrationRegistry } from "./migrations";

type BlockRegistry = typeof blockRegistry;
type BlockRegistryKey = keyof BlockRegistry;
type ResolvedBlock<K extends BlockRegistryKey> = {
  id: string;
  kind: K;
  status: "success";
  data: z.output<BlockRegistry[K]["viewSchema"]>;
};
type ErroredBlock<K extends string> = {
  id: string;
  kind: K;
  status: "error";
  error: Error;
  raw: unknown;
};
type ReadResult<K extends BlockRegistryKey> =
  | ResolvedBlock<K>
  | ErroredBlock<K>;

function isValidKey(key: string): key is BlockRegistryKey {
  return Object.keys(blockRegistry).includes(key);
}

function buildBlockError<K extends string>(params: {
  id: string;
  kind: K;
  error: Error;
  raw: unknown;
}): ErroredBlock<K> {
  return {
    ...params,
    status: "error",
  };
}

function buildBlockSuccess<K extends BlockRegistryKey>(params: {
  id: string;
  kind: K;
  data: z.output<BlockRegistry[K]["viewSchema"]>;
}): ResolvedBlock<K> {
  return {
    ...params,
    status: "success",
  };
}

export function readBlock(
  id: string,
  kind: string,
  storedVersion: number,
  raw: unknown,
) {
  if (!isValidKey(kind)) {
    const error = new Error(`Block ${kind} is not a valid block type`);
    return buildBlockError({ id, kind, error, raw });
  }

  const viewSchema = blockRegistry[kind].viewSchema;
  const { baseVersion, currentVersion, schemas, migrations } =
    migrationRegistry[kind];

  if (storedVersion < baseVersion) {
    const error = new Error(
      `Block ${kind}: stored version ${storedVersion} less than ${baseVersion}`,
    );
    return buildBlockError({ id, kind, error, raw });
  }

  if (storedVersion > currentVersion) {
    const error = new Error(
      `Block ${kind}: stored version ${storedVersion} higher than ${currentVersion}`,
    );
    return buildBlockError({ id, kind, error, raw });
  }

  const index = storedVersion - baseVersion;
  let value = undefined;

  try {
    value = schemas[index].parse(raw);
  } catch (e) {
    if (e instanceof Error) {
      return buildBlockError({ id, kind, error: e, raw });
    }

    const error = new Error(
      `Block ${kind}: unknown error while parsing raw data`,
    );
    return buildBlockError({ id, kind, error, raw });
  }

  try {
    for (const m of migrations.slice(index)) {
      value = m(value);
    }
  } catch (e) {
    if (e instanceof Error) {
      return buildBlockError({ id, kind, error: e, raw });
    }

    const error = new Error(
      `Block ${kind}: unknown error while applying migrations`,
    );
    return buildBlockError({ id, kind, error, raw });
  }

  try {
    value = viewSchema.parse(value);
  } catch (e) {
    if (e instanceof Error) {
      return buildBlockError({ id, kind, error: e, raw });
    }

    const error = new Error(
      `Block ${kind}: unknown error while parsing against current schema`,
    );
    return buildBlockError({ id, kind, error, raw });
  }

  return buildBlockSuccess({
    id,
    kind,
    data: value,
  });
}
