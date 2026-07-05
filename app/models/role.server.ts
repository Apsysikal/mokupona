import type { Role } from "#prisma/generated/client";

import { prisma } from "~/db.server";

export type { Role };

export async function getRoleByName(name: string): Promise<Role | null> {
  return prisma.role.findUnique({ where: { name } });
}

export async function getRoleNameForUser(
  userId: string,
): Promise<string | null> {
  const role = await prisma.role.findFirst({
    where: { users: { some: { id: userId } } },
    select: { name: true },
  });

  return role?.name ?? null;
}
