import { redirect } from "react-router";

import { auth } from "./auth.server";
import { isRoleName, type RoleName } from "./roles";

import type { Role } from "~/models/role.server";
import type { User } from "~/models/user.server";
import { getUserByIdWithRole } from "~/models/user.server";

// Same-signature port of the old utils/session.server.ts helpers onto
// better-auth — the admin routes and root.tsx only change an import path
// (design §3). Role checks stay here; better-auth knows nothing about them.

/** A user whose persisted role name passed the vocabulary check. */
export type ValidatedUser = User & { role: Role & { name: RoleName } };

// Prisma types Role.name as string; the guards are where persisted roles
// enter the app, so validate against the vocabulary here (plan phase 1). A
// stored name outside it is corrupt data, not a request error.
function validateRoleName(user: User & { role: Role }): ValidatedUser {
  if (!isRoleName(user.role.name)) {
    throw new Error(
      `User ${user.id} has role "${user.role.name}" outside the role vocabulary`,
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

export async function requireUserId(
  request: Request,
  redirectTo: string = new URL(request.url).pathname,
) {
  const userId = await getUserId(request);
  if (!userId) {
    const searchParams = new URLSearchParams([["redirectTo", redirectTo]]);
    throw redirect(`/login?${searchParams}`);
  }
  return userId;
}

/**
 * Require a session whose user holds one of `roles`. Throws a login redirect
 * for anonymous requests, a logout redirect for a stale session, and a 403
 * response for a user outside `roles`.
 */
export async function requireUserWithRole(
  request: Request,
  roles: readonly RoleName[],
) {
  const userId = await requireUserId(request);
  const user = await getUserByIdWithRole(userId);

  if (!user) throw await logout(request);
  const validatedUser = validateRoleName(user);
  if (!roles.includes(validatedUser.role.name)) {
    throw new Response("Forbidden", { status: 403 });
  }

  return validatedUser;
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
