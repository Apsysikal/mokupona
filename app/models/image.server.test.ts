import { describe, expect, it } from "vitest";

import { buildEventData } from "../../test/factories";

import { createBoardMember } from "./board-member.server";
import { createEvent } from "./event.server";
import { countOrphanImages, deleteOrphanImages } from "./image.server";

import { prisma } from "~/db.server";

describe("orphan image sweep", () => {
  it("deletes only images with neither an event nor a board member", async () => {
    const orphan = await prisma.image.create({
      data: { contentType: "image/jpeg", blob: Buffer.from("orphan-image") },
    });
    const event = await createEvent(await buildEventData());
    const boardMember = await createBoardMember({
      name: "Sweep Keeper",
      position: "Test Position",
      image: {
        contentType: "image/jpeg",
        blob: Buffer.from("board-member-image"),
      },
    });

    // >= because the shared test DB may hold orphans from other tests
    expect(await countOrphanImages()).toBeGreaterThanOrEqual(1);

    const { count } = await deleteOrphanImages();
    expect(count).toBeGreaterThanOrEqual(1);

    await expect(
      prisma.image.findUnique({ where: { id: orphan.id } }),
    ).resolves.toBeNull();
    // owned images survive: the event's cover ...
    await expect(
      prisma.image.findUnique({ where: { id: event.imageId } }),
    ).resolves.not.toBeNull();
    // ... and its event (deleting the cover would cascade the event away)
    await expect(
      prisma.event.findUnique({ where: { id: event.id } }),
    ).resolves.not.toBeNull();
    // ... and the board member's portrait
    await expect(
      prisma.image.count({ where: { boardMemberId: boardMember.id } }),
    ).resolves.toBe(1);

    expect(await countOrphanImages()).toBe(0);
  });
});
