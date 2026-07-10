import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { faker } from "@faker-js/faker";

import { prisma } from "~/db.server";
import { createUserViaAuth } from "~/features/auth/create-user.server";
import { createEvent } from "~/models/event.server";

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

  const roleNames = ["user", "moderator", "admin"];

  for (const role of roleNames) {
    await prisma.role.create({ data: { name: role } });
  }

  // through better-auth's API so hashes/accounts are shape-correct; the demo
  // accounts are pre-verified so they can log in straight away
  await createUserViaAuth({
    email: userEmail,
    password: "mokupona",
    name: "demo user",
    roleName: "user",
  });

  const moderator = await createUserViaAuth({
    email: moderatorEmail,
    password: "mokupona",
    name: "demo moderator",
    roleName: "moderator",
  });

  await createUserViaAuth({
    email: adminEmail,
    password: "mokupona",
    name: "demo admin",
    roleName: "admin",
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
  const image = await prisma.image.create({
    data: {
      contentType: "image/jpg",
      blob: Buffer.from(defaultImage.buffer),
    },
  });
  const image2 = await prisma.image.create({
    data: {
      contentType: "image/jpg",
      blob: Buffer.from(defaultImage.buffer),
    },
  });

  // createEvent (not prisma.event.create) so every seeded event gets its
  // form + first version, like production writes
  const event = await createEvent({
    title: faker.lorem.sentence({ min: 3, max: 7 }),
    description: faker.lorem.paragraphs({ min: 3, max: 7 }),
    date: faker.date.soon({ days: 3 }),
    slots: faker.number.int({ min: 10, max: 20 }),
    price: faker.number.int({ min: 15, max: 30 }),
    imageId: image.id,
    addressId: address.id,
    createdById: moderator.id,
  });

  await createEvent({
    title: faker.lorem.sentence({ min: 3, max: 7 }),
    description: faker.lorem.paragraphs({ min: 3, max: 7 }),
    date: faker.date.soon({ days: 3 }),
    slots: faker.number.int({ min: 10, max: 20 }),
    price: faker.number.int({ min: 15, max: 30 }),
    imageId: image2.id,
    addressId: address.id,
    createdById: moderator.id,
  });

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
