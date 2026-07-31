import type { MailBody } from "./compose";
import { createCaptureProvider } from "./providers/capture.server";
import { createConsoleProvider } from "./providers/console.server";
import { createResendProvider } from "./providers/resend.server";
import { mailTemplates } from "./templates";
import type { MailTemplateName, MailTemplateProps } from "./templates";
import type { MailProvider } from "./types";

import { requestLogger } from "~/logger/request-context.server";
import { logger } from "~/logger.server";
import { singleton } from "~/utils/singleton.server";

function mailProviderName(env: NodeJS.ProcessEnv) {
  return env.MAIL_PROVIDER ?? "console";
}

// Exported for tests; the app goes through the singleton below so an invalid
// configuration fails on first import, not on first send.
export function createMailProvider(
  env: NodeJS.ProcessEnv = process.env,
): MailProvider {
  const name = mailProviderName(env);
  switch (name) {
    case "console":
      return createConsoleProvider();
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

const provider = singleton("mail-provider", () => {
  const instance = createMailProvider();
  logger.info(
    { provider: mailProviderName(process.env) },
    "mail provider selected",
  );
  return instance;
});

// The way features send mail: name a template from ./templates and hand it the
// props it declares. Subject, text and HTML all come from that one definition.
export async function sendTemplate<Name extends MailTemplateName>(
  name: Name,
  to: string,
  props: MailTemplateProps<Name>,
): Promise<void> {
  const render = mailTemplates[name] as (
    props: MailTemplateProps<Name>,
  ) => MailBody;

  // better-auth swallows a throw out of its sendResetPassword and
  // sendVerificationEmail callbacks, so this is the only record those two
  // flows can produce when delivery fails.
  try {
    await provider.send({ to, ...render(props) });
  } catch (error) {
    requestLogger.error(
      { template: name, email: to, error },
      "Failed to send mail",
    );
    throw error;
  }

  requestLogger.info({ template: name, email: to }, "Sent mail");
}
