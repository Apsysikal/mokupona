import type { Prisma } from "@prisma/client";

import { prisma } from "~/db.server";

export async function getEvents(filter?: Prisma.EventWhereInput) {
    const events = await prisma.event.findMany({
        where: filter
    })

    return events;
}