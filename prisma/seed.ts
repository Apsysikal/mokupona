import { readFile } from "node:fs/promises";
import path from "node:path";

import { faker } from "@faker-js/faker";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

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

  await prisma.address.deleteMany().catch(() => {
    /** */
  });

  await prisma.eventResponse.deleteMany().catch(() => {
    /** */
  });

  const hashedPassword = await bcrypt.hash("mokupona", 10);

  const roleNames = ["user", "moderator", "admin"];

  const roles = await Promise.all(
    roleNames.map((role) => {
      return prisma.role.create({
        data: {
          name: role,
        },
      });
    }),
  );

  await prisma.user.create({
    data: {
      email: userEmail,
      roleId: roles[0].id,
      password: {
        create: {
          hash: hashedPassword,
        },
      },
    },
  });

  const moderator = await prisma.user.create({
    data: {
      email: moderatorEmail,
      roleId: roles[1].id,
      password: {
        create: {
          hash: hashedPassword,
        },
      },
    },
  });

  await prisma.user.create({
    data: {
      email: adminEmail,
      roleId: roles[2].id,
      password: {
        create: {
          hash: hashedPassword,
        },
      },
    },
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
  const image = await prisma.eventImage.create({
    data: {
      contentType: "image/jpg",
      blob: Buffer.from(defaultImage.buffer),
    },
  });
  const image2 = await prisma.eventImage.create({
    data: {
      contentType: "image/jpg",
      blob: Buffer.from(defaultImage.buffer),
    },
  });

  const event = await prisma.event.create({
    data: {
      title: faker.lorem.sentence({ min: 3, max: 7 }),
      description: faker.lorem.paragraphs({ min: 3, max: 7 }),
      date: faker.date.soon({ days: 3 }),
      slots: faker.number.int({ min: 10, max: 20 }),
      price: faker.number.int({ min: 15, max: 30 }),
      cover: faker.image.url({ width: 1200, height: 600 }),
      imageId: image.id,
      addressId: address.id,
      createdById: moderator.id,
    },
  });

  await prisma.event.create({
    data: {
      title: faker.lorem.sentence({ min: 3, max: 7 }),
      description: faker.lorem.paragraphs({ min: 3, max: 7 }),
      date: faker.date.soon({ days: 3 }),
      slots: faker.number.int({ min: 10, max: 20 }),
      price: faker.number.int({ min: 15, max: 30 }),
      cover: faker.image.url({ width: 1200, height: 600 }),
      imageId: image2.id,
      addressId: address.id,
      createdById: moderator.id,
    },
  });

  for (let i = 0; i < 15; i++) {
    await prisma.eventResponse.create({
      data: {
        email: faker.internet.email(),
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
