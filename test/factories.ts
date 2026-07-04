import { faker } from "@faker-js/faker";

import { prisma } from "~/db.server";

// Builds the row graph an Event needs (role -> user, address, image) and
// returns ready-to-use event create data. Every call creates fresh rows with
// unique keys, so the tests sharing one database never contend on fixtures.
export async function buildEventData() {
  const [user, address, image] = await Promise.all([
    prisma.role
      .create({ data: { name: `test-role-${faker.string.uuid()}` } })
      .then((role) =>
        prisma.user.create({
          data: {
            email: `test-${faker.string.uuid()}@example.com`,
            roleId: role.id,
          },
        }),
      ),
    prisma.address.create({
      data: {
        streetName: faker.location.street(),
        // part of the address' compound unique key — keep it collision-free
        houseNumber: faker.string.uuid(),
        zip: faker.location.zipCode("####"),
        city: faker.location.city(),
      },
    }),
    prisma.image.create({
      data: {
        contentType: "image/jpeg",
        blob: Buffer.from("test-image"),
      },
    }),
  ]);

  return {
    title: faker.lorem.sentence({ min: 3, max: 7 }),
    description: faker.lorem.paragraph(),
    date: faker.date.soon({ days: 3 }),
    slots: 10,
    price: 20,
    imageId: image.id,
    addressId: address.id,
    createdById: user.id,
  };
}
