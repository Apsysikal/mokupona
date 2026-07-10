// @vitest-environment node
// (happy-dom swaps the fetch primitives; better-auth needs the real ones)

import { faker } from "@faker-js/faker";
import { beforeAll, describe, expect, it } from "vitest";

import { auth } from "./auth.server";
import { createUserViaAuth } from "./create-user.server";
import {
  getUserId,
  getUserWithRole,
  requireUserId,
  requireUserWithRole,
} from "./guards.server";

import { prisma } from "~/db.server";

beforeAll(async () => {
  await Promise.all(
    ["user", "moderator", "admin"].map((name) =>
      prisma.role.upsert({ where: { name }, create: { name }, update: {} }),
    ),
  );
});

async function signedInRequest(path = "/admin/users") {
  const email = `guard-${faker.string.uuid()}@example.com`;
  const password = faker.internet.password({ length: 16 });
  const user = await createUserViaAuth({
    email,
    password,
    name: "guard test",
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
  it("getUserId resolves the session user, or undefined without one", async () => {
    const { user, request } = await signedInRequest();
    expect(await getUserId(request)).toBe(user.id);
    expect(
      await getUserId(new Request("http://localhost:3000/")),
    ).toBeUndefined();
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
