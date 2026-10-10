// @vitest-environment node

import { RouterContextProvider } from "react-router";
import { beforeAll, describe, expect, it } from "vitest";

import { signedInRequest } from "../../../test/auth-session";
import { ensureAuthRoles } from "../../../test/factories";

import { getUserWithRole } from "./guards.server";
import { optionalUserContext } from "./middleware.server";

import { prisma } from "~/db.server";
import { action } from "~/routes/me";

beforeAll(ensureAuthRoles);

async function unlinkGoogle(request: Request) {
  const context = new RouterContextProvider();
  context.set(optionalUserContext, () => getUserWithRole(request));
  return action({
    request: new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: new URLSearchParams({ intent: "unlink-google" }),
    }),
    context,
  } as unknown as Parameters<typeof action>[0]);
}

function linkGoogle(userId: string) {
  return prisma.account.create({
    data: { userId, providerId: "google", accountId: `google-${userId}` },
  });
}

describe("account settings Google unlink", () => {
  it("removes only the signed-in user's Google account using its internal ID", async () => {
    const first = await signedInRequest({ path: "/me" });
    const second = await signedInRequest({ path: "/me" });
    const google = await linkGoogle(first.user.id);
    const otherGoogle = await linkGoogle(second.user.id);

    expect((await unlinkGoogle(first.request)).data.done).toBe("unlink");
    expect(
      await prisma.account.findUnique({ where: { id: google.id } }),
    ).toBeNull();
    expect(
      await prisma.account.findUnique({ where: { id: otherGoogle.id } }),
    ).not.toBeNull();
    expect(
      await prisma.account.count({
        where: { userId: first.user.id, providerId: "credential" },
      }),
    ).toBe(1);
  });

  it("leaves a password-only account unchanged", async () => {
    const { user, request } = await signedInRequest({ path: "/me" });
    expect((await unlinkGoogle(request)).data.done).toBeNull();
    expect(await prisma.account.count({ where: { userId: user.id } })).toBe(1);
  });

  it("does not unlink the user's last sign-in method", async () => {
    const { user, request } = await signedInRequest({ path: "/me" });
    const google = await linkGoogle(user.id);
    await prisma.account.deleteMany({
      where: { userId: user.id, providerId: "credential" },
    });

    expect((await unlinkGoogle(request)).data.done).toBeNull();
    expect(
      await prisma.account.findUnique({ where: { id: google.id } }),
    ).not.toBeNull();
  });
});
