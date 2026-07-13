import { faker } from "@faker-js/faker";
import { beforeAll, describe, expect, it } from "vitest";

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

async function ensureRole(name: string) {
  return prisma.role.upsert({
    where: { name },
    create: { name },
    update: {},
  });
}

async function createUser(roleName: string) {
  const role = await ensureRole(roleName);
  return prisma.user.create({
    data: {
      email: `test-${faker.string.uuid()}@example.com`,
      name: faker.person.fullName(),
      roleId: role.id,
    },
  });
}

async function createAdmin() {
  return createUser("admin");
}

beforeAll(async () => {
  // acceptInvite resolves invite.roleName against the real Role table
  await Promise.all(["user", "moderator", "admin"].map(ensureRole));
});

describe("upsertInvite", () => {
  it("updates the live invite for an address instead of duplicating", async () => {
    const admin = await createAdmin();
    const email = `invitee-${faker.string.uuid()}@example.com`;

    const first = await upsertInvite({
      email,
      roleName: "user",
      createdById: admin.id,
    });
    const second = await upsertInvite({
      email,
      roleName: "moderator",
      createdById: admin.id,
    });

    expect(second.id).toBe(first.id);
    expect(second.roleName).toBe("moderator");
    // the token rotates, killing the previously mailed link
    expect(second.token).not.toBe(first.token);

    const pending = await listPendingInvites();
    expect(pending.filter((invite) => invite.email === email)).toHaveLength(1);
  });

  it("stores only a hash — the raw token never lands in the DB", async () => {
    const admin = await createAdmin();
    const invite = await upsertInvite({
      email: `h-${faker.string.uuid()}@example.com`,
      roleName: "user",
      createdById: admin.id,
    });

    const row = await prisma.invite.findUniqueOrThrow({
      where: { id: invite.id },
    });
    expect(row.tokenHash).not.toBe(invite.token);
    // ...but the raw token still resolves through the hashed lookup
    expect((await getInviteByToken(invite.token))?.id).toBe(invite.id);
  });

  it("normalizes the bound address to lowercase", async () => {
    const admin = await createAdmin();
    const invite = await upsertInvite({
      email: `Mixed-${faker.string.uuid()}@Example.com`,
      roleName: "user",
      createdById: admin.id,
    });
    expect(invite.email).toBe(invite.email.toLowerCase());
  });
});

describe("inviteValidity", () => {
  it("classifies missing, expired, used and valid invites", async () => {
    const admin = await createAdmin();
    const invite = await upsertInvite({
      email: `v-${faker.string.uuid()}@example.com`,
      roleName: "user",
      createdById: admin.id,
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
    const admin = await createAdmin();
    const invitee = await createUser("user");
    const invite = await upsertInvite({
      email: invitee.email,
      roleName: "moderator",
      createdById: admin.id,
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
    const admin = await createAdmin();
    const invitee = await createUser("user");
    const invite = await upsertInvite({
      email: invitee.email,
      roleName: "moderator",
      createdById: admin.id,
    });

    await acceptInvite({ invite, userId: invitee.id });
    await expect(acceptInvite({ invite, userId: invitee.id })).rejects.toThrow(
      /no longer valid/,
    );
  });

  it("rejects expired invites", async () => {
    const admin = await createAdmin();
    const invitee = await createUser("user");
    const invite = await upsertInvite({
      email: invitee.email,
      roleName: "moderator",
      createdById: admin.id,
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
    const admin = await createAdmin();
    const invitee = await createUser("moderator");
    const invite = await upsertInvite({
      email: invitee.email,
      roleName: "user",
      createdById: admin.id,
    });

    await acceptInvite({ invite, userId: invitee.id });

    const updated = await prisma.user.findUniqueOrThrow({
      where: { id: invitee.id },
      include: { role: true },
    });
    expect(updated.role.name).toBe("moderator");
  });

  it("never touches admins", async () => {
    const admin = await createAdmin();
    const otherAdmin = await createAdmin();
    const invite = await upsertInvite({
      email: otherAdmin.email,
      roleName: "moderator",
      createdById: admin.id,
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
    const admin = await createAdmin();
    const invite = await upsertInvite({
      email: `r-${faker.string.uuid()}@example.com`,
      roleName: "user",
      createdById: admin.id,
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
    const admin = await createAdmin();
    const invitee = await createUser("user");
    const invite = await upsertInvite({
      email: invitee.email,
      roleName: "user",
      createdById: admin.id,
    });
    await acceptInvite({ invite, userId: invitee.id });

    expect(await refreshInvite(invite.id)).toBeNull();
  });

  it("revoke deletes the row so the token dies", async () => {
    const admin = await createAdmin();
    const invite = await upsertInvite({
      email: `d-${faker.string.uuid()}@example.com`,
      roleName: "user",
      createdById: admin.id,
    });

    await revokeInvite(invite.id);
    expect(await getInviteByToken(invite.token)).toBeNull();
  });
});
