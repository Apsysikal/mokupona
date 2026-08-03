import { faker } from "@faker-js/faker";
import { afterEach, describe, expect, it } from "vitest";

import { buildEventData } from "../../test/factories";

import { createEvent, deleteEvent, deleteEventsInTx } from "./event.server";
import {
  createGalleryImagesForEvent,
  deleteOrphanedImage,
  getGalleryEntries,
  getGalleryEntriesForEvent,
  getLinkableImages,
  linkExistingImagesToEvent,
  removeGalleryEntry,
  type GalleryImageCreateData,
} from "./gallery-join.server";

import { prisma } from "~/db.server";

// every row this file creates is reachable from one of these
const GALLERY_KEY_PREFIX = "test/dinner-gallery/";
const eventIds: string[] = [];
const boardMemberIds: string[] = [];

function buildGalleryImage(
  overrides: Partial<GalleryImageCreateData> = {},
): GalleryImageCreateData {
  return {
    contentType: "image/jpeg",
    storageKey: `${GALLERY_KEY_PREFIX}${faker.string.uuid()}`,
    ...overrides,
  };
}

async function createDinner(date?: Date) {
  const event = await createEvent({
    ...(await buildEventData()),
    ...(date && { date }),
  });
  eventIds.push(event.id);
  return event;
}

/** One uploaded image in one dinner's gallery — the common starting point. */
async function uploadOne(eventId: string, caption?: string) {
  const data = buildGalleryImage(caption ? { caption } : {});
  const [entry] = await createGalleryImagesForEvent(eventId, [data]);
  return { entry, data };
}

afterEach(async () => {
  const ids = eventIds.splice(0);
  if (ids.length > 0) {
    // cascades the dinners' entries and cover images
    await prisma.$transaction((tx) => deleteEventsInTx(tx, { id: { in: ids } }));
  }
  await prisma.image.deleteMany({
    where: { storageKey: { startsWith: GALLERY_KEY_PREFIX } },
  });
  const members = boardMemberIds.splice(0);
  if (members.length > 0) {
    await prisma.boardMember.deleteMany({ where: { id: { in: members } } });
  }
});

describe("createGalleryImagesForEvent", () => {
  it("creates the image row and its membership together", async () => {
    const dinner = await createDinner();
    const data = buildGalleryImage({ caption: "Plating the first course" });

    const [entry] = await createGalleryImagesForEvent(dinner.id, [data]);

    expect(entry).toMatchObject({ eventId: dinner.id, position: 0 });
    const image = await prisma.image.findUniqueOrThrow({
      where: { id: entry.imageId },
    });
    expect(image.storageKey).toBe(data.storageKey);
    // the image stays ownerless — the entry, not the row, ties it to a dinner
    expect(image.eventId).toBeNull();

    const [read] = await getGalleryEntriesForEvent(dinner.id);
    expect(read).toMatchObject({
      id: entry.id,
      caption: "Plating the first course",
      image: { id: entry.imageId, storageKey: data.storageKey },
      event: { id: dinner.id, title: dinner.title },
      sharedWith: [],
    });
  });

  it("appends after the current last position", async () => {
    const dinner = await createDinner();

    await createGalleryImagesForEvent(dinner.id, [
      buildGalleryImage(),
      buildGalleryImage(),
    ]);
    await createGalleryImagesForEvent(dinner.id, [buildGalleryImage()]);

    const entries = await getGalleryEntriesForEvent(dinner.id);
    expect(entries.map((entry) => entry.position)).toEqual([0, 1, 2]);
  });

  it("leaves no image row when the entry write fails", async () => {
    const data = buildGalleryImage();

    await expect(
      createGalleryImagesForEvent("does-not-exist", [data]),
    ).rejects.toThrow();

    await expect(
      prisma.image.count({ where: { storageKey: data.storageKey } }),
    ).resolves.toBe(0);
  });
});

describe("linkExistingImagesToEvent", () => {
  it("hangs one image in a second dinner without moving it", async () => {
    const [first, second] = await Promise.all([createDinner(), createDinner()]);
    const { entry } = await uploadOne(first.id, "As served");

    const [linked] = await linkExistingImagesToEvent(second.id, [
      entry.imageId,
    ]);

    expect(linked.imageId).toBe(entry.imageId);
    const [firstEntry] = await getGalleryEntriesForEvent(first.id);
    const [secondEntry] = await getGalleryEntriesForEvent(second.id);
    expect(firstEntry.caption).toBe("As served");
    // the caption lives on the membership, so the same photo reads differently
    expect(secondEntry.caption).toBeNull();
    expect(firstEntry.sharedWith).toEqual([
      { id: second.id, title: second.title },
    ]);
  });

  it("is idempotent — re-adding the same image skips instead of throwing", async () => {
    const dinner = await createDinner();
    const { entry } = await uploadOne(dinner.id);

    await expect(
      linkExistingImagesToEvent(dinner.id, [entry.imageId, entry.imageId]),
    ).resolves.toEqual([]);

    await expect(
      prisma.eventGalleryEntry.count({
        where: { eventId: dinner.id, imageId: entry.imageId },
      }),
    ).resolves.toBe(1);
  });

  it("skips ids that are not images", async () => {
    const dinner = await createDinner();

    await expect(
      linkExistingImagesToEvent(dinner.id, ["does-not-exist"]),
    ).resolves.toEqual([]);
  });
});

describe("removeGalleryEntry", () => {
  it("unlinks one dinner, leaving the image and the other dinner intact", async () => {
    const [first, second] = await Promise.all([createDinner(), createDinner()]);
    const { entry, data } = await uploadOne(first.id);
    await linkExistingImagesToEvent(second.id, [entry.imageId]);

    const removed = await removeGalleryEntry(entry.id);

    expect(removed).toMatchObject({
      imageId: entry.imageId,
      storageKey: data.storageKey,
      // still hanging in the second dinner — destroying it would be the bug
      orphaned: false,
    });
    await expect(getGalleryEntriesForEvent(first.id)).resolves.toEqual([]);
    await expect(getGalleryEntriesForEvent(second.id)).resolves.toHaveLength(1);
    await expect(
      prisma.image.findUnique({ where: { id: entry.imageId } }),
    ).resolves.not.toBeNull();
  });

  it("reports the image orphaned once the last membership goes", async () => {
    const dinner = await createDinner();
    const { entry, data } = await uploadOne(dinner.id);

    const removed = await removeGalleryEntry(entry.id);

    expect(removed).toMatchObject({ storageKey: data.storageKey, orphaned: true });
    // the row survives the unlink; collecting it is a separate, checked step
    await expect(
      prisma.image.findUnique({ where: { id: entry.imageId } }),
    ).resolves.not.toBeNull();
    await expect(deleteOrphanedImage(entry.imageId)).resolves.toBe(
      data.storageKey,
    );
    await expect(
      prisma.image.findUnique({ where: { id: entry.imageId } }),
    ).resolves.toBeNull();
  });

  it("does not call an image orphaned while another slot owns it", async () => {
    const dinner = await createDinner();
    const member = await prisma.boardMember.create({
      data: { name: faker.person.fullName(), position: "Cook" },
    });
    boardMemberIds.push(member.id);
    const portrait = await prisma.image.create({
      data: { ...buildGalleryImage(), boardMemberId: member.id },
    });
    const [entry] = await linkExistingImagesToEvent(dinner.id, [portrait.id]);

    const removed = await removeGalleryEntry(entry.id);

    expect(removed?.orphaned).toBe(false);
    await expect(deleteOrphanedImage(portrait.id)).resolves.toBeNull();
    await expect(
      prisma.image.findUnique({ where: { id: portrait.id } }),
    ).resolves.not.toBeNull();
  });

  it("returns null for an entry that is already gone", async () => {
    await expect(removeGalleryEntry("does-not-exist")).resolves.toBeNull();
  });
});

describe("deleting a dinner", () => {
  it("cascades its entries but keeps the shared image and the other dinner", async () => {
    const [first, second] = await Promise.all([createDinner(), createDinner()]);
    const { entry } = await uploadOne(first.id);
    await linkExistingImagesToEvent(second.id, [entry.imageId]);

    await deleteEvent(first.id);
    eventIds.splice(eventIds.indexOf(first.id), 1);

    await expect(
      prisma.eventGalleryEntry.findUnique({ where: { id: entry.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.image.findUnique({ where: { id: entry.imageId } }),
    ).resolves.not.toBeNull();
    await expect(getGalleryEntriesForEvent(second.id)).resolves.toHaveLength(1);
  });
});

describe("read projections", () => {
  it("orders every entry newest dinner first, then display order", async () => {
    const older = await createDinner(new Date("2200-01-01T18:00:00.000Z"));
    const newer = await createDinner(new Date("2200-02-01T18:00:00.000Z"));
    await createGalleryImagesForEvent(older.id, [
      buildGalleryImage(),
      buildGalleryImage(),
    ]);
    await createGalleryImagesForEvent(newer.id, [buildGalleryImage()]);

    const mine = (await getGalleryEntries()).filter((entry) =>
      [older.id, newer.id].includes(entry.event.id),
    );

    expect(mine.map((entry) => [entry.event.id, entry.position])).toEqual([
      [newer.id, 0],
      [older.id, 0],
      [older.id, 1],
    ]);
  });

  it("offers the reuse pool without this dinner's own images", async () => {
    const [first, second] = await Promise.all([createDinner(), createDinner()]);
    const { entry } = await uploadOne(first.id);

    const forSecond = await getLinkableImages(second.id);
    expect(forSecond).toContainEqual(
      expect.objectContaining({
        image: expect.objectContaining({ id: entry.imageId }),
        usedIn: [{ id: first.id, title: first.title }],
      }),
    );

    const forFirst = await getLinkableImages(first.id);
    expect(
      forFirst.some((linkable) => linkable.image.id === entry.imageId),
    ).toBe(false);
  });

  it("keeps an image nobody claims in the pool", async () => {
    const dinner = await createDinner();
    const { entry } = await uploadOne(dinner.id);
    await removeGalleryEntry(entry.id);

    const pool = await getLinkableImages(dinner.id);

    expect(pool).toContainEqual(
      expect.objectContaining({
        image: expect.objectContaining({ id: entry.imageId }),
        usedIn: [],
      }),
    );
  });
});
