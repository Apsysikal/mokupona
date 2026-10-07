import { prisma } from "~/db.server";

export async function pingDatabase(): Promise<void> {
  await prisma.user.count();
}
