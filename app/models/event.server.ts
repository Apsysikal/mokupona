import type { Prisma } from "@prisma/client";

import { prisma } from "~/db.server";

type EventsFilter = Prisma.EventWhereInput;

type EventCreateInput = Prisma.EventUncheckedCreateInput;
type EventUpdateInput = Prisma.EventUncheckedUpdateInput;

export async function getEvents(filter?: EventsFilter) {
  return prisma.event.findMany({
    where: filter,
    orderBy: {
      date: "asc",
    },
  });
}

export async function getEventById(id: string) {
  return prisma.event.findUnique({
    where: { id },
    include: {
      address: true,
    },
  });
}

export async function createEvent(data: EventCreateInput) {
  return prisma.event.create({
    data,
  });
}

export async function updateEvent(id: string, data: EventUpdateInput) {
  return prisma.event.update({
    where: { id },
    data,
  });
}

export async function deleteEvent(id: string) {
  return prisma.event.delete({
    where: { id },
  });
}
