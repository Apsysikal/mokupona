import type z from "zod";

import { registry as blockRegistry } from "./blocks";
import { registry as migrationRegistry } from "./migrations";

export type BlockRegistry = typeof blockRegistry;
export type BlockRegistryKey = keyof BlockRegistry;

export type ResolvedBlock<K extends BlockRegistryKey> = {
  id: string;
  kind: K;
  status: "success";
  data: z.output<BlockRegistry[K]["viewSchema"]>;
};

export type ErroredBlock<K extends string> = {
  id: string;
  kind: K;
  status: "error";
  error: Error;
  raw: unknown;
};

/**
 * Distributes over `K` so the result stays a *discriminated* union — each
 * member's `data` is tied to its own `kind`. Instantiated with the whole
 * `BlockRegistryKey` union it yields
 * `ResolvedBlock<"hero"> | ... | ErroredBlock<"hero"> | ...`, which `<BlockView>`
 * can narrow with a `switch`. (A non-distributive `ResolvedBlock<K>` would
 * collapse `kind` and `data` into two independent unions.)
 */
export type ReadResult<K extends BlockRegistryKey> = K extends K
  ? ResolvedBlock<K> | ErroredBlock<K>
  : never;

/** The success arm of every block kind — what `<BlockView>` renders. */
export type ResolvedBlockUnion = Extract<
  ReadResult<BlockRegistryKey>,
  { status: "success" }
>;

function isValidKey(key: string): key is BlockRegistryKey {
  // Own-key check only (O(1), no allocation) so an untrusted `kind` like
  // "toString" can't match an inherited property and slip past validation.
  return Object.prototype.hasOwnProperty.call(blockRegistry, key);
}

function buildBlockError<K extends string>(params: {
  id: string;
  kind: K;
  error: Error;
  raw: unknown;
}): ErroredBlock<K> {
  return { ...params, status: "error" };
}

function buildBlockSuccess<K extends BlockRegistryKey>(params: {
  id: string;
  kind: K;
  data: z.output<BlockRegistry[K]["viewSchema"]>;
}): ReadResult<K> {
  // `data` was just produced by parsing with `blockRegistry[kind].viewSchema`,
  // so the kind <-> data pairing is a real runtime invariant. TS can't derive it
  // across the union, so this single localized assert bridges the collapsed
  // object to the distributive `ReadResult`. It is the only cast in the module.
  return { ...params, status: "success" } as ReadResult<K>;
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
}): Error | undefined {
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

/** The current editor schema for a kind — for wiring a conform form. */
export function getEditorSchema<K extends BlockRegistryKey>(kind: K) {
  return blockRegistry[kind].editorSchema;
}

/** The form<->data mapper for a kind — for actions persisting edits. */
export function getFormMapper<K extends BlockRegistryKey>(kind: K) {
  return blockRegistry[kind].formMapper;
}

export function readBlock(
  id: string,
  kind: string,
  storedVersion: number,
  raw: unknown,
): ReadResult<BlockRegistryKey> | ErroredBlock<string> {
  const fail = (error: Error): ErroredBlock<string> =>
    buildBlockError({ id, kind, error, raw });

  if (!isValidKey(kind)) {
    return fail(new Error(`Block ${kind} is not a valid block type`));
  }

  const { viewSchema } = blockRegistry[kind];
  const { baseVersion, currentVersion, schemas, migrations } =
    migrationRegistry[kind];

  const versionError = validateBlockVersion({
    kind,
    storedVersion,
    baseVersion,
    currentVersion,
  });
  if (versionError) return fail(versionError);

  const index = storedVersion - baseVersion;

  const parseResult = schemas[index].safeParse(raw);
  if (!parseResult.success) {
    return fail(
      new Error(
        `Block ${kind}: failed to parse raw data. ${parseResult.error}`,
      ),
    );
  }

  // Seed migrations with the parsed stored-version data, then fold forward.
  let value: unknown = parseResult.data;
  try {
    for (const migrate of migrations.slice(index)) {
      value = migrate(value);
    }
  } catch (e) {
    return fail(
      e instanceof Error
        ? e
        : new Error(`Block ${kind}: unknown error while applying migrations`),
    );
  }

  const result = viewSchema.safeParse(value);
  if (!result.success) {
    return fail(
      new Error(
        `Block ${kind}: failed validation against current schema. ${result.error}`,
      ),
    );
  }

  return buildBlockSuccess({ id, kind, data: result.data });
}
