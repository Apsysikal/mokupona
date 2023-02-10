import { PrismaClient } from "@prisma/client";
import { faker } from "@faker-js/faker";

const prisma = new PrismaClient();

async function seed() {
  const locations = await prisma.location.createMany({
    data: getLocations(),
  });

  const location = await prisma.location.findFirst();
  if (!location) throw new Error("Something went wrong seeding locations");

  const events = await prisma.event.createMany({
    data: getDinners(location.id),
  });
}

function getLocations() {
  return [
    {
      street: faker.address.street(),
      zipCode: faker.address.zipCode("####"),
      zipName: faker.address.cityName(),
    },
  ];
}

function getDinners(locationId: string) {
  return [
    {
      title: faker.lorem.sentence(3),
      subtitle: faker.lorem.sentence(3),
      tags: faker.lorem.words(3).split(" "),
      imageUrl: faker.image.food(1200, 800),
      date: faker.datatype.datetime({ min: Date.now() }).toISOString(),
      price: 25,
      description: faker.lorem.paragraph(25),
      shortDescription: faker.lorem.paragraph(5),
      locationId,
    },
  ];
}

seed();
