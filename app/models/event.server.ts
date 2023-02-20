import { prisma } from "~/db.server";

import type { Prisma } from "@prisma/client";
export type { Event } from "@prisma/client";

export async function getEvents() {
  return prisma.event.findMany({
    select: {
      id: true,
      title: true,
      subtitle: true,
      date: true,
      signupDate: true,
      slots: true,
      tags: true,
      imageUrl: true,
      location: true,
      price: true,
      shortDescription: true,
      description: true,
      locationId: true,
      EventResponse: {
        select: { id: true },
      },
    },
    orderBy: { date: "asc" },
  });
}

export async function getEventById(id: string) {
  return prisma.event.findUnique({
    where: { id },
    select: {
      title: true,
      subtitle: true,
      date: true,
      signupDate: true,
      slots: true,
      tags: true,
      imageUrl: true,
      location: true,
      price: true,
      description: true,
      EventResponse: {
        select: { id: true },
      },
    },
  });
}

export async function createEvent(data: Prisma.EventUncheckedCreateInput) {
  return prisma.event.create({
    data,
  });
}
