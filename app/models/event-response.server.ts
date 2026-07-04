import { prisma } from "~/db.server";

// One transaction for a whole signup party: a partial failure must not
// persist a subset of attendees, or the prompted retry duplicates them.
export async function createEventResponses(
  eventId: string,
  responses: {
    name: string;
    email: string;
    phone: string;
    vegetarian?: boolean;
    student?: boolean;
    restrictions?: string;
    comment?: string;
  }[],
) {
  return prisma.$transaction(
    responses.map((response) =>
      prisma.eventResponse.create({ data: { eventId, ...response } }),
    ),
  );
}

export async function getEventResponsesForEvent(eventId: string) {
  return prisma.eventResponse.findMany({
    where: {
      eventId,
    },
  });
}
