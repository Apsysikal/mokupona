import { createCaptureProvider } from "./providers/capture.server";
import { consoleProvider } from "./providers/console.server";
import { createResendProvider } from "./providers/resend.server";
import type { MailMessage, MailProvider } from "./types";

import { singleton } from "~/utils/singleton.server";

export type { MailMessage, MailProvider } from "./types";

// Exported for tests; the app goes through the singleton below so an invalid
// configuration fails on first import, not on first send.
export function createMailProvider(
  env: NodeJS.ProcessEnv = process.env,
): MailProvider {
  const name = env.MAIL_PROVIDER ?? "console";
  switch (name) {
    case "console":
      return consoleProvider;
    case "capture":
      return createCaptureProvider(env.MAIL_CAPTURE_DIR);
    case "resend":
      return createResendProvider(env);
    default:
      throw new Error(
        `Unknown MAIL_PROVIDER "${name}" — expected "resend", "console" or "capture"`,
      );
  }
}

const provider = singleton("mail-provider", () => createMailProvider());

export async function sendMail(message: MailMessage): Promise<void> {
  await provider.send(message);
}
