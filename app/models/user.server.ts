import type { Prisma, Role, User } from "#prisma/generated/client";

import { prisma } from "~/db.server";

export type { User } from "#prisma/generated/client";

export async function getUserByIdWithRole(
  id: string,
): Promise<(User & { role: Role }) | null> {
  return prisma.user.findUnique({ where: { id }, include: { role: true } });
}

export async function getUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
}

// The projection the admin user list needs.
// the admin tab bar shows a count pill per section
export async function countUsers(): Promise<number> {
  return prisma.user.count();
}

export async function listUsersWithRoleName(): Promise<
  { id: string; email: string; role: { name: string } }[]
> {
  return prisma.user.findMany({
    select: { id: true, email: true, role: { select: { name: true } } },
  });
}

// The account view shared by the profile page and the admin user edit page.
export async function getUserAccountSummary(id: string): Promise<{
  name: string;
  email: string;
  emailVerified: boolean;
  role: { name: string; description: string };
} | null> {
  return prisma.user.findUnique({
    where: { id },
    select: {
      name: true,
      email: true,
      emailVerified: true,
      role: { select: { name: true, description: true } },
    },
  });
}

// What /me needs to render its password / connected-accounts / sessions
// sections: which auth providers back this user, and how many live sessions
// they have.
export async function getUserAuthOverview(id: string): Promise<{
  hasPassword: boolean;
  googleLinked: boolean;
  sessionCount: number;
}> {
  const [accounts, sessionCount] = await Promise.all([
    prisma.account.findMany({
      where: { userId: id },
      select: { providerId: true },
    }),
    prisma.session.count({
      where: { userId: id, expiresAt: { gt: new Date() } },
    }),
  ]);

  return {
    hasPassword: accounts.some((a) => a.providerId === "credential"),
    googleLinked: accounts.some((a) => a.providerId === "google"),
    sessionCount,
  };
}

export async function updateUserName(id: string, name: string): Promise<void> {
  await prisma.user.update({ where: { id }, data: { name } });
}

// Mailbox ownership was proven out-of-band (password reset completion,
// invite-link acceptance) — deliberate shortcuts per the auth design.
export async function setUserEmailVerified(id: string): Promise<void> {
  await prisma.user.update({
    where: { id },
    data: { emailVerified: true },
  });
}

// Admins can't have their role changed from the admin UI — the guard is part
// of the write itself, not a check the caller can forget.
export async function updateNonAdminUserRole(
  userId: string,
  roleId: string,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId, role: { NOT: { name: "admin" } } },
    data: { roleId },
  });
}

// Event.createdById is onDelete: SetNull — events (and their responses and
// form data) outlive their creator; only authorship is cleared.
async function deleteUserInTx(tx: Prisma.TransactionClient, id: string) {
  return tx.user.delete({ where: { id } });
}

export async function deleteUserById(id: string): Promise<User> {
  return prisma.$transaction((tx) => deleteUserInTx(tx, id));
}

// Admin deletion policy belongs to the write, not only its route/UI. Missing
// and protected admin users are both no-ops for the idempotent admin action.
export async function deleteNonAdminUserById(id: string): Promise<User | null> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!user || user.role.name === "admin") return null;

    return deleteUserInTx(tx, id);
  });
}
