import type { SubmissionResult } from "@conform-to/react";
import type React from "react";
import type { ZodType } from "zod/v4";

import type { BlockRef } from "./blocks/block-ref";
import type {
  BlockBaseType,
  BlockType,
  BlockVersion,
  DefinitionKey,
} from "./blocks/types";
import type { CmsDiagnostic } from "./diagnostics";
import type { LinkTargetRegistry } from "./link-targets";
import type { PageCommandBuilder } from "./page-commands";

export type PageKey = string;
export type Provenance = "default" | "persisted";

export type BlockInstance = BlockBaseType<BlockType, BlockVersion, unknown>;

export type MetaTag =
  | { title: string }
  | { name: string; content: string }
  | { property: string; content: string };

export type PageRule = {
  allowedBlockTypes: readonly BlockType[];
  requiredLeadingBlockTypes?: readonly BlockType[];
};

export type PageSnapshot = {
  pageKey: PageKey;
  provenance: Provenance;
  title: string;
  description: string;
  blocks: BlockInstance[];
};

export type PublicProjection = {
  pageKey: PageKey;
  meta: MetaTag[];
  blocks: BlockInstance[];
  diagnostics: readonly CmsDiagnostic[];
};

export type PublicProjectionContext = {
  domainUrl?: string | URL;
  pathname: string;
};

export type BlockEditorCapabilities = {
  canMoveUp: boolean;
  canMoveDown: boolean;
  canDelete: boolean;
};

export type BlockEditorFormState = {
  readonly lastResult: SubmissionResult<string[]> | null;
  readonly errorMessage: string | null;
};

export type BlockEditorContext<TData = unknown> = {
  readonly data: TData;
  readonly blockRef: BlockRef;
  readonly commandBuilder: PageCommandBuilder;
  readonly linkTargetRegistry: LinkTargetRegistry;
  readonly capabilities: BlockEditorCapabilities;
  readonly formState?: BlockEditorFormState;
};

export type BlockDefinition<TBlock extends BlockInstance = BlockInstance> = {
  type: TBlock["type"];
  version: TBlock["version"];
  schema: ZodType<TBlock["data"]>;
  migrate?(input: {
    fromVersion: number;
    data: unknown;
  }): { version: TBlock["version"]; data: TBlock["data"] } | null;
  render(block: TBlock): React.ReactNode;
  editor?(ctx: BlockEditorContext<TBlock["data"]>): React.ReactNode;
};

export type PageDefinition = {
  pageKey: PageKey;
  defaults: {
    title: string;
    description: string;
    shareImageSrc?: string;
    blocks: BlockInstance[];
  };
  rules: PageRule;
  migrate?(input: { snapshot: PageSnapshot }): PageSnapshot | null;
};

export type CmsCatalog = {
  listPageKeys(): readonly PageKey[];
  getBlockDefinition(blockType: BlockType): BlockDefinition;
  getPageRule(pageKey: PageKey): PageRule;
  readPageSnapshot(pageKey: PageKey): PageSnapshot;
  migratePageSnapshot(input: { snapshot: PageSnapshot }): {
    snapshot: PageSnapshot;
    migrated: boolean;
  };
  projectPublic(
    snapshot: PageSnapshot,
    context: PublicProjectionContext,
  ): PublicProjection;
};

export class UnknownBlockTypeError extends Error {
  readonly blockType: BlockType;

  constructor(blockType: BlockType) {
    super(`Unknown Block Type: ${blockType}`);
    this.name = "UnknownBlockTypeError";
    this.blockType = blockType;
  }
}

type CmsCatalogInput = {
  blocks: readonly BlockDefinition[];
  pages: readonly PageDefinition[];
};

export function defineBlockDefinition<TBlock extends BlockInstance>(
  definition: BlockDefinition<TBlock>,
): BlockDefinition<TBlock> {
  return definition;
}

export function definePageDefinition(
  definition: PageDefinition,
): PageDefinition {
  return definition;
}

export function createCmsCatalog({
  blocks,
  pages,
}: CmsCatalogInput): CmsCatalog {
  const blockDefinitions = createUniqueMap(
    blocks,
    ({ type }) => type,
    "Duplicate Block Type",
  );
  const pageDefinitions = createUniqueMap(
    pages,
    ({ pageKey }) => pageKey,
    "Duplicate Page Key",
  );

  for (const pageDefinition of pages) {
    validatePageDefinition(pageDefinition, blockDefinitions);
  }

  const readPageSnapshot = (pageKey: PageKey): PageSnapshot => {
    const pageDefinition = requireFromMap(
      pageDefinitions,
      pageKey,
      `Unknown Page Key: ${pageKey}`,
    );

    return {
      pageKey,
      provenance: "default",
      title: pageDefinition.defaults.title,
      description: pageDefinition.defaults.description,
      blocks: cloneBlocks(pageDefinition.defaults.blocks),
    };
  };

  return {
    listPageKeys() {
      return [...pageDefinitions.keys()];
    },
    getBlockDefinition(blockType) {
      const definition = blockDefinitions.get(blockType);
      if (!definition) {
        throw new UnknownBlockTypeError(blockType);
      }

      return definition;
    },
    getPageRule(pageKey) {
      return requireFromMap(
        pageDefinitions,
        pageKey,
        `Unknown Page Key: ${pageKey}`,
      ).rules;
    },
    readPageSnapshot,
    migratePageSnapshot({ snapshot }) {
      const pageDefinition = requireFromMap(
        pageDefinitions,
        snapshot.pageKey,
        `Unknown Page Key: ${snapshot.pageKey}`,
      );
      const migratedSnapshot = pageDefinition.migrate?.({
        snapshot: {
          pageKey: snapshot.pageKey,
          provenance: snapshot.provenance,
          title: snapshot.title,
          description: snapshot.description,
          blocks: cloneBlocks(snapshot.blocks),
        },
      });
      if (!migratedSnapshot) {
        return {
          snapshot: {
            pageKey: snapshot.pageKey,
            provenance: snapshot.provenance,
            title: snapshot.title,
            description: snapshot.description,
            blocks: cloneBlocks(snapshot.blocks),
          },
          migrated: false,
        };
      }

      if (migratedSnapshot.pageKey !== snapshot.pageKey) {
        throw new Error(
          `Page migration for "${snapshot.pageKey}" returned a snapshot with mismatched page key "${migratedSnapshot.pageKey}"`,
        );
      }

      if (migratedSnapshot.provenance !== snapshot.provenance) {
        throw new Error(
          `Page migration for "${snapshot.pageKey}" returned a snapshot with mismatched provenance "${migratedSnapshot.provenance}"`,
        );
      }

      return {
        snapshot: {
          ...migratedSnapshot,
          blocks: cloneBlocks(migratedSnapshot.blocks),
        },
        migrated: true,
      };
    },
    projectPublic(snapshot, context) {
      const meta: MetaTag[] = [
        { title: snapshot.title },
        { name: "description", content: snapshot.description },
      ];

      const pageDefinition = requireFromMap(
        pageDefinitions,
        snapshot.pageKey,
        `Unknown Page Key: ${snapshot.pageKey}`,
      );

      if (context.domainUrl) {
        meta.push(
          { property: "og:title", content: snapshot.title },
          { property: "og:type", content: "website" },
        );

        if (pageDefinition.defaults.shareImageSrc) {
          meta.push({
            property: "og:image",
            content: new URL(
              pageDefinition.defaults.shareImageSrc,
              context.domainUrl,
            ).toString(),
          });
        }

        meta.push({
          property: "og:url",
          content: new URL(context.pathname, context.domainUrl).toString(),
        });
      }

      return {
        pageKey: snapshot.pageKey,
        meta,
        blocks: cloneBlocks(snapshot.blocks),
        diagnostics: [],
      };
    },
  };
}

function validatePageDefinition(
  pageDefinition: PageDefinition,
  blockDefinitions: Map<BlockType, BlockDefinition>,
) {
  const allowedBlockTypes = new Set(pageDefinition.rules.allowedBlockTypes);
  const definitionKeys = new Set<DefinitionKey>();

  for (const block of pageDefinition.defaults.blocks) {
    const definition = requireFromMap(
      blockDefinitions,
      block.type,
      `Unknown Block Type in Page Definition "${pageDefinition.pageKey}": ${block.type}`,
    );

    if (!allowedBlockTypes.has(block.type)) {
      throw new Error(
        `Block Type "${block.type}" is not allowed on Page Definition "${pageDefinition.pageKey}"`,
      );
    }

    const result = definition.schema.safeParse(block.data);
    if (!result.success) {
      throw new Error(
        `Invalid default block data for Page Definition "${pageDefinition.pageKey}" and Block Type "${block.type}"`,
      );
    }

    if (block.definitionKey) {
      if (definitionKeys.has(block.definitionKey)) {
        throw new Error(
          `Duplicate Definition Key "${block.definitionKey}" on Page Definition "${pageDefinition.pageKey}"`,
        );
      }

      definitionKeys.add(block.definitionKey);
    }
  }

  for (const [index, requiredBlockType] of (
    pageDefinition.rules.requiredLeadingBlockTypes ?? []
  ).entries()) {
    const block = pageDefinition.defaults.blocks[index];
    if (!block || block.type !== requiredBlockType) {
      throw new Error(
        `Page Definition "${pageDefinition.pageKey}" must start with Block Type "${requiredBlockType}" at position ${index}`,
      );
    }
  }
}

function createUniqueMap<TValue, TKey>(
  values: readonly TValue[],
  getKey: (value: TValue) => TKey,
  errorPrefix: string,
) {
  const map = new Map<TKey, TValue>();

  for (const value of values) {
    const key = getKey(value);
    if (map.has(key)) {
      throw new Error(`${errorPrefix}: ${String(key)}`);
    }

    map.set(key, value);
  }

  return map;
}

function requireFromMap<TKey, TValue>(
  map: Map<TKey, TValue>,
  key: TKey,
  errorMessage: string,
) {
  const value = map.get(key);
  if (!value) {
    throw new Error(errorMessage);
  }

  return value;
}

function cloneBlocks(blocks: readonly BlockInstance[]): BlockInstance[] {
  return structuredClone(blocks) as BlockInstance[];
}
