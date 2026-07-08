import bcrypt from "bcryptjs";

import type { Role, User } from "#prisma/generated/client";

import { prisma } from "~/db.server";
import { deleteEventsInTx } from "~/models/event.server";
import { getRoleByName } from "~/models/role.server";

export type { User } from "#prisma/generated/client";

export async function getUserByIdWithRole(
  id: string,
): Promise<(User & { role: Role }) | null> {
  return prisma.user.findUnique({ where: { id }, include: { role: true } });
}

export async function getUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } });
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
export async function getUserAccountSummary(
  id: string,
): Promise<{
  email: string;
  role: { name: string; description: string };
} | null> {
  return prisma.user.findUnique({
    where: { id },
    select: {
      email: true,
      role: { select: { name: true, description: true } },
    },
  });
}

export async function createUser(
  email: string,
  password: string,
  roleName = "user",
): Promise<User> {
  const hashedPassword = await bcrypt.hash(password, 10);
  const role = await getRoleByName(roleName);

  if (!role) throw new Error(`Role "${roleName}" is not a valid role`);

  return prisma.user.create({
    data: {
      email,
      roleId: role.id,
      password: {
        create: {
          hash: hashedPassword,
        },
      },
    },
  });
}

export async function verifyLogin(
  email: string,
  password: string,
): Promise<Omit<User, "password"> | null> {
  const userWithPassword = await prisma.user.findUnique({
    where: { email },
    include: {
      password: true,
    },
  });

  if (!userWithPassword || !userWithPassword.password) {
    return null;
  }

  const isValid = await bcrypt.compare(
    password,
    userWithPassword.password.hash,
  );

  if (!isValid) {
    return null;
  }

  const { password: _password, ...userWithoutPassword } = userWithPassword;

  return userWithoutPassword;
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

// The DB cascades User -> Event, which would skip the app-level form cascade
// and orphan Form/FormVersion/FormSubmission rows — delete the user's events
// through it first, in the same transaction.
export async function deleteUserById(id: string): Promise<User> {
  return prisma.$transaction(async (tx) => {
    await deleteEventsInTx(tx, { createdById: id });
    return tx.user.delete({ where: { id } });
  });
}
