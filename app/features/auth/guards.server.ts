import { redirect } from "react-router";

import { auth } from "./auth.server";
import { isRoleName, type RoleName } from "./roles";

import { requestLogger } from "~/logger/request-context.server";
import type { Role } from "~/models/role.server";
import type { User } from "~/models/user.server";
import { getUserByIdWithRole } from "~/models/user.server";

/** A user whose persisted role name passed the vocabulary check. */
export type ValidatedUser = User & { role: Role & { name: RoleName } };

// Root middleware resolves the user on every request, so an affected user
// would otherwise produce one record per request until the row is fixed.
const reportedRoleViolations = new Set<User["id"]>();

function validateRoleName(user: User & { role: Role }): ValidatedUser {
  if (!isRoleName(user.role.name) && !reportedRoleViolations.has(user.id)) {
    reportedRoleViolations.add(user.id);
    requestLogger().error(
      { userId: user.id, role: user.role.name },
      "User has a role outside the role vocabulary",
    );
  }
  return user as ValidatedUser;
}

/** Resolve the session's user id, or null for anonymous requests. */
export async function getUserId(request: Request): Promise<User["id"] | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user.id ?? null;
}

/**
 * Resolve the session's user with its role. Returns null for anonymous
 * requests; throws a logout redirect for a stale session (a live cookie
 * whose user row is gone) so the root loader clears dead sessions.
 */
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

/** Assert a role on a user that has already passed session/DB validation. */
export function assertUserHasRole(
  user: ValidatedUser,
  roles: readonly RoleName[],
) {
  if (!roles.includes(user.role.name)) {
    // A thrown Response never reaches handleError, so this is the only place
    // an authorization denial can be recorded at all.
    requestLogger().warn(
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

/** Require a user already resolved by request middleware. */
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
  } catch {
    // no live session to revoke — still land the user on the home page
    return redirect("/");
  }
}
