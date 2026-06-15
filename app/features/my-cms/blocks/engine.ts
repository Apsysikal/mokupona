import type { ReactNode } from "react";
import React from "react";
import type z from "zod";
import { registry as blockRegistry } from "./blocks";
import { registry as migrationRegistry } from "./migrations";

type BlockRegistry = typeof blockRegistry;
type BlockRegistryKey = keyof BlockRegistry;
export type ResolvedBlock<K extends BlockRegistryKey> = {
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
type ReadResult<K extends BlockRegistryKey> = K extends K
  ? ResolvedBlock<K> | ErroredBlock<K>
  : ErroredBlock<string>;

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

function validateBlockVersion({
  kind,
  storedVersion,
  baseVersion,
  currentVersion,
}: {
  kind: string;
  storedVersion: number;
  baseVersion: number;
  currentVersion: number;
}) {
  if (storedVersion < baseVersion) {
    return new Error(
      `Block ${kind}: stored version ${storedVersion} less than ${baseVersion}`,
    );
  }

  if (storedVersion > currentVersion) {
    return new Error(
      `Block ${kind}: stored version ${storedVersion} greater than ${currentVersion}`,
    );
  }
}

export function getBlockComponent<K extends BlockRegistryKey>(
  key: K,
  data: z.output<BlockRegistry[K]["viewSchema"]>,
): ReactNode {
  const Component = blockRegistry[key].viewComponent as React.ComponentType<{
    data: unknown;
  }>;
  return React.createElement(Component, { data });
}

// caller: getBlockComponent(result)

export function readBlock<K extends string>(
  id: string,
  kind: K,
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

  let validationResult = validateBlockVersion({
    kind,
    storedVersion,
    baseVersion,
    currentVersion,
  });

  if (validationResult) {
    return buildBlockError({ id, kind, error: validationResult, raw });
  }

  const index = storedVersion - baseVersion;
  let value = undefined;

  let parseResult = schemas[index].safeParse(raw);

  if (parseResult.error) {
    const error = new Error(
      `Block ${kind}: failed to parse raw data. ${parseResult.error}`,
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
