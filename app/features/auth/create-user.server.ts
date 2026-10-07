import { auth } from "./auth.server";

import { getRoleByName } from "~/models/role.server";
import type { User } from "~/models/user.server";
import {
  getUserByEmail,
  setUserEmailVerified,
  updateNonAdminUserRole,
} from "~/models/user.server";

export async function createUserViaAuth({
  email,
  password,
  name,
  roleName = "user",
  emailVerified = false,
}: {
  email: string;
  password: string;
  name: string;
  roleName?: string;
  emailVerified?: boolean;
}): Promise<User> {
  const { user: created } = await auth.api.signUpEmail({
    body: { email, password, name },
  });

  if (emailVerified) await setUserEmailVerified(created.id);
  if (roleName !== "user") {
    const role = await getRoleByName(roleName);
    if (!role) throw new Error(`Role "${roleName}" is not a valid role`);
    await updateNonAdminUserRole(created.id, role.id);
  }

  const user = await getUserByEmail(created.email);
  if (!user) throw new Error(`user ${email} vanished during provisioning`);
  return user;
}
