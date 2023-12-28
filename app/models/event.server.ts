import type { Prisma } from "@prisma/client";

import { prisma } from "~/db.server";

export async function getEvents(filter?: Prisma.EventWhereInput) {
  return prisma.event.findMany({
    where: filter,
  });
}

export async function getEventById(id: string) {
  return prisma.event.findFirst({ where: { id } });
}

export async function createEvent({
  title,
  description,
  date,
  slots,
  price,
  cover,
  addressId,
}: {
  title: string;
  description: string;
  date: Date;
  slots: number;
  price: number;
  cover: string;
  addressId: string;
}) {
  return prisma.event.create({
    data: {
      title,
      description,
      date,
      slots,
      price,
      cover,
      addressId,
    },
  });
}
