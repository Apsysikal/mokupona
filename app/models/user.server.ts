import { Password, Prisma, Role, User } from "@prisma/client";
import bcrypt from "bcryptjs";

import { prisma } from "~/db.server";

export type { User } from "@prisma/client";

export type UserSelect = Prisma.UserSelect;
export type UserWhere = Prisma.UserWhereInput;
export type UserWhereUnique = Prisma.UserWhereUniqueInput;
export type UserUpdateData = Prisma.UserUncheckedUpdateInput;

type UserFindManyPayload<T extends UserSelect> = Array<
  Prisma.UserGetPayload<{ select: T }>
>;

type UserFindUniquePayload<T extends UserSelect> = Prisma.UserGetPayload<{
  select: T;
}>;

export async function getUsers<T extends UserSelect>(
  select: T,
): Promise<UserFindManyPayload<T>> {
  return prisma.user.findMany({ select });
}

export async function getUserById<T extends UserSelect>(
  id: User["id"],
  select: T = {} as T,
): Promise<UserFindUniquePayload<T> | null> {
  return prisma.user.findUnique({ where: { id }, select });
}

export async function getUserByIdWithRole(id: User["id"]) {
  return prisma.user.findUnique({ where: { id }, include: { role: true } });
}

export async function getUserByEmail(email: User["email"]) {
  return prisma.user.findUnique({ where: { email } });
}

export async function createUser(
  email: User["email"],
  password: string,
  roleName: Role["name"] = "user",
) {
  const hashedPassword = await bcrypt.hash(password, 10);
  const role = await prisma.role.findUnique({ where: { name: roleName } });

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

export async function deleteUserByEmail(email: User["email"]) {
  return prisma.user.delete({ where: { email } });
}

export async function deleteUserById(id: User["id"]) {
  return prisma.user.delete({ where: { id } });
}

export async function updateUser<T extends UserWhereUnique>(
  where: T = {} as T,
  data: UserUpdateData,
) {
  return prisma.user.update({
    where,
    data,
  });
}

export async function verifyLogin(
  email: User["email"],
  password: Password["hash"],
) {
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
