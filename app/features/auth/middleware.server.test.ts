// @vitest-environment node
// (happy-dom swaps the fetch primitives; better-auth needs the real ones)

import { faker } from "@faker-js/faker";
import { RouterContextProvider } from "react-router";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { ensureAuthRoles } from "../../../test/factories";

import { auth } from "./auth.server";
import { createUserViaAuth } from "./create-user.server";
import { requireRoleMiddleware, userContext } from "./middleware.server";
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

async function signedInAs(roleName: RoleName, path = "/admin") {
  const email = `middleware-${faker.string.uuid()}@example.com`;
  const password = faker.internet.password({ length: 16 });
  const user = await createUserViaAuth({
    email,
    password,
    name: "middleware test",
    roleName,
    emailVerified: true,
  });

  const { headers } = await auth.api.signInEmail({
    body: { email, password },
    returnHeaders: true,
  });
  const cookie = (headers.get("set-cookie") ?? "").split(";")[0];

  return {
    user,
    request: new Request(`http://localhost:3000${path}`, {
      headers: { cookie },
    }),
  };
}

// Drives a middleware the way the router does: same args shape, and a `next`
// we control so tests can observe whether downstream handlers would run.
async function runMiddleware(
  middleware: ReturnType<typeof requireRoleMiddleware>,
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

describe("requireRoleMiddleware", () => {
  it("redirects anonymous requests to /login with redirectTo", async () => {
    const request = new Request("http://localhost:3000/admin/dinners");
    const thrown = await runMiddleware(
      requireRoleMiddleware(ADMIN_ROLE_NAMES),
      request,
      new RouterContextProvider(),
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

    const thrown = await runMiddleware(
      requireRoleMiddleware(ADMIN_ROLE_NAMES),
      request,
      new RouterContextProvider(),
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

    const thrown = await runMiddleware(
      requireRoleMiddleware(ADMIN_ROLE_NAMES),
      request,
      context,
    ).catch((error) => error);

    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(403);
  });

  it("lets a moderator into the admin segment but 403s the users segment", async () => {
    const { user, request } = await signedInAs("moderator", "/admin/users");
    const context = new RouterContextProvider();

    // outer admin.tsx middleware: passes and stores the user
    await runMiddleware(requireRoleMiddleware(ADMIN_ROLE_NAMES), request, context);
    expect(context.get(userContext).id).toBe(user.id);
    expect(context.get(userContext).role.name).toBe("moderator");

    // inner admin.users.tsx middleware: narrows to admin
    const thrown = await runMiddleware(
      requireRoleMiddleware(["admin"]),
      request,
      context,
    ).catch((error) => error);

    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(403);
  });

  it("lets an admin through both the admin and users segments", async () => {
    const { user, request } = await signedInAs("admin", "/admin/users");
    const context = new RouterContextProvider();

    await runMiddleware(requireRoleMiddleware(ADMIN_ROLE_NAMES), request, context);
    await runMiddleware(requireRoleMiddleware(["admin"]), request, context);

    expect(context.get(userContext).id).toBe(user.id);
    expect(context.get(userContext).role.name).toBe("admin");
  });

  it("logs out a stale session (live session, user row lookup misses)", async () => {
    const { request } = await signedInAs("moderator");
    // the User FK cascades sessions away, so a plain row delete cannot
    // produce this state — force the lookup miss the guard defends against
    vi.mocked(getUserByIdWithRole).mockResolvedValueOnce(null);

    const thrown = await runMiddleware(
      requireRoleMiddleware(ADMIN_ROLE_NAMES),
      request,
      new RouterContextProvider(),
    ).catch((error) => error);

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

    const thrown = await runMiddleware(
      requireRoleMiddleware(ADMIN_ROLE_NAMES),
      request,
      new RouterContextProvider(),
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

    vi.mocked(getUserByIdWithRole).mockClear();
    await runMiddleware(requireRoleMiddleware(ADMIN_ROLE_NAMES), request, context);
    await runMiddleware(requireRoleMiddleware(["admin"]), request, context);
    // outer middleware fetched once; the nested one reused the context
    expect(getUserByIdWithRole).toHaveBeenCalledTimes(1);

    // A request with NO session cookie: any session or user lookup would see
    // an anonymous request and login-redirect. The populated context alone
    // must let the nested middleware pass.
    const cookieless = new Request("http://localhost:3000/admin/users");
    await expect(
      runMiddleware(requireRoleMiddleware(["admin"]), cookieless, context),
    ).resolves.toBeUndefined();
    expect(context.get(userContext).id).toBe(user.id);

    // control: the same cookieless request against an empty context proves
    // the pass above came from the context, not from the request
    const fresh = new RouterContextProvider();
    const thrown = await runMiddleware(
      requireRoleMiddleware(["admin"]),
      cookieless,
      fresh,
    ).catch((error) => error);
    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).headers.get("location")).toBe(
      "/login?redirectTo=%2Fadmin%2Fusers",
    );
  });

  it("role-narrows from context: a context-held moderator is 403'd without a request lookup", async () => {
    const { user } = await signedInAs("moderator");
    const context = new RouterContextProvider();
    context.set(userContext, {
      ...user,
      role: { ...(await prisma.role.findUniqueOrThrow({ where: { name: "moderator" } })), name: "moderator" },
    });

    const cookieless = new Request("http://localhost:3000/admin/users");
    const thrown = await runMiddleware(
      requireRoleMiddleware(["admin"]),
      cookieless,
      context,
    ).catch((error) => error);

    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(403);
  });
});
