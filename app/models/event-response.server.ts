import { prisma } from "~/db.server";

export type { EventResponse } from "#prisma/generated/client";

// EventResponse is frozen legacy (design §3.3): no new writes, read-only
// access for the read layer's legacy merge.
export async function getEventResponsesForEvent(eventId: string) {
  return prisma.eventResponse.findMany({
    where: {
      eventId,
    },
  });
}
