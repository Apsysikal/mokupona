import { Prisma } from "@prisma/client";

import { prisma } from "~/db.server";

export async function getAddresses(filter?: Prisma.AddressWhereInput) {
  return prisma.address.findMany({
    where: filter,
  });
}
