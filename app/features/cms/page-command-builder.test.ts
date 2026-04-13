import { describe, expect, test } from "vitest";

import { refByDefinitionKey, refByPageBlockId } from "./blocks/block-ref";
import { createPageCommandBuilder } from "./page-commands";

describe("createPageCommandBuilder", () => {
  test("setBlockData pre-binds pageKey and baseRevision", () => {
    const builder = createPageCommandBuilder("home", 3);
    const ref = refByDefinitionKey("hero-main");

    const cmd = builder.setBlockData(ref, "hero", 1, { headline: "New title" });

    expect(cmd).toEqual({
      type: "set-block-data",
      pageKey: "home",
      baseRevision: 3,
      ref,
      blockType: "hero",
      blockVersion: 1,
      data: { headline: "New title" },
    });
  });

  test("moveBlockUp pre-binds pageKey and baseRevision", () => {
    const builder = createPageCommandBuilder("home", 1);
    const ref = refByPageBlockId("clx123", 1);

    const cmd = builder.moveBlockUp(ref);

    expect(cmd).toEqual({
      type: "move-block-up",
      pageKey: "home",
      baseRevision: 1,
      ref,
    });
  });

  test("moveBlockDown pre-binds pageKey and baseRevision", () => {
    const builder = createPageCommandBuilder("home", 2);
    const ref = refByPageBlockId("clx456", 0);

    const cmd = builder.moveBlockDown(ref);

    expect(cmd).toEqual({
      type: "move-block-down",
      pageKey: "home",
      baseRevision: 2,
      ref,
    });
  });

  test("deleteBlock pre-binds pageKey and baseRevision", () => {
    const builder = createPageCommandBuilder("home", 5);
    const ref = refByPageBlockId("clx789", 2);

    const cmd = builder.deleteBlock(ref);

    expect(cmd).toEqual({
      type: "delete-block",
      pageKey: "home",
      baseRevision: 5,
      ref,
    });
  });

  test("works with null baseRevision for default-backed pages", () => {
    const builder = createPageCommandBuilder("home", null);
    const ref = refByDefinitionKey("hero-main");

    const cmd = builder.setBlockData(ref, "hero", 1, {});

    expect(cmd.baseRevision).toBeNull();
  });
});
