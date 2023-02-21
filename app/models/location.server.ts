import { prisma } from "~/db.server";

export async function getLocations() {
  return prisma.location.findMany();
}
