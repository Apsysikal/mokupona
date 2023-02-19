import { prisma } from "~/db.server";

import type { Prisma } from "@prisma/client";
export type { Event } from "@prisma/client";

export async function getEvents() {
  return prisma.event.findMany();
}

export async function getEventById(id: string) {
  return prisma.event.findUnique({
    where: { id },
    select: {
      title: true,
      subtitle: true,
      date: true,
      tags: true,
      imageUrl: true,
      location: true,
      price: true,
      description: true,
    },
  });
}

export async function createEvent(data: Prisma.EventUncheckedCreateInput) {
  return prisma.event.create({
    data,
  });
}
