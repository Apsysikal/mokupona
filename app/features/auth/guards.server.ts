import { redirect } from "react-router";

import { auth } from "./auth.server";
import { isRoleName, type RoleName } from "./roles";

import { requestLogger } from "~/logger/request-context.server";
import type { Role } from "~/models/role.server";
import type { User } from "~/models/user.server";
import { getUserByIdWithRole } from "~/models/user.server";

export type ValidatedUser = User & { role: Role & { name: RoleName } };

const reportedRoleViolations = new Set<User["id"]>();

function validateRoleName(user: User & { role: Role }): ValidatedUser {
  if (!isRoleName(user.role.name) && !reportedRoleViolations.has(user.id)) {
    reportedRoleViolations.add(user.id);
    requestLogger.error(
      { userId: user.id, role: user.role.name },
      "User has a role outside the role vocabulary",
    );
  }
  return user as ValidatedUser;
}

export async function getUserId(request: Request): Promise<User["id"] | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user.id ?? null;
}

export async function getUserWithRole(request: Request) {
  const userId = await getUserId(request);
  if (userId === null) return null;

  const user = await getUserByIdWithRole(userId);
  if (user) return validateRoleName(user);

  throw await logout(request);
}

export function loginRedirect(redirectTo: string) {
  const searchParams = new URLSearchParams([["redirectTo", redirectTo]]);
  return redirect(`/login?${searchParams}`);
}

export function assertUserHasRole(
  user: ValidatedUser,
  roles: readonly RoleName[],
) {
  if (!roles.includes(user.role.name)) {
    requestLogger.warn(
      {
        userId: user.id,
        role: user.role.name,
        reason: { requiredRoles: roles },
      },
      "Authorization denied",
    );
    throw new Response("Forbidden", { status: 403 });
  }
  return user;
}

export function requireResolvedUserWithRole(
  user: ValidatedUser | null,
  request: Request,
  roles: readonly RoleName[],
) {
  if (!user) {
    throw loginRedirect(new URL(request.url).pathname);
  }
  return assertUserHasRole(user, roles);
}

export async function logout(request: Request) {
  try {
    const { headers } = await auth.api.signOut({
      headers: request.headers,
      returnHeaders: true,
    });
    return redirect("/", { headers });
  } catch (error) {
    requestLogger.warn({ error }, "Sign-out did not revoke a session");
    return redirect("/");
  }
}
