import { sendMail } from "~/features/mail/mail.server";
import type { InvitableRole, InviteWithToken } from "~/models/invite.server";
import { refreshInvite, upsertInvite } from "~/models/invite.server";

// The raw token exists only here, on its way into the email — it is never
// shown in the admin UI, so following the link always proves mailbox control.
async function sendInviteMail({
  invite,
  origin,
}: {
  invite: InviteWithToken;
  origin: string;
}) {
  const url = `${origin}/invite/${invite.token}`;
  const roleLine =
    invite.roleName === "moderator"
      ? "You've been invited to join moku pona as a moderator and help run our dinners."
      : "You've been invited to join moku pona.";

  await sendMail({
    to: invite.email,
    subject: "You're invited to moku pona",
    text: [
      roleLine,
      "",
      "Accept your invite here (the link is tied to this email address and expires in 7 days):",
      "",
      url,
      "",
      "If you weren't expecting this, you can ignore this email.",
    ].join("\n"),
    html: `<div style="font-family: sans-serif; line-height: 1.5;">
    <p>${roleLine}</p>
    <p>Accept your invite here (the link is tied to this email address and expires in 7 days):</p>
    <p><a href="${url}">Accept invite</a></p>
    <p style="color: #666; font-size: 13px;">If the link doesn't work, copy and paste this address into your browser:<br>${url}</p>
  </div>`,
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
