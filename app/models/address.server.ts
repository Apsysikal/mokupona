import type { Address } from "#prisma/generated/client";

import { prisma } from "~/db.server";
import { deleteEventsInTx } from "~/models/event.server";

export type { Address } from "#prisma/generated/client";

// the admin tab bar shows a count pill per section
export async function countAddresses(): Promise<number> {
  return prisma.address.count();
}

export async function getAddresses(): Promise<Address[]> {
  return prisma.address.findMany();
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

// The DB cascades Address -> Event, which would skip the app-level form
// cascade and orphan Form/FormVersion/FormSubmission rows — delete the
// address's events through it first, in the same transaction.
export async function deleteAddress(id: string) {
  return prisma.$transaction(async (tx) => {
    await deleteEventsInTx(tx, { addressId: id });
    return tx.address.delete({ where: { id } });
  });
}
