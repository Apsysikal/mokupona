import {
  createContext,
  type MiddlewareFunction,
  type RouterContextProvider,
} from "react-router";

import { requireUserWithRole, type ValidatedUser } from "./guards.server";
import type { RoleName } from "./roles";

// The admin segment's middleware stores the authenticated user here so child
// middleware and loaders/actions read it instead of repeating the session and
// user lookup (plan phase 2).
export const userContext = createContext<ValidatedUser>();

// userContext deliberately has no default value, so `get` throws while the
// context is unset — probe it without disturbing that contract.
function getContextUser(
  context: Readonly<RouterContextProvider>,
): ValidatedUser | null {
  try {
    return context.get(userContext);
  } catch {
    return null;
  }
}

/**
 * Route middleware requiring a session whose user holds one of `roles`.
 *
 * The first middleware in the chain delegates to `requireUserWithRole` (login
 * redirect for anonymous requests, logout redirect for stale sessions, 403
 * outside `roles`) and stores the user in `userContext`. Nested middleware
 * finds the context populated and only narrows the role — no second session
 * or user lookup — throwing the same 403 shape on failure.
 */
export function requireRoleMiddleware(
  roles: readonly RoleName[],
): MiddlewareFunction<Response> {
  return async ({ request, context }) => {
    const user = getContextUser(context);

    if (user) {
      if (!roles.includes(user.role.name)) {
        throw new Response("Forbidden", { status: 403 });
      }
      return;
    }

    context.set(userContext, await requireUserWithRole(request, roles));
  };
}
