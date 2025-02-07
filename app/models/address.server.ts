import type { Prisma } from "@prisma/client";

import { prisma } from "~/db.server";

export async function getAddresses(filter?: Prisma.AddressWhereInput) {
  return prisma.address.findMany({
    where: filter,
  });
}

export async function getAddressById(id: string) {
  return prisma.address.findUnique({ where: { id } });
}

export async function createAddress({
  streetName,
  houseNumber,
  zip,
  city,
}: {
  streetName: string;
  houseNumber: string;
  zip: string;
  city: string;
}) {
  return prisma.address.create({
    data: {
      streetName,
      houseNumber,
      zip,
      city,
    },
  });
}

export async function updateAddress(
  id: string,
  {
    streetName,
    houseNumber,
    zip,
    city,
  }: {
    streetName: string;
    houseNumber: string;
    zip: string;
    city: string;
  },
) {
  return prisma.address.update({
    where: { id },
    data: {
      streetName,
      houseNumber,
      zip,
      city,
    },
  });
}

export async function deleteAddress(id: string) {
  return prisma.address.delete({
    where: { id },
  });
}
