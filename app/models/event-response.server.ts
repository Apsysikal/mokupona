import { prisma } from "~/db.server";

export async function createEventResponse(
  eventId: string,
  name: string,
  email: string,
  vegetarian = false,
  student = false,
  restrictions?: string,
  comment?: string,
) {
  return prisma.eventResponse.create({
    data: {
      name,
      email,
      eventId,
      vegetarian,
      student,
      restrictions,
      comment,
    },
  });
}

export async function getEventResponsesForEvent(eventId: string) {
  return prisma.eventResponse.findMany({
    where: {
      eventId,
    },
  });
}
