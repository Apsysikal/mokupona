import { faker } from "@faker-js/faker";

import { prisma } from "~/db.server";
import { ROLE_NAMES } from "~/features/auth/roles";

function ensureRole(name: string) {
  return prisma.role.upsert({
    where: { name },
    create: { name },
    update: {},
  });
}

export function ensureAuthRoles() {
  return Promise.all(ROLE_NAMES.map(ensureRole));
}

function createUserForRole(roleId: string) {
  return prisma.user.create({
    data: {
      email: `test-${faker.string.uuid()}@example.com`,
      name: faker.person.fullName(),
      roleId,
    },
  });
}

export async function createTestUser(roleName = "user") {
  const role = await ensureRole(roleName);
  return createUserForRole(role.id);
}

export async function buildEventData() {
  const [user, address] = await Promise.all([
    prisma.role
      .create({ data: { name: `test-role-${faker.string.uuid()}` } })
      .then((role) => createUserForRole(role.id)),
    prisma.address.create({
      data: {
        streetName: faker.location.street(),
        houseNumber: faker.string.uuid(),
        zip: faker.location.zipCode("####"),
        city: faker.location.city(),
      },
    }),
  ]);

  return {
    title: faker.lorem.sentence({ min: 3, max: 7 }),
    description: faker.lorem.paragraph(),
    date: faker.date.soon({ days: 3 }),
    slots: 10,
    price: 20,
    image: {
      contentType: "image/jpeg",
      storageKey: `test/dinners/${faker.string.uuid()}`,
    },
    addressId: address.id,
    createdById: user.id,
  };
}
