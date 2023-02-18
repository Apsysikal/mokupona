import { prisma } from "~/db.server";

import type { Prisma, EventResponse } from "@prisma/client";
export type { EventResponse } from "@prisma/client";

type CreateEventResponseData = Prisma.EventCreateInput;

export async function createEventResponse(
  data: Prisma.EventResponseUncheckedCreateInput
) {
  return prisma.eventResponse.create({
    data,
  });
}
