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
