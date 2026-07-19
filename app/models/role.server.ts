import type { Role } from "#prisma/generated/client";

import { prisma } from "~/db.server";

export type { Role };

export async function getRoleByName(name: string): Promise<Role | null> {
  return prisma.role.findUnique({ where: { name } });
}
