import { faker } from "@faker-js/faker";
import { afterEach, describe, expect, it } from "vitest";

import { buildEventData } from "../../test/factories";

import { createEvent, deleteEvent } from "./event.server";
import {
  addImagesToAlbum,
  createStandaloneAlbum,
  ensureAlbumForEvent,
  getAlbumForEvent,
  getAlbumImagesForEvent,
  getAllAlbumImages,
  removeAlbumImage,
} from "./gallery-album.server";

import { prisma } from "~/db.server";

// Standalone albums hang off no dinner, so nothing cascades them away.
const createdAlbumIds: string[] = [];

afterEach(async () => {
  if (createdAlbumIds.length === 0) return;
  await prisma.album.deleteMany({ where: { id: { in: createdAlbumIds } } });
  createdAlbumIds.length = 0;
});

async function trackStandaloneAlbum(title: string) {
  const album = await createStandaloneAlbum({ title });
  createdAlbumIds.push(album.id);
  return album;
}

function buildImages(count: number) {
  return Array.from({ length: count }, () => ({
    contentType: "image/jpeg",
    storageKey: `test/dinner-gallery/${faker.string.uuid()}`,
  }));
}

describe("ensureAlbumForEvent", () => {
  it("is idempotent — the second call returns the first album", async () => {
    const event = await createEvent(await buildEventData());

    const first = await ensureAlbumForEvent(event.id, { title: "First" });
    const second = await ensureAlbumForEvent(event.id, { title: "Second" });

    expect(second.id).toBe(first.id);
    // the defaults only apply to the create — an existing album keeps its copy
    expect(second.title).toBe("First");
    await expect(
      prisma.album.count({ where: { eventId: event.id } }),
    ).resolves.toBe(1);
  });
});

describe("addImagesToAlbum", () => {
  it("appends after the current max position across uploads", async () => {
    const event = await createEvent(await buildEventData());
    const album = await ensureAlbumForEvent(event.id, { title: "Gallery" });
    const [first, second] = buildImages(2);
    const [third] = buildImages(1);

    await addImagesToAlbum(album.id, [first, second]);
    await addImagesToAlbum(album.id, [third]);

    const rows = await getAlbumImagesForEvent(event.id);
    expect(rows.map((row) => row.position)).toEqual([0, 1, 2]);
    expect(rows.map((row) => row.image.storageKey)).toEqual([
      first.storageKey,
      second.storageKey,
      third.storageKey,
    ]);
  });
});

describe("getAllAlbumImages", () => {
  it("returns a standalone album's images with no dinner attached", async () => {
    const album = await trackStandaloneAlbum("kitchen life");
    const [image] = buildImages(1);
    await addImagesToAlbum(album.id, [image]);

    const rows = await getAllAlbumImages();

    const row = rows.find((candidate) => candidate.album.id === album.id);
    expect(row).toBeDefined();
    expect(row?.album.event).toBeNull();
    expect(row?.image.storageKey).toBe(image.storageKey);
  });

  it("puts dinner-backed albums before standalone ones", async () => {
    const event = await createEvent(await buildEventData());
    const dinnerAlbum = await ensureAlbumForEvent(event.id, {
      title: "Dinner",
    });
    await addImagesToAlbum(dinnerAlbum.id, buildImages(1));
    const standalone = await trackStandaloneAlbum("the team");
    await addImagesToAlbum(standalone.id, buildImages(1));

    const albumOrder = (await getAllAlbumImages()).map((row) => row.album.id);

    expect(albumOrder.indexOf(dinnerAlbum.id)).toBeLessThan(
      albumOrder.indexOf(standalone.id),
    );
  });
});

describe("removeAlbumImage", () => {
  it("deletes the row and returns its storage key for the caller to destroy", async () => {
    const album = await trackStandaloneAlbum("removable");
    const [image] = buildImages(1);
    await addImagesToAlbum(album.id, [image]);
    const [row] = await getAllAlbumImages().then((rows) =>
      rows.filter((candidate) => candidate.album.id === album.id),
    );

    const result = await removeAlbumImage(row.image.id);

    expect(result.storageKey).toBe(image.storageKey);
    await expect(
      prisma.image.findUnique({ where: { id: row.image.id } }),
    ).resolves.toBeNull();
  });

  it("refuses an image that is in no album", async () => {
    const event = await createEvent(await buildEventData());
    const cover = await prisma.image.findUniqueOrThrow({
      where: { eventId: event.id },
    });

    await expect(removeAlbumImage(cover.id)).rejects.toThrow();
    await expect(
      prisma.image.findUnique({ where: { id: cover.id } }),
    ).resolves.not.toBeNull();
  });
});

describe("album lifecycle", () => {
  it("deleting the dinner cascades its album and that album's images", async () => {
    const event = await createEvent(await buildEventData());
    const album = await ensureAlbumForEvent(event.id, { title: "Doomed" });
    const images = buildImages(2);
    await addImagesToAlbum(album.id, images);

    await deleteEvent(event.id);

    await expect(getAlbumForEvent(event.id)).resolves.toBeNull();
    await expect(
      prisma.album.findUnique({ where: { id: album.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.image.count({
        where: { storageKey: { in: images.map((image) => image.storageKey) } },
      }),
    ).resolves.toBe(0);
  });
});
