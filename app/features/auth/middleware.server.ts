import {
  createContext,
  redirect,
  type MiddlewareFunction,
  type RouterContextProvider,
} from "react-router";

import { googleAuthEnabled } from "./auth.server";
import {
  assertUserHasRole,
  getUserWithRole,
  loginRedirect,
  requireResolvedUserWithRole,
  type ValidatedUser,
} from "./guards.server";
import type { RoleName } from "./roles";

// Root middleware always initializes this context with a lazy, memoized
// resolver (null resolution = anonymous request): routes that never read the
// user — the /file/:fileId resource route in particular, which middleware
// runs for too — pay no session or database cost, while all consumers within
// one request share a single session/user resolution.
export const optionalUserContext =
  createContext<() => Promise<ValidatedUser | null>>();
export const userContext = createContext<ValidatedUser>();

export const resolveOptionalUserMiddleware: MiddlewareFunction<
  Response
> = async ({ request, context }) => {
  let resolution: Promise<ValidatedUser | null> | undefined;
  context.set(optionalUserContext, () => {
    resolution ??= getUserWithRole(request);
    return resolution;
  });
};

/**
 * Resolve the root-provided optional user, throwing a login redirect for
 * anonymous requests (and, via the shared resolver, a logout redirect for a
 * stale session).
 */
export async function requireResolvedUser(
  context: Readonly<RouterContextProvider>,
  request: Request,
): Promise<ValidatedUser> {
  const user = await context.get(optionalUserContext)();
  if (!user) {
    throw loginRedirect(new URL(request.url).pathname);
  }
  return user;
}

/**
 * Loader shared by the anonymous-only auth pages (login/join): bounce
 * signed-in users home and expose whether Google sign-in is configured.
 */
export async function anonymousAuthPageLoader({
  context,
}: {
  context: Readonly<RouterContextProvider>;
}) {
  const user = await context.get(optionalUserContext)();
  if (user) throw redirect("/");
  return { googleEnabled: googleAuthEnabled };
}

/**
 * Promote the root-resolved optional user into the required admin context
 * after asserting membership in one of `roles`.
 *
 * The first consumer of the shared resolver triggers the actual session and
 * database lookup; every later consumer reuses it.
 */
export function requireResolvedUserRoleMiddleware(
  roles: readonly RoleName[],
): MiddlewareFunction<Response> {
  return async ({ request, context }) => {
    const user = requireResolvedUserWithRole(
      await context.get(optionalUserContext)(),
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
