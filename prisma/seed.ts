import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { faker } from "@faker-js/faker";

const prisma = new PrismaClient();

async function seed() {
  const email = "dev@mokupona.ch";

  // cleanup the existing database
  await prisma.user.delete({ where: { email } }).catch(() => {
    // no worries if it doesn't exist yet
  });

  const hashedPassword = await bcrypt.hash("mokuisawesome", 10);

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

  // cleanup the existing database
  await prisma.location.deleteMany().catch(() => {});

  const location = await prisma.location.create({ data: getLocation() });

  // Cleanup the existing database
  await prisma.event.deleteMany().catch(() => {});

  await Promise.all(
    getDinners(location.id).map((dinner) => {
      return prisma.event.create({ data: dinner });
    })
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

function getLocation() {
  return {
    street: faker.address.street(),
    zipCode: faker.address.zipCode("####"),
    zipName: faker.address.cityName(),
  };
}

function getDinners(locationId: string) {
  return [
    {
      title: faker.lorem.sentence(3),
      subtitle: faker.lorem.sentence(3),
      tags: faker.lorem.words(3),
      imageUrl: faker.image.food(1200, 800),
      date: faker.datatype.datetime({ min: Date.now() }).toISOString(),
      price: 25,
      description: faker.lorem.paragraph(25),
      shortDescription: faker.lorem.paragraph(5),
      locationId,
    },
    {
      title: faker.lorem.sentence(3),
      subtitle: faker.lorem.sentence(3),
      tags: faker.lorem.words(3),
      imageUrl: faker.image.food(1200, 800),
      date: faker.datatype.datetime({ min: Date.now() }).toISOString(),
      price: 25,
      description: faker.lorem.paragraph(25),
      shortDescription: faker.lorem.paragraph(5),
      locationId,
    },
    {
      title: faker.lorem.sentence(3),
      subtitle: faker.lorem.sentence(3),
      tags: faker.lorem.words(3),
      imageUrl: faker.image.food(1200, 800),
      date: faker.datatype.datetime({ min: Date.now() }).toISOString(),
      price: 25,
      description: faker.lorem.paragraph(25),
      shortDescription: faker.lorem.paragraph(5),
      locationId,
    },
  ];
}
