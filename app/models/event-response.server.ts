import { prisma } from "~/db.server";

import type { Prisma } from "@prisma/client";
export type { EventResponse } from "@prisma/client";

export async function createEventResponse(
  data: Prisma.EventResponseUncheckedCreateInput
) {
  return prisma.eventResponse.create({
    data,
  });
}
