import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  latestMailPath,
  MAIL_CAPTURE_DIR,
  mailCaptureFolder,
} from "../capture.shared";
import type { MailMessage, MailProvider } from "../types";

// E2E provider: one JSON file per message under a well-known directory,
// cleared on startup. Cypress follows verification/reset/invite links by
// reading `latest.json` for a recipient (see cypress/support/mail.ts).
export function createCaptureProvider(
  dir: string = MAIL_CAPTURE_DIR,
): MailProvider {
  // clear leftovers from the previous run before the first send can race it
  const cleared = rm(dir, { recursive: true, force: true });
  let sequence = 0;

  const send = async (message: MailMessage) => {
    await cleared;
    sequence += 1;
    const folder = mailCaptureFolder(message.to, dir);
    await mkdir(folder, { recursive: true });
    const body = JSON.stringify({ ...message, sequence }, null, 2);
    await writeFile(path.join(folder, `${sequence}.json`), body);
    await writeFile(latestMailPath(message.to, dir), body);
  };

  return {
    send,
  };
}
