import { isInvitableRole } from "./invite.shared";

import { sendTemplate } from "~/features/mail/mail.server";
import type { InvitableRole, InviteWithToken } from "~/models/invite.server";
import { refreshInvite, upsertInvite } from "~/models/invite.server";

async function sendInviteMail({
  invite,
  origin,
}: {
  invite: InviteWithToken;
  origin: string;
}) {
  const roleName = isInvitableRole(invite.roleName) ? invite.roleName : "user";

  await sendTemplate("invite", invite.email, {
    url: `${origin}/invite/${invite.token}`,
    roleName,
  });
}

// Create (or refresh a still-live invite for the same address) and mail it.
export async function createAndSendInvite({
  email,
  roleName,
  createdById,
  origin,
}: {
  email: string;
  roleName: InvitableRole;
  createdById: string;
  origin: string;
}): Promise<void> {
  const invite = await upsertInvite({ email, roleName, createdById });
  await sendInviteMail({ invite, origin });
}

// "Re-send": rotate token + expiry, then mail the fresh link.
export async function resendInvite({
  id,
  origin,
}: {
  id: string;
  origin: string;
}): Promise<void> {
  const invite = await refreshInvite(id);
  if (invite) await sendInviteMail({ invite, origin });
}
