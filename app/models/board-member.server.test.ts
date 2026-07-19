import { describe, expect, it } from "vitest";

import {
  createBoardMember,
  deleteBoardMember,
  updateBoardMember,
} from "./board-member.server";

import { faker } from "@faker-js/faker";

import { prisma } from "~/db.server";
import type { ImageCreateData } from "~/models/image.server";

function portrait(marker: string): ImageCreateData {
  // unique per call — the tests share one database
  return {
    contentType: "image/jpeg",
    storageKey: `test/board-members/${marker}-${faker.string.uuid()}`,
  };
}

describe("board member image lifecycle", () => {
  it("creates the portrait with the member", async () => {
    const member = await createBoardMember({
      name: "With Portrait",
      position: "Test Position",
      image: portrait("create-portrait"),
    });

    await expect(
      prisma.image.count({ where: { boardMemberId: member.id } }),
    ).resolves.toBe(1);
  });

  it("replaces the portrait on update: old row deleted, new row created", async () => {
    const member = await createBoardMember({
      name: "Swap Portrait",
      position: "Test Position",
      image: portrait("old-portrait"),
    });
    const oldImage = await prisma.image.findUniqueOrThrow({
      where: { boardMemberId: member.id },
    });

    await updateBoardMember(member.id, {
      name: member.name,
      position: member.position,
      image: portrait("new-portrait"),
    });

    await expect(
      prisma.image.findUnique({ where: { id: oldImage.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.image.count({ where: { boardMemberId: member.id } }),
    ).resolves.toBe(1);
  });

  it("keeps the portrait when updating without an image", async () => {
    const member = await createBoardMember({
      name: "Keep Portrait",
      position: "Test Position",
      image: portrait("kept-portrait"),
    });
    const image = await prisma.image.findUniqueOrThrow({
      where: { boardMemberId: member.id },
    });

    await updateBoardMember(member.id, {
      name: "Renamed",
      position: member.position,
    });

    await expect(
      prisma.image.findUnique({ where: { id: image.id } }),
    ).resolves.not.toBeNull();
  });

  it("cascades the portrait away with the member", async () => {
    const member = await createBoardMember({
      name: "Delete Portrait",
      position: "Test Position",
      image: portrait("deleted-portrait"),
    });

    await deleteBoardMember(member.id);

    await expect(
      prisma.image.count({ where: { boardMemberId: member.id } }),
    ).resolves.toBe(0);
  });
});
