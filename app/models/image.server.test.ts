import { faker } from "@faker-js/faker";
import { afterEach, describe, expect, it } from "vitest";

import { buildEventData } from "../../test/factories";

import { createBoardMember } from "./board-member.server";
import { createEvent, deleteEventsInTx } from "./event.server";
import { createGalleryImagesForEvent } from "./gallery.server";
import {
  getImageUsage,
  IMAGE_REFERENCE_SITES,
  type ImageCreateData,
} from "./image.server";

import { prisma } from "~/db.server";

const KEY_PREFIX = "test/image-usage/";
const eventIds: string[] = [];
const boardMemberIds: string[] = [];

function buildImage(): ImageCreateData {
  return {
    contentType: "image/jpeg",
    storageKey: `${KEY_PREFIX}${faker.string.uuid()}`,
  };
}

afterEach(async () => {
  const ids = eventIds.splice(0);
  if (ids.length > 0) {
    await prisma.$transaction((tx) =>
      deleteEventsInTx(tx, { id: { in: ids } }),
    );
  }
  const members = boardMemberIds.splice(0);
  if (members.length > 0) {
    await prisma.boardMember.deleteMany({ where: { id: { in: members } } });
  }
  await prisma.image.deleteMany({
    where: { storageKey: { startsWith: KEY_PREFIX } },
  });
});

describe("getImageUsage", () => {
  it("reports the dinner whose cover slot holds the image", async () => {
    const event = await createEvent(await buildEventData());
    eventIds.push(event.id);

    await expect(getImageUsage(event.imageId ?? "")).resolves.toEqual({
      coverOfEventId: event.id,
      portraitOfBoardMemberId: null,
      galleryEventIds: [],
    });
  });

  it("reports the board member whose portrait the image is", async () => {
    const member = await createBoardMember({
      name: faker.person.fullName(),
      position: "Cook",
      image: buildImage(),
    });
    boardMemberIds.push(member.id);

    await expect(getImageUsage(member.imageId ?? "")).resolves.toEqual({
      coverOfEventId: null,
      portraitOfBoardMemberId: member.id,
      galleryEventIds: [],
    });
  });

  it("reports every dinner whose gallery links the image", async () => {
    const event = await createEvent(await buildEventData());
    eventIds.push(event.id);
    const [entry] = await createGalleryImagesForEvent(event.id, [buildImage()]);

    await expect(getImageUsage(entry.imageId)).resolves.toEqual({
      coverOfEventId: null,
      portraitOfBoardMemberId: null,
      galleryEventIds: [event.id],
    });
  });

  it("reports an image nothing references as unused", async () => {
    const image = await prisma.image.create({ data: buildImage() });

    await expect(getImageUsage(image.id)).resolves.toEqual({
      coverOfEventId: null,
      portraitOfBoardMemberId: null,
      galleryEventIds: [],
    });
  });

  it("returns null for an unknown id", async () => {
    await expect(getImageUsage("does-not-exist")).resolves.toBeNull();
  });
});

interface RuntimeDataModel {
  models: Record<string, { fields: { name: string; kind: string }[] }>;
}

describe("IMAGE_REFERENCE_SITES", () => {
  it("covers every schema relation that targets Image", () => {
    const { models } = (
      prisma as unknown as { _runtimeDataModel: RuntimeDataModel }
    )._runtimeDataModel;

    // Prisma requires a back-relation on Image for every relation targeting
    // it, so Image's object-kind fields enumerate them all. A mismatch means
    // a new context points at Image without teaching the usage/cleanup logic
    // about it — extend the registry in image.server.ts.
    const relationsToImage = models.Image.fields
      .filter((field) => field.kind === "object")
      .map((field) => field.name)
      .sort();

    expect(relationsToImage).toEqual(Object.keys(IMAGE_REFERENCE_SITES).sort());
  });
});
