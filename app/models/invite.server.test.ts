import { faker } from "@faker-js/faker";
import { beforeAll, describe, expect, it } from "vitest";

import { createTestUser, ensureAuthRoles } from "../../test/factories";

import {
  acceptInvite,
  getInviteByToken,
  inviteValidity,
  listPendingInvites,
  refreshInvite,
  revokeInvite,
  upsertInvite,
} from "./invite.server";

import { prisma } from "~/db.server";

async function createInvite(
  overrides: Partial<Parameters<typeof upsertInvite>[0]> = {},
) {
  const admin = await createTestUser("admin");
  return upsertInvite({
    email: `invite-${faker.string.uuid()}@example.com`,
    roleName: "user",
    createdById: admin.id,
    ...overrides,
  });
}

beforeAll(async () => {
  // acceptInvite resolves invite.roleName against the real Role table
  await ensureAuthRoles();
});

describe("upsertInvite", () => {
  it("updates the live invite for an address instead of duplicating", async () => {
    const email = `invitee-${faker.string.uuid()}@example.com`;

    const first = await createInvite({ email });
    const second = await createInvite({ email, roleName: "moderator" });

    expect(second.id).toBe(first.id);
    expect(second.roleName).toBe("moderator");
    // the token rotates, killing the previously mailed link
    expect(second.token).not.toBe(first.token);

    const pending = await listPendingInvites();
    expect(pending.filter((invite) => invite.email === email)).toHaveLength(1);
  });

  it("stores only a hash — the raw token never lands in the DB", async () => {
    const invite = await createInvite({
      email: `h-${faker.string.uuid()}@example.com`,
    });

    const row = await prisma.invite.findUniqueOrThrow({
      where: { id: invite.id },
    });
    expect(row.tokenHash).not.toBe(invite.token);
    // ...but the raw token still resolves through the hashed lookup
    expect((await getInviteByToken(invite.token))?.id).toBe(invite.id);
  });

  it("normalizes the bound address to lowercase", async () => {
    const invite = await createInvite({
      email: `Mixed-${faker.string.uuid()}@Example.com`,
    });
    expect(invite.email).toBe(invite.email.toLowerCase());
  });
});

describe("inviteValidity", () => {
  it("classifies missing, expired, used and valid invites", async () => {
    const invite = await createInvite({
      email: `v-${faker.string.uuid()}@example.com`,
    });

    expect(inviteValidity(null)).toBe("invalid");
    expect(inviteValidity(invite)).toBe("valid");
    expect(
      inviteValidity({ ...invite, expiresAt: new Date(Date.now() - 1000) }),
    ).toBe("expired");
    expect(inviteValidity({ ...invite, acceptedAt: new Date() })).toBe("used");
  });
});

describe("acceptInvite", () => {
  it("upgrades user → moderator, stamps acceptedAt and verifies the email", async () => {
    const invitee = await createTestUser();
    const invite = await createInvite({
      email: invitee.email,
      roleName: "moderator",
    });

    await acceptInvite({ invite, userId: invitee.id });

    const updated = await prisma.user.findUniqueOrThrow({
      where: { id: invitee.id },
      include: { role: true },
    });
    expect(updated.role.name).toBe("moderator");
    expect(updated.emailVerified).toBe(true);

    const accepted = await getInviteByToken(invite.token);
    expect(accepted?.acceptedAt).not.toBeNull();
  });

  it("is single-use — a second acceptance throws", async () => {
    const invitee = await createTestUser();
    const invite = await createInvite({
      email: invitee.email,
      roleName: "moderator",
    });

    await acceptInvite({ invite, userId: invitee.id });
    await expect(acceptInvite({ invite, userId: invitee.id })).rejects.toThrow(
      /no longer valid/,
    );
  });

  it("rejects expired invites", async () => {
    const invitee = await createTestUser();
    const invite = await createInvite({
      email: invitee.email,
      roleName: "moderator",
    });
    await prisma.invite.update({
      where: { id: invite.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(acceptInvite({ invite, userId: invitee.id })).rejects.toThrow(
      /no longer valid/,
    );
  });

  it("never downgrades — a moderator invited as user keeps moderator", async () => {
    const invitee = await createTestUser("moderator");
    const invite = await createInvite({
      email: invitee.email,
    });

    await acceptInvite({ invite, userId: invitee.id });

    const updated = await prisma.user.findUniqueOrThrow({
      where: { id: invitee.id },
      include: { role: true },
    });
    expect(updated.role.name).toBe("moderator");
  });

  it("never touches admins", async () => {
    const otherAdmin = await createTestUser("admin");
    const invite = await createInvite({
      email: otherAdmin.email,
      roleName: "moderator",
    });

    await acceptInvite({ invite, userId: otherAdmin.id });

    const updated = await prisma.user.findUniqueOrThrow({
      where: { id: otherAdmin.id },
      include: { role: true },
    });
    expect(updated.role.name).toBe("admin");
  });
});

describe("refreshInvite / revokeInvite", () => {
  it("refresh rotates the token and pushes expiry out", async () => {
    const invite = await createInvite({
      email: `r-${faker.string.uuid()}@example.com`,
    });
    await prisma.invite.update({
      where: { id: invite.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const refreshed = await refreshInvite(invite.id);
    expect(refreshed?.token).not.toBe(invite.token);
    expect(refreshed && refreshed.expiresAt > new Date()).toBe(true);
  });

  it("refuses to refresh an accepted invite", async () => {
    const invitee = await createTestUser();
    const invite = await createInvite({
      email: invitee.email,
    });
    await acceptInvite({ invite, userId: invitee.id });

    expect(await refreshInvite(invite.id)).toBeNull();
  });

  it("revoke deletes the row so the token dies", async () => {
    const invite = await createInvite({
      email: `d-${faker.string.uuid()}@example.com`,
    });

    await revokeInvite(invite.id);
    expect(await getInviteByToken(invite.token)).toBeNull();
  });
});
