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

  await prisma.note.create({
    data: {
      title: "My first note",
      body: "Hello, world!",
      userId: user.id,
    },
  });

  await prisma.note.create({
    data: {
      title: "My second note",
      body: "Hello, world!",
      userId: user.id,
    },
  });

  const address = await prisma.address.create({
    data: {
      streetName: faker.location.street(),
      houseNumber: faker.location.buildingNumber(),
      zip: faker.location.zipCode("####"),
      city: faker.location.city()
    }
  })

  await prisma.event.create({
    data: {
      title: faker.lorem.sentence({min: 3, max: 7}),
      subtitle: faker.lorem.sentence({min: 3, max: 7}),
      summary: faker.lorem.sentences(),
      description: faker.lorem.paragraphs({ min: 3, max: 7}),
      tags: faker.word.words(3),
      date: faker.date.soon({days: 3}),
      signupStart: faker.date.soon({days: 1}),
      slots: faker.number.int({min: 10, max: 20}),
      price: faker.number.int({min: 15, max: 30}),
      cover: faker.image.url({width: 1200, height: 600}),
      addressId: address.id
    }
  })

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
