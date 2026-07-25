import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import {
  createBoardMember,
  deleteBoardMember,
  updateBoardMember,
} from "./board-member.server";

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

  // capture-and-destroy (design §3.4): the doomed portrait's storageKey is
  // captured inside the transaction and returned for the caller's
  // post-commit provider destroy

  it("deleteBoardMember returns the captured portrait storageKey", async () => {
    const image = portrait("captured-on-delete");
    const member = await createBoardMember({
      name: "Capture Delete",
      position: "Test Position",
      image,
    });

    const result = await deleteBoardMember(member.id);

    expect(result.boardMember.id).toBe(member.id);
    expect(result.imageKey).toBe(image.storageKey);
  });

  it("deleteBoardMember returns a null key for a portraitless member", async () => {
    const member = await createBoardMember({
      name: "No Portrait",
      position: "Test Position",
    });

    const result = await deleteBoardMember(member.id);

    expect(result.imageKey).toBeNull();
  });

  it("updateBoardMember returns the replaced portrait's storageKey on a swap", async () => {
    const oldImage = portrait("captured-on-swap");
    const member = await createBoardMember({
      name: "Capture Swap",
      position: "Test Position",
      image: oldImage,
    });

    const result = await updateBoardMember(member.id, {
      name: member.name,
      position: member.position,
      image: portrait("swap-replacement"),
    });

    expect(result.replacedImageKey).toBe(oldImage.storageKey);
  });

  it("updateBoardMember returns a null key when the portrait is untouched", async () => {
    const member = await createBoardMember({
      name: "Keep On Update",
      position: "Test Position",
      image: portrait("kept-on-update"),
    });

    const result = await updateBoardMember(member.id, {
      name: "Renamed Again",
      position: member.position,
    });

    expect(result.replacedImageKey).toBeNull();
  });
});
