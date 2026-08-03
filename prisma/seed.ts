import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { faker } from "@faker-js/faker";

import { prisma } from "~/db.server";
import { createUserViaAuth } from "~/features/auth/create-user.server";
import { ROLE_NAMES } from "~/features/auth/roles";
import { storeImage } from "~/features/images/image-storage.server";
import { createEvent } from "~/models/event.server";
import {
  addImagesToAlbum,
  createStandaloneAlbum,
  ensureAlbumForEvent,
} from "~/models/gallery-album.server";
import { createGalleryImagesForEvent } from "~/models/gallery-join.server";
import { addTaggedGalleryImages } from "~/models/gallery-tagged.server";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function seed() {
  const userEmail = "user@mokupona.ch";
  const moderatorEmail = "moderator@mokupona.ch";
  const adminEmail = "admin@mokupona.ch";

  // cleanup the existing database
  await prisma.user.deleteMany().catch(() => {
    /** */
  });

  await prisma.role.deleteMany().catch(() => {
    /** */
  });

  await prisma.event.deleteMany().catch(() => {
    /** */
  });

  // forms after events: Event.formId restricts deleting a referenced form
  await prisma.formSubmission.deleteMany().catch(() => {
    /** */
  });

  await prisma.formVersion.deleteMany().catch(() => {
    /** */
  });

  await prisma.form.deleteMany().catch(() => {
    /** */
  });

  await prisma.address.deleteMany().catch(() => {
    /** */
  });

  await prisma.eventResponse.deleteMany().catch(() => {
    /** */
  });

  // Gallery prototypes. Entries and dinner-owned albums cascade with their
  // event, but standalone albums (foundation "album") and pool images
  // (foundation "join") belong to nothing and would survive every reseed.
  await prisma.eventGalleryEntry.deleteMany().catch(() => {
    /** */
  });

  await prisma.album.deleteMany().catch(() => {
    /** */
  });

  await prisma.image
    .deleteMany({
      where: {
        eventId: null,
        boardMemberId: null,
        galleryEventId: null,
        albumId: null,
      },
    })
    .catch(() => {
      /** */
    });

  for (const role of ROLE_NAMES) {
    await prisma.role.create({ data: { name: role } });
  }

  // through better-auth's API so hashes/accounts are shape-correct; the demo
  // accounts are pre-verified so they can log in straight away
  await createUserViaAuth({
    email: userEmail,
    password: "mokupona",
    name: "demo user",
    roleName: "user",
    emailVerified: true,
  });

  const moderator = await createUserViaAuth({
    email: moderatorEmail,
    password: "mokupona",
    name: "demo moderator",
    roleName: "moderator",
    emailVerified: true,
  });

  await createUserViaAuth({
    email: adminEmail,
    password: "mokupona",
    name: "demo admin",
    roleName: "admin",
    emailVerified: true,
  });

  const address = await prisma.address.create({
    data: {
      streetName: faker.location.street(),
      houseNumber: faker.location.buildingNumber(),
      zip: faker.location.zipCode("####"),
      city: faker.location.city(),
    },
  });

  const defaultImage = await readFile(path.join(__dirname, "default.jpg"));

  // createEvent (not prisma.event.create) so every seeded event gets its
  // form + first version and its own cover image row, like production
  // writes; each event's cover is stored through the image provider (the
  // local one under dev/e2e — offline), one stored file per event so a
  // cover replacement can never orphan a sibling's file
  const seedEvent = async (date = faker.date.soon({ days: 3 })) =>
    createEvent({
      title: faker.lorem.sentence({ min: 3, max: 7 }),
      description: faker.lorem.paragraphs({ min: 3, max: 7 }),
      date,
      slots: faker.number.int({ min: 10, max: 20 }),
      price: faker.number.int({ min: 15, max: 30 }),
      image: {
        contentType: "image/jpeg",
        ...(await storeImage(
          new File([defaultImage], "default.jpg", { type: "image/jpeg" }),
          "dinners",
        )),
      },
      addressId: address.id,
      createdById: moderator.id,
    });

  const event = await seedEvent();
  await seedEvent();

  for (let i = 0; i < event.slots - 5; i++) {
    await prisma.eventResponse.create({
      data: {
        email: faker.internet.email(),
        phone: faker.phone.number(),
        name: faker.person.fullName(),
        eventId: event.id,
      },
    });
  }

  // The gallery only shows on dinners that already happened, so the
  // prototypes need one — and it gets filled three times over, once per
  // foundation, because the three write to tables that cannot see each other.
  const pastEvent = await seedEvent(faker.date.recent({ days: 45 }));

  const storeGalleryImages = async (count: number, caption: string) =>
    Promise.all(
      Array.from({ length: count }, async (_unused, index) => ({
        contentType: "image/jpeg",
        // one stored file per row: sharing a storageKey would make any single
        // removal destroy the bytes out from under its siblings
        ...(await storeImage(
          new File([defaultImage], "gallery.jpg", { type: "image/jpeg" }),
          "dinner-gallery",
        )),
        altText: `${pastEvent.title} — photo ${index + 1}`,
        caption: index % 2 === 0 ? `${caption} ${index + 1}` : null,
      })),
    );

  await addTaggedGalleryImages(
    pastEvent.id,
    await storeGalleryImages(7, "the table, plate"),
  );

  await createGalleryImagesForEvent(
    pastEvent.id,
    await storeGalleryImages(7, "hands and glasses, frame"),
  );

  const eventAlbum = await ensureAlbumForEvent(pastEvent.id, {
    title: pastEvent.title,
    description: "everything we managed to photograph before it was eaten.",
  });
  await addImagesToAlbum(
    eventAlbum.id,
    await storeGalleryImages(7, "the evening, moment"),
  );

  // only the album foundation can hold a gallery that is about no dinner at
  // all — seeded so that capability is visible instead of theoretical
  const standaloneAlbum = await createStandaloneAlbum({
    title: "kitchen life",
    description: "the half of the evening nobody at the table sees.",
  });
  await addImagesToAlbum(
    standaloneAlbum.id,
    await storeGalleryImages(4, "prep, step"),
  );

  console.log(`Database has been seeded. 🌱`);
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
