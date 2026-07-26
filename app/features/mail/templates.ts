import type { MailBody } from "./compose";
import { action, compose, note, paragraph } from "./compose";

import type { InvitableRole } from "~/features/users/invite.shared";

export const mailTemplates = {
  verifyEmail: ({ url }: { url: string }) =>
    compose("Verify your email address", [
      paragraph("Welcome to moku pona!"),
      paragraph("Confirm your email address to activate your account:"),
      action("Verify email address", url),
      note("If you didn't create an account, you can ignore this email."),
    ]),

  resetPassword: ({ url }: { url: string }) =>
    compose("Reset your password", [
      paragraph(
        "Someone requested a password reset for your moku pona account.",
      ),
      paragraph("Set a new password here (the link expires in one hour):"),
      action("Reset password", url),
      note(
        "If this wasn't you, you can ignore this email — your password stays unchanged.",
      ),
    ]),

  invite: ({ url, roleName }: { url: string; roleName: InvitableRole }) =>
    compose("You're invited to moku pona", [
      paragraph(
        roleName === "moderator"
          ? "You've been invited to join moku pona as a moderator and help run our dinners."
          : "You've been invited to join moku pona.",
      ),
      paragraph(
        "Accept your invite here (the link is tied to this email address and expires in 7 days):",
      ),
      action("Accept invite", url),
      note("If you weren't expecting this, you can ignore this email."),
    ]),
} satisfies Record<string, (props: never) => MailBody>;

type MailTemplates = typeof mailTemplates;
export type MailTemplateName = keyof MailTemplates;
export type MailTemplateProps<K extends MailTemplateName> = Parameters<
  MailTemplates[K]
>[0];
