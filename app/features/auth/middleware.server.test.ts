// @vitest-environment node
// (happy-dom swaps the fetch primitives; better-auth needs the real ones)

import { RouterContextProvider, type MiddlewareFunction } from "react-router";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { signedInRequest } from "../../../test/auth-session";
import { ensureAuthRoles } from "../../../test/factories";

import { auth } from "./auth.server";
import {
  optionalUserContext,
  requireResolvedUserRoleMiddleware,
  resolveOptionalUserMiddleware,
  userContext,
} from "./middleware.server";
import { ADMIN_ROLE_NAMES, type RoleName } from "./roles";

import { prisma } from "~/db.server";
import { getUserByIdWithRole } from "~/models/user.server";

// Wrap the module in pass-through spies so the tests can (a) force the
// stale-session branch (live session, user row lookup misses) and (b) count
// user lookups to prove the nested middleware never repeats one.
vi.mock("~/models/user.server", { spy: true });

beforeAll(async () => {
  await ensureAuthRoles();
});

function signedInAs(roleName: RoleName, path = "/admin") {
  return signedInRequest({ roleName, path });
}

// Drives a middleware the way the router does: same args shape, and a `next`
// we control so tests can observe whether downstream handlers would run.
async function runMiddleware(
  middleware: MiddlewareFunction<Response>,
  request: Request,
  context: RouterContextProvider,
  next: () => Promise<Response> = async () => new Response(null),
) {
  return middleware(
    {
      request,
      context,
      params: {},
      url: new URL(request.url),
      pattern: "/admin/*",
    },
    next,
  );
}

async function resolveUser(request: Request, context: RouterContextProvider) {
  await runMiddleware(resolveOptionalUserMiddleware, request, context);
}

describe("resolved-user role middleware", () => {
  it("fails fast when root middleware did not initialize the optional context", async () => {
    const request = new Request("http://localhost:3000/admin");

    const thrown = await runMiddleware(
      requireResolvedUserRoleMiddleware(ADMIN_ROLE_NAMES),
      request,
      new RouterContextProvider(),
    ).catch((error) => error);

    expect(thrown).not.toBeInstanceOf(Response);
    expect(getUserByIdWithRole).not.toHaveBeenCalled();
  });

  it("redirects anonymous requests to /login with redirectTo", async () => {
    const request = new Request("http://localhost:3000/admin/dinners");
    const context = new RouterContextProvider();
    await resolveUser(request, context);
    await expect(context.get(optionalUserContext)()).resolves.toBeNull();
    const thrown = await runMiddleware(
      requireResolvedUserRoleMiddleware(ADMIN_ROLE_NAMES),
      request,
      context,
    ).catch((error) => error);

    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(302);
    expect((thrown as Response).headers.get("location")).toBe(
      "/login?redirectTo=%2Fadmin%2Fdinners",
    );
  });

  it("rejects an anonymous direct POST before the action could run", async () => {
    // the router only invokes downstream handlers (child middleware, then the
    // action) via/after `next` — a middleware throw therefore precludes the
    // mutation. `next` doubles as the run-detector here.
    let downstreamRan = false;
    const request = new Request("http://localhost:3000/admin/users", {
      method: "POST",
      body: new URLSearchParams({ intent: "invite" }),
    });
    const context = new RouterContextProvider();
    await resolveUser(request, context);

    const thrown = await runMiddleware(
      requireResolvedUserRoleMiddleware(ADMIN_ROLE_NAMES),
      request,
      context,
      async () => {
        downstreamRan = true;
        return new Response(null);
      },
    ).catch((error) => error);

    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).headers.get("location")).toBe(
      "/login?redirectTo=%2Fadmin%2Fusers",
    );
    expect(downstreamRan).toBe(false);
  });

  it("throws 403 for a signed-in ordinary user", async () => {
    const { request } = await signedInAs("user");
    const context = new RouterContextProvider();
    await resolveUser(request, context);

    const thrown = await runMiddleware(
      requireResolvedUserRoleMiddleware(ADMIN_ROLE_NAMES),
      request,
      context,
    ).catch((error) => error);

    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(403);
  });

  it("lets a moderator into the admin segment but 403s the users segment", async () => {
    const { user, request } = await signedInAs("moderator", "/admin/users");
    const context = new RouterContextProvider();
    await resolveUser(request, context);

    // outer admin.tsx middleware: passes and stores the user
    await runMiddleware(
      requireResolvedUserRoleMiddleware(ADMIN_ROLE_NAMES),
      request,
      context,
    );
    expect(context.get(userContext).id).toBe(user.id);
    expect(context.get(userContext).role.name).toBe("moderator");

    // inner admin.users.tsx middleware: admin only
    const thrown = await runMiddleware(
      requireResolvedUserRoleMiddleware(["admin"]),
      request,
      context,
    ).catch((error) => error);

    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(403);
  });

  it("lets an admin through both the admin and users segments", async () => {
    const { user, request } = await signedInAs("admin", "/admin/users");
    const context = new RouterContextProvider();
    await resolveUser(request, context);

    await runMiddleware(
      requireResolvedUserRoleMiddleware(ADMIN_ROLE_NAMES),
      request,
      context,
    );
    await runMiddleware(
      requireResolvedUserRoleMiddleware(["admin"]),
      request,
      context,
    );

    expect(context.get(userContext).id).toBe(user.id);
    expect(context.get(userContext).role.name).toBe("admin");
  });

  it("logs out a stale session (live session, user row lookup misses)", async () => {
    const { request } = await signedInAs("moderator");
    // the User FK cascades sessions away, so a plain row delete cannot
    // produce this state — force the lookup miss the guard defends against
    vi.mocked(getUserByIdWithRole).mockResolvedValueOnce(null);
    const context = new RouterContextProvider();
    await resolveUser(request, context);

    // resolution is lazy — the logout redirect surfaces at the first consumer
    const thrown = await context
      .get(optionalUserContext)()
      .catch((error) => error);

    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(302);
    expect((thrown as Response).headers.get("location")).toBe("/");
    // the logout redirect carries better-auth's session-revoking headers
    expect((thrown as Response).headers.get("set-cookie")).toContain(
      "session_token",
    );
  });

  it("redirects to login when the user row (and via cascade the session) is deleted", async () => {
    const { user, request } = await signedInAs("moderator");
    await prisma.user.delete({ where: { id: user.id } });
    const context = new RouterContextProvider();
    await resolveUser(request, context);

    const thrown = await runMiddleware(
      requireResolvedUserRoleMiddleware(ADMIN_ROLE_NAMES),
      request,
      context,
    ).catch((error) => error);

    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(302);
    expect((thrown as Response).headers.get("location")).toBe(
      "/login?redirectTo=%2Fadmin",
    );
  });

  it("does not repeat the session/user lookup when a parent already authenticated", async () => {
    const { user, request } = await signedInAs("admin", "/admin/users");
    const context = new RouterContextProvider();

    const getSessionSpy = vi.spyOn(auth.api, "getSession");
    getSessionSpy.mockClear();
    vi.mocked(getUserByIdWithRole).mockClear();
    await resolveUser(request, context);
    await runMiddleware(
      requireResolvedUserRoleMiddleware(ADMIN_ROLE_NAMES),
      request,
      context,
    );
    await runMiddleware(
      requireResolvedUserRoleMiddleware(["admin"]),
      request,
      context,
    );
    // root middleware fetched once; both admin layers reused the contexts
    expect(getSessionSpy).toHaveBeenCalledTimes(1);
    expect(getUserByIdWithRole).toHaveBeenCalledTimes(1);
    getSessionSpy.mockRestore();

    // A request with NO session cookie: any fresh session or user lookup would
    // see an anonymous request and login-redirect. The resolver the parent
    // already memoized must carry the nested middleware through instead.
    const cookieless = new Request("http://localhost:3000/admin/users");
    await expect(
      runMiddleware(
        requireResolvedUserRoleMiddleware(["admin"]),
        cookieless,
        context,
      ),
    ).resolves.toBeUndefined();
    expect(context.get(userContext).id).toBe(user.id);

    // control: the same cookieless request against an empty context proves
    // the pass above came from the context, not from the request. Root then
    // initializes the optional context before the parent role requirement.
    const fresh = new RouterContextProvider();
    await resolveUser(cookieless, fresh);
    const thrown = await runMiddleware(
      requireResolvedUserRoleMiddleware(ADMIN_ROLE_NAMES),
      cookieless,
      fresh,
    ).catch((error) => error);
    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).headers.get("location")).toBe(
      "/login?redirectTo=%2Fadmin%2Fusers",
    );
  });
});
