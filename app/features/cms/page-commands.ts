/**
 * Page command types and builder.
 *
 * This module is intentionally kept free of server-only imports so that
 * `createPageCommandBuilder` can be called from route components (client bundle)
 * without violating React Router's server-only boundary.
 */
import type { BlockRef, PageBlockIdRef } from "./blocks/block-ref";
import type { BlockType } from "./blocks/types";
import type { PageKey } from "./catalog";
import type { Revision } from "./page-status";

/** A BlockRef that may be the target of delete/move commands (named fixed slots excluded). */
export type MutableBlockRef = PageBlockIdRef;

export type SetPageMetaCommand = {
  type: "set-page-meta";
  pageKey: PageKey;
  baseRevision: Revision | null;
  title: string;
  description: string;
};

export type SetBlockDataCommand = {
  type: "set-block-data";
  pageKey: PageKey;
  baseRevision: Revision | null;
  ref: BlockRef;
  blockType: BlockType;
  blockVersion: number;
  data: unknown;
};

export type MoveBlockUpCommand = {
  type: "move-block-up";
  pageKey: PageKey;
  baseRevision: Revision | null;
  ref: MutableBlockRef;
};

export type MoveBlockDownCommand = {
  type: "move-block-down";
  pageKey: PageKey;
  baseRevision: Revision | null;
  ref: MutableBlockRef;
};

export type DeleteBlockCommand = {
  type: "delete-block";
  pageKey: PageKey;
  baseRevision: Revision | null;
  ref: MutableBlockRef;
};

export type PageCommand =
  | SetPageMetaCommand
  | SetBlockDataCommand
  | MoveBlockUpCommand
  | MoveBlockDownCommand
  | DeleteBlockCommand;

export type PageCommandBuilder = {
  setBlockData(
    ref: BlockRef,
    blockType: BlockType,
    blockVersion: number,
    data: unknown,
  ): SetBlockDataCommand;
  moveBlockUp(ref: MutableBlockRef): MoveBlockUpCommand;
  moveBlockDown(ref: MutableBlockRef): MoveBlockDownCommand;
  deleteBlock(ref: MutableBlockRef): DeleteBlockCommand;
};

export function createPageCommandBuilder(
  pageKey: PageKey,
  baseRevision: Revision | null,
): PageCommandBuilder {
  return {
    setBlockData(ref, blockType, blockVersion, data) {
      return {
        type: "set-block-data",
        pageKey,
        baseRevision,
        ref,
        blockType,
        blockVersion,
        data,
      };
    },
    moveBlockUp(ref) {
      return { type: "move-block-up", pageKey, baseRevision, ref };
    },
    moveBlockDown(ref) {
      return { type: "move-block-down", pageKey, baseRevision, ref };
    },
    deleteBlock(ref) {
      return { type: "delete-block", pageKey, baseRevision, ref };
    },
  };
}
