import { faker } from "@faker-js/faker";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seed() {
  const email = "rachel@remix.run";

  // cleanup the existing database
  await prisma.user.delete({ where: { email } }).catch(() => {
    // no worries if it doesn't exist yet
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

  const hashedPassword = await bcrypt.hash("racheliscool", 10);

  const user = await prisma.user.create({
    data: {
      email,
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

  const event = await prisma.event.create({
    data: {
      title: faker.lorem.sentence({ min: 3, max: 7 }),
      description: faker.lorem.paragraphs({ min: 3, max: 7 }),
      date: faker.date.soon({ days: 3 }),
      slots: faker.number.int({ min: 10, max: 20 }),
      price: faker.number.int({ min: 15, max: 30 }),
      cover: faker.image.url({ width: 1200, height: 600 }),
      addressId: address.id,
      createdById: user.id,
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
      addressId: address.id,
      createdById: user.id,
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
