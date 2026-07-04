import { prisma } from "~/db.server";

// EventResponse is frozen legacy (design §3.3): no new writes, read-only
// access for the read layer's legacy merge.
export async function getEventResponsesForEvent(eventId: string) {
  return prisma.eventResponse.findMany({
    where: {
      eventId,
    },
  });
}
