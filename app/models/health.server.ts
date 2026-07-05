import { prisma } from "~/db.server";

// A trivial query proving the database is reachable — the healthcheck's ping.
export async function pingDatabase(): Promise<void> {
  await prisma.user.count();
}
