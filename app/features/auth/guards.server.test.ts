// @vitest-environment node
// (happy-dom swaps the fetch primitives; better-auth needs the real ones)

import { beforeAll, describe, expect, it } from "vitest";

import { signedInRequest as signedInAuthRequest } from "../../../test/auth-session";
import { ensureAuthRoles } from "../../../test/factories";

import {
  getUserId,
  getUserWithRole,
  requireUserId,
  requireUserWithRole,
} from "./guards.server";

import { prisma } from "~/db.server";

beforeAll(async () => {
  await ensureAuthRoles();
});

function signedInRequest(path = "/admin/users") {
  return signedInAuthRequest({ path });
}

describe("signup via better-auth", () => {
  it("assigns the default role through the user.create hook", async () => {
    const { user } = await signedInRequest();
    const withRole = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { role: true },
    });
    expect(withRole.role.name).toBe("user");
  });
});

describe("guard shim", () => {
  it("getUserId resolves the session user, or null without one", async () => {
    const { user, request } = await signedInRequest();
    expect(await getUserId(request)).toBe(user.id);
    expect(await getUserId(new Request("http://localhost:3000/"))).toBeNull();
  });

  it("getUserWithRole returns the user with its role", async () => {
    const { user, request } = await signedInRequest();
    const resolved = await getUserWithRole(request);
    expect(resolved?.id).toBe(user.id);
    expect(resolved?.role.name).toBe("user");

    expect(
      await getUserWithRole(new Request("http://localhost:3000/")),
    ).toBeNull();
  });

  it("requireUserId redirects anonymous requests to /login with redirectTo", async () => {
    const anonymous = new Request("http://localhost:3000/admin/dinners");
    const thrown = await requireUserId(anonymous).catch((error) => error);
    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).headers.get("location")).toBe(
      "/login?redirectTo=%2Fadmin%2Fdinners",
    );
  });

  it("requireUserWithRole enforces role membership with a 403", async () => {
    const { user, request } = await signedInRequest();

    const allowed = await requireUserWithRole(request, ["user", "admin"]);
    expect(allowed.id).toBe(user.id);

    const thrown = await requireUserWithRole(request, ["admin"]).catch(
      (error) => error,
    );
    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(403);
  });
});
