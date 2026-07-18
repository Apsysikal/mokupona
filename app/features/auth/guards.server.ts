import { redirect } from "react-router";

import { auth } from "./auth.server";

import type { User } from "~/models/user.server";
import { getUserByIdWithRole } from "~/models/user.server";

// Same-signature port of the old utils/session.server.ts helpers onto
// better-auth — the admin routes and root.tsx only change an import path
// (design §3). Role checks stay here; better-auth knows nothing about them.

export async function getUserId(
  request: Request,
): Promise<User["id"] | undefined> {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user.id;
}

export async function getUserWithRole(request: Request) {
  const userId = await getUserId(request);
  if (userId === undefined) return null;

  const user = await getUserByIdWithRole(userId);
  if (user) return user;

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

export async function requireUserWithRole(request: Request, roles: string[]) {
  const userId = await requireUserId(request);
  const user = await getUserByIdWithRole(userId);

  if (!user) throw await logout(request);
  if (!roles.includes(user.role.name)) {
    throw new Response("Forbidden", { status: 403 });
  }

  return user;
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
