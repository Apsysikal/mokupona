import { sendMail } from "~/features/mail/mail.server";

// Transactional copy is deliberately neutral English, not the lowercase site
// brand voice (design §3.1). Minimal text-first HTML, no designed layout.

function mailHtml(paragraphs: string[], url: string, linkLabel: string) {
  const body = paragraphs.map((p) => `<p>${p}</p>`).join("\n    ");
  return `<div style="font-family: sans-serif; line-height: 1.5;">
    ${body}
    <p><a href="${url}">${linkLabel}</a></p>
    <p style="color: #666; font-size: 13px;">If the link doesn't work, copy and paste this address into your browser:<br>${url}</p>
  </div>`;
}

export async function sendVerificationMail({
  to,
  url,
}: {
  to: string;
  url: string;
}) {
  await sendMail({
    to,
    subject: "Verify your email address",
    text: [
      "Welcome to moku pona!",
      "",
      "Confirm your email address to activate your account:",
      "",
      url,
      "",
      "If you didn't create an account, you can ignore this email.",
    ].join("\n"),
    html: mailHtml(
      [
        "Welcome to moku pona!",
        "Confirm your email address to activate your account:",
      ],
      url,
      "Verify email address",
    ),
  });
}

export async function sendPasswordResetMail({
  to,
  url,
}: {
  to: string;
  url: string;
}) {
  await sendMail({
    to,
    subject: "Reset your password",
    text: [
      "Someone requested a password reset for your moku pona account.",
      "",
      "Set a new password here (the link expires in one hour):",
      "",
      url,
      "",
      "If this wasn't you, you can ignore this email — your password stays unchanged.",
    ].join("\n"),
    html: mailHtml(
      [
        "Someone requested a password reset for your moku pona account.",
        "Set a new password here (the link expires in one hour):",
      ],
      url,
      "Reset password",
    ),
  });
}
