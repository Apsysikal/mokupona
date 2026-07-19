import { createContext, type MiddlewareFunction } from "react-router";

import {
  assertUserHasRole,
  getUserWithRole,
  requireResolvedUserWithRole,
  type ValidatedUser,
} from "./guards.server";
import type { RoleName } from "./roles";

// Root middleware always initializes this context, including null for an
// anonymous request, so all downstream loaders and role middleware share one
// session/user resolution.
export const optionalUserContext = createContext<ValidatedUser | null>();
export const userContext = createContext<ValidatedUser>();

export const resolveOptionalUserMiddleware: MiddlewareFunction<
  Response
> = async ({ request, context }) => {
  context.set(optionalUserContext, await getUserWithRole(request));
};

/**
 * Promote the root-resolved optional user into the required admin context
 * after asserting membership in one of `roles`.
 *
 * Root middleware has already resolved and validated the session user, so
 * this performs no session or database lookup.
 */
export function requireResolvedUserRoleMiddleware(
  roles: readonly RoleName[],
): MiddlewareFunction<Response> {
  return async ({ request, context }) => {
    const user = requireResolvedUserWithRole(
      context.get(optionalUserContext),
      request,
      roles,
    );
    context.set(userContext, user);
  };
}

/** Narrow the required user established by parent admin middleware. */
export function narrowResolvedUserRoleMiddleware(
  roles: readonly RoleName[],
): MiddlewareFunction<Response> {
  return async ({ context }) => {
    assertUserHasRole(context.get(userContext), roles);
  };
}
