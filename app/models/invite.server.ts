import { createHash, randomBytes } from "node:crypto";

import type { Invite } from "#prisma/generated/client";

import { prisma } from "~/db.server";
import type { InvitableRole } from "~/features/users/invite.shared";
import { isInvitableRole } from "~/features/users/invite.shared";
import { getRoleByName } from "~/models/role.server";

export type { Invite };
export type { InvitableRole };

// The raw token is returned exactly once, at creation/rotation, to be put in
// the invite email — only its hash is stored, so a DB read can't mint a link.
export type InviteWithToken = Invite & { token: string };

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// unsalted sha256 is enough: 32 random bytes leave nothing to brute-force
function hashToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

function freshToken() {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    fields: {
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  };
}

// Re-inviting an address with a live (unaccepted) invite updates that row —
// no duplicates, the old link simply stops working (token rotates).
export async function upsertInvite({
  email,
  roleName,
  createdById,
}: {
  email: string;
  roleName: InvitableRole;
  createdById: string;
}): Promise<InviteWithToken> {
  if (!isInvitableRole(roleName)) {
    throw new Error(`Role "${roleName}" cannot be granted by invite`);
  }

  const normalized = email.toLowerCase();
  const existing = await prisma.invite.findFirst({
    where: { email: normalized, acceptedAt: null },
  });

  const { token, fields } = freshToken();

  if (existing) {
    const invite = await prisma.invite.update({
      where: { id: existing.id },
      data: { roleName, createdById, ...fields },
    });
    return { ...invite, token };
  }

  const invite = await prisma.invite.create({
    data: {
      email: normalized,
      roleName,
      createdById,
      ...fields,
    },
  });
  return { ...invite, token };
}

// Rotates the token and pushes the expiry out again (the "Re-send" action).
export async function refreshInvite(
  id: string,
): Promise<InviteWithToken | null> {
  const invite = await prisma.invite.findUnique({ where: { id } });
  if (!invite || invite.acceptedAt) return null;
  const { token, fields } = freshToken();
  const updated = await prisma.invite.update({
    where: { id },
    data: fields,
  });
  return { ...updated, token };
}

export async function listPendingInvites(): Promise<Invite[]> {
  return prisma.invite.findMany({
    where: { acceptedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

export async function getInviteByToken(
  token: string,
): Promise<(Invite & { createdBy: { name: string } }) | null> {
  if (!token) return null;
  return prisma.invite.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { createdBy: { select: { name: true } } },
  });
}

export type InviteValidity = "valid" | "invalid" | "expired" | "used";

export function inviteValidity(invite: Invite | null): InviteValidity {
  if (!invite) return "invalid";
  if (invite.acceptedAt) return "used";
  if (invite.expiresAt < new Date()) return "expired";
  return "valid";
}

export async function revokeInvite(id: string): Promise<void> {
  await prisma.invite.deleteMany({ where: { id } });
}

// Thrown when the single-use guard loses a race (double-click, second
// device) — callers catch it to show the "already accepted" dead-end.
export class InviteNoLongerValidError extends Error {
  constructor() {
    super("Invite is no longer valid");
  }
}

// Acceptance: token consumption and the role change commit atomically, so a
// reused token can never double-apply (design §6). Also marks the email
// verified — following the invite link proves control of the bound mailbox.
// Role rules: only upgrades are performed (a moderator invited as "user"
// keeps moderator), and admins are never touched.
export async function acceptInvite({
  invite,
  userId,
}: {
  invite: Pick<Invite, "id" | "roleName">;
  userId: string;
}): Promise<void> {
  // only moderator invites change the role; "user" invites never need it
  const moderatorRole =
    invite.roleName === "moderator" ? await getRoleByName("moderator") : null;
  if (invite.roleName === "moderator" && !moderatorRole) {
    throw new Error("Invite carries an unknown role");
  }

  await prisma.$transaction(async (tx) => {
    // single-use guard: only flips if still unaccepted and unexpired
    const consumed = await tx.invite.updateMany({
      where: { id: invite.id, acceptedAt: null, expiresAt: { gt: new Date() } },
      data: { acceptedAt: new Date() },
    });
    if (consumed.count === 0) {
      throw new InviteNoLongerValidError();
    }

    // upgrade only: never touches admins, never downgrades a moderator
    if (moderatorRole) {
      await tx.user.updateMany({
        where: { id: userId, role: { name: "user" } },
        data: { roleId: moderatorRole.id },
      });
    }

    // mailbox control proven by the link — deliberate verification shortcut
    await tx.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });
  });
}
