import { faker } from "@faker-js/faker";
import { afterEach, describe, expect, it } from "vitest";

import { buildEventData } from "../../test/factories";

import { createEvent, deleteEvent } from "./event.server";
import {
  addTaggedGalleryImages,
  countTaggedGalleryImagesForEvent,
  getTaggedGalleryImages,
  getTaggedGalleryImagesForEvent,
  removeTaggedGalleryImage,
  type TaggedGalleryImageCreateData,
} from "./gallery-tagged.server";

import { prisma } from "~/db.server";

// Every row this file creates carries the run's prefix in its storageKey, so
// the shared test database can be swept clean without touching other suites.
const KEY_PREFIX = `test/dinner-gallery/${faker.string.uuid()}`;
const createdEventIds: string[] = [];

function galleryImage(
  name: string,
  overrides: Partial<TaggedGalleryImageCreateData> = {},
): TaggedGalleryImageCreateData {
  return {
    contentType: "image/jpeg",
    storageKey: `${KEY_PREFIX}/${name}`,
    ...overrides,
  };
}

async function createDinner(date?: Date) {
  const event = await createEvent({
    ...(await buildEventData()),
    ...(date && { date }),
  });
  createdEventIds.push(event.id);
  return event;
}

afterEach(async () => {
  await prisma.image.deleteMany({
    where: { storageKey: { startsWith: KEY_PREFIX } },
  });
  const ids = createdEventIds.splice(0);
  for (const id of ids) {
    await deleteEvent(id).catch(() => {
      // already deleted by the test under exercise
    });
  }
});

describe("addTaggedGalleryImages", () => {
  it("appends each batch after the current last position", async () => {
    const dinner = await createDinner();

    const first = await addTaggedGalleryImages(dinner.id, [
      galleryImage("a"),
      galleryImage("b"),
    ]);
    const second = await addTaggedGalleryImages(dinner.id, [galleryImage("c")]);

    expect(first).toBe(2);
    expect(second).toBe(1);
    const images = await getTaggedGalleryImagesForEvent(dinner.id);
    expect(images.map((image) => image.position)).toEqual([0, 1, 2]);
    expect(images.map((image) => image.image.storageKey)).toEqual([
      `${KEY_PREFIX}/a`,
      `${KEY_PREFIX}/b`,
      `${KEY_PREFIX}/c`,
    ]);
    await expect(
      countTaggedGalleryImagesForEvent(dinner.id),
    ).resolves.toBe(3);
  });

  it("writes nothing for an empty batch", async () => {
    const dinner = await createDinner();

    await expect(addTaggedGalleryImages(dinner.id, [])).resolves.toBe(0);
    await expect(countTaggedGalleryImagesForEvent(dinner.id)).resolves.toBe(0);
  });

  it("keeps the dinner cover out of its gallery", async () => {
    const dinner = await createDinner();

    await addTaggedGalleryImages(dinner.id, [galleryImage("only")]);

    const images = await getTaggedGalleryImagesForEvent(dinner.id);
    expect(images).toHaveLength(1);
    expect(images[0].image.storageKey).toBe(`${KEY_PREFIX}/only`);
  });
});

describe("tagged gallery reads", () => {
  it("returns one dinner's images in display order with its caption and alt text", async () => {
    const dinner = await createDinner();
    await addTaggedGalleryImages(dinner.id, [
      galleryImage("first", { altText: "A plate", caption: "Course one" }),
      galleryImage("second"),
    ]);

    const images = await getTaggedGalleryImagesForEvent(dinner.id);

    expect(images).toMatchObject([
      {
        altText: "A plate",
        caption: "Course one",
        position: 0,
        event: { id: dinner.id, title: dinner.title },
      },
      { altText: null, caption: null, position: 1 },
    ]);
  });

  it("orders the global feed newest dinner first, then by position", async () => {
    const older = await createDinner(new Date("2100-01-01T18:00:00.000Z"));
    const newer = await createDinner(new Date("2100-06-01T18:00:00.000Z"));
    await addTaggedGalleryImages(older.id, [
      galleryImage("older-0"),
      galleryImage("older-1"),
    ]);
    await addTaggedGalleryImages(newer.id, [
      galleryImage("newer-0"),
      galleryImage("newer-1"),
    ]);

    const feed = await getTaggedGalleryImages();

    const mine = feed.filter((image) =>
      image.image.storageKey.startsWith(KEY_PREFIX),
    );
    expect(mine.map((image) => image.image.storageKey)).toEqual([
      `${KEY_PREFIX}/newer-0`,
      `${KEY_PREFIX}/newer-1`,
      `${KEY_PREFIX}/older-0`,
      `${KEY_PREFIX}/older-1`,
    ]);
  });
});

describe("removeTaggedGalleryImage", () => {
  it("returns the deleted row's storage key and leaves the dinner standing", async () => {
    const dinner = await createDinner();
    await addTaggedGalleryImages(dinner.id, [
      galleryImage("kept"),
      galleryImage("dropped"),
    ]);
    const [, dropped] = await getTaggedGalleryImagesForEvent(dinner.id);

    const storageKey = await removeTaggedGalleryImage(dropped.image.id);

    expect(storageKey).toBe(`${KEY_PREFIX}/dropped`);
    await expect(
      prisma.image.findUnique({ where: { id: dropped.image.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.event.findUnique({ where: { id: dinner.id } }),
    ).resolves.not.toBeNull();
    const remaining = await getTaggedGalleryImagesForEvent(dinner.id);
    expect(remaining.map((image) => image.image.storageKey)).toEqual([
      `${KEY_PREFIX}/kept`,
    ]);
  });

  it("returns null for an unknown image and for a non-gallery image", async () => {
    const dinner = await createDinner();
    const cover = await prisma.image.findUniqueOrThrow({
      where: { eventId: dinner.id },
    });

    await expect(removeTaggedGalleryImage("does-not-exist")).resolves.toBeNull();
    await expect(removeTaggedGalleryImage(cover.id)).resolves.toBeNull();
    await expect(
      prisma.image.findUnique({ where: { id: cover.id } }),
    ).resolves.not.toBeNull();
  });
});

describe("dinner deletion", () => {
  it("cascades the dinner's gallery images away", async () => {
    const dinner = await createDinner();
    await addTaggedGalleryImages(dinner.id, [
      galleryImage("cascade-0"),
      galleryImage("cascade-1"),
    ]);

    await deleteEvent(dinner.id);

    await expect(
      prisma.image.count({ where: { storageKey: { startsWith: KEY_PREFIX } } }),
    ).resolves.toBe(0);
    await expect(countTaggedGalleryImagesForEvent(dinner.id)).resolves.toBe(0);
  });
});
