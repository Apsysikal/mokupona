import { prisma } from "~/db.server";

export async function createEventResponse(
  eventId: string,
  name: string,
  email: string,
) {
  return prisma.eventResponse.create({
    data: {
      name,
      email,
      eventId,
    },
  });
}
