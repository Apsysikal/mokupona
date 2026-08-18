import { faker } from "@faker-js/faker";
import { afterEach, describe, expect, it } from "vitest";

import { buildEventData } from "../../test/factories";

import { deleteBoardMember, updateBoardMember } from "./board-member.server";
import {
  createEvent,
  deleteEvent,
  deleteEventsInTx,
  updateEvent,
} from "./event.server";
import {
  createGalleryImagesForEvent,
  getGalleryEntries,
  getGalleryEntriesForEvent,
  getGalleryEntriesForEventWithReuse,
  getLinkableImages,
  linkExistingImagesToEvent,
  removeGalleryEntry,
  type GalleryImageCreateData,
} from "./gallery.server";

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
    // takes the dinners' entries and cover images with them
    await prisma.$transaction((tx) =>
      deleteEventsInTx(tx, { id: { in: ids } }),
    );
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
      include: { event: true, boardMember: true },
    });
    expect(image.storageKey).toBe(data.storageKey);
    // the image stays ownerless — the entry, not a slot, ties it to a dinner
    expect(image.event).toBeNull();
    expect(image.boardMember).toBeNull();

    const [read] = await getGalleryEntriesForEventWithReuse(dinner.id);
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
    const [firstEntry] = await getGalleryEntriesForEventWithReuse(first.id);
    const [secondEntry] = await getGalleryEntriesForEventWithReuse(second.id);
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
      prisma.eventGalleryImage.count({
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

  it("skips images a slot owns", async () => {
    const [first, second] = await Promise.all([createDinner(), createDinner()]);

    await expect(
      linkExistingImagesToEvent(second.id, [first.imageId ?? ""]),
    ).resolves.toEqual([]);
    await expect(
      prisma.eventGalleryImage.count({ where: { eventId: second.id } }),
    ).resolves.toBe(0);
  });
});

describe("removeGalleryEntry", () => {
  it("unlinks one dinner, leaving the image and the other dinner intact", async () => {
    const [first, second] = await Promise.all([createDinner(), createDinner()]);
    const { entry } = await uploadOne(first.id);
    await linkExistingImagesToEvent(second.id, [entry.imageId]);

    const removed = await removeGalleryEntry(first.id, entry.id);

    expect(removed).toEqual({
      imageId: entry.imageId,
      // still hanging in the second dinner — destroying it would be the bug
      deletedStorageKey: null,
    });
    await expect(getGalleryEntriesForEvent(first.id)).resolves.toEqual([]);
    await expect(getGalleryEntriesForEvent(second.id)).resolves.toHaveLength(1);
    await expect(
      prisma.image.findUnique({ where: { id: entry.imageId } }),
    ).resolves.not.toBeNull();
  });

  it("deletes the image with the last membership", async () => {
    const dinner = await createDinner();
    const { entry, data } = await uploadOne(dinner.id);

    const removed = await removeGalleryEntry(dinner.id, entry.id);

    expect(removed).toEqual({
      imageId: entry.imageId,
      // nothing references the image anymore — the caller destroys the asset
      deletedStorageKey: data.storageKey,
    });
    await expect(
      prisma.image.findUnique({ where: { id: entry.imageId } }),
    ).resolves.toBeNull();
  });

  it("keeps an image another slot owns", async () => {
    const dinner = await createDinner();
    const portrait = await prisma.image.create({ data: buildGalleryImage() });
    const member = await prisma.boardMember.create({
      data: {
        name: faker.person.fullName(),
        position: "Cook",
        image: { connect: { id: portrait.id } },
      },
    });
    boardMemberIds.push(member.id);
    // built directly: the model refuses to hang slot-owned images in a gallery
    const entry = await prisma.eventGalleryImage.create({
      data: { eventId: dinner.id, imageId: portrait.id, position: 0 },
    });

    const removed = await removeGalleryEntry(dinner.id, entry.id);

    expect(removed?.deletedStorageKey).toBeNull();
    await expect(
      prisma.image.findUnique({ where: { id: portrait.id } }),
    ).resolves.not.toBeNull();
  });

  it("does not reach an entry through another dinner's id", async () => {
    const [first, second] = await Promise.all([createDinner(), createDinner()]);
    const { entry } = await uploadOne(first.id);

    await expect(removeGalleryEntry(second.id, entry.id)).resolves.toBeNull();
    await expect(getGalleryEntriesForEvent(first.id)).resolves.toHaveLength(1);
  });

  it("returns null for an entry that is already gone", async () => {
    const dinner = await createDinner();

    await expect(
      removeGalleryEntry(dinner.id, "does-not-exist"),
    ).resolves.toBeNull();
  });
});

describe("deleting a dinner", () => {
  it("cascades its entries but keeps the shared image and the other dinner", async () => {
    const [first, second] = await Promise.all([createDinner(), createDinner()]);
    const { entry, data } = await uploadOne(first.id);
    await linkExistingImagesToEvent(second.id, [entry.imageId]);

    const { imageKeys } = await deleteEvent(first.id);
    eventIds.splice(eventIds.indexOf(first.id), 1);

    expect(imageKeys).not.toContain(data.storageKey);
    await expect(
      prisma.eventGalleryImage.findUnique({ where: { id: entry.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.image.findUnique({ where: { id: entry.imageId } }),
    ).resolves.not.toBeNull();
    await expect(getGalleryEntriesForEvent(second.id)).resolves.toHaveLength(1);
  });

  it("releases an image only its own gallery showed", async () => {
    const dinner = await createDinner();
    const { entry, data } = await uploadOne(dinner.id);

    const { imageKeys } = await deleteEvent(dinner.id);
    eventIds.splice(eventIds.indexOf(dinner.id), 1);

    expect(imageKeys).toContain(data.storageKey);
    await expect(
      prisma.image.findUnique({ where: { id: entry.imageId } }),
    ).resolves.toBeNull();
  });
});

describe("slot images hanging in galleries", () => {
  /** A dinner whose cover also hangs in another dinner's gallery. */
  async function coverLinkedElsewhere() {
    const [dinner, other] = await Promise.all([createDinner(), createDinner()]);
    const coverId = dinner.imageId;
    if (!coverId) throw new Error(`Expected a cover for dinner ${dinner.id}`);
    // built directly: the model refuses to hang slot-owned images in a gallery
    await prisma.eventGalleryImage.create({
      data: { eventId: other.id, imageId: coverId, position: 0 },
    });
    return { dinner, coverId };
  }

  /** A board member whose portrait also hangs in a dinner's gallery. */
  async function portraitLinkedElsewhere() {
    const dinner = await createDinner();
    const portrait = await prisma.image.create({ data: buildGalleryImage() });
    const member = await prisma.boardMember.create({
      data: {
        name: faker.person.fullName(),
        position: "Cook",
        image: { connect: { id: portrait.id } },
      },
    });
    boardMemberIds.push(member.id);
    await prisma.eventGalleryImage.create({
      data: { eventId: dinner.id, imageId: portrait.id, position: 0 },
    });
    return { member, portraitId: portrait.id };
  }

  it("replacing a dinner's cover keeps the old cover a gallery shows", async () => {
    const { dinner, coverId } = await coverLinkedElsewhere();

    const { replacedImageKey } = await updateEvent(dinner.id, {
      image: buildGalleryImage(),
    });

    expect(replacedImageKey).toBeNull();
    await expect(
      prisma.image.findUnique({ where: { id: coverId } }),
    ).resolves.not.toBeNull();
  });

  it("deleting a dinner keeps the cover a gallery shows", async () => {
    const { dinner, coverId } = await coverLinkedElsewhere();

    const { imageKeys } = await deleteEvent(dinner.id);
    eventIds.splice(eventIds.indexOf(dinner.id), 1);

    expect(imageKeys).toEqual([]);
    await expect(
      prisma.image.findUnique({ where: { id: coverId } }),
    ).resolves.not.toBeNull();
  });

  it("replacing a board member's portrait keeps the old one a gallery shows", async () => {
    const { member, portraitId } = await portraitLinkedElsewhere();

    const { replacedImageKey } = await updateBoardMember(member.id, {
      name: member.name,
      position: member.position,
      image: buildGalleryImage(),
    });

    expect(replacedImageKey).toBeNull();
    await expect(
      prisma.image.findUnique({ where: { id: portraitId } }),
    ).resolves.not.toBeNull();
  });

  it("deleting a board member keeps the portrait a gallery shows", async () => {
    const { member, portraitId } = await portraitLinkedElsewhere();

    const { imageKey } = await deleteBoardMember(member.id);

    expect(imageKey).toBeNull();
    await expect(
      prisma.image.findUnique({ where: { id: portraitId } }),
    ).resolves.not.toBeNull();
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
    const image = await prisma.image.create({ data: buildGalleryImage() });

    const pool = await getLinkableImages(dinner.id);

    expect(pool).toContainEqual(
      expect.objectContaining({
        image: expect.objectContaining({ id: image.id }),
        usedIn: [],
      }),
    );
  });
});
