import { Resend } from "resend";

import type { MailProvider } from "../types";

// mail.mokupona.ch is the domain verified with Resend
const DEFAULT_FROM = "moku pona <no-reply@mail.mokupona.ch>";

// The only module that may import the Resend SDK (design §3.1).
export function createResendProvider(
  env: NodeJS.ProcessEnv = process.env,
): MailProvider {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY must be set when MAIL_PROVIDER="resend"');
  }

  const resend = new Resend(apiKey);
  const from = env.MAIL_FROM ?? DEFAULT_FROM;

  return {
    async send(message) {
      const { error } = await resend.emails.send({ from, ...message });
      if (error) {
        throw new Error(`Resend rejected mail to ${message.to}: ${error.message}`);
      }
    },
  };
}
