import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  latestMailPath,
  MAIL_CAPTURE_DIR,
  mailCaptureFolder,
} from "../capture.shared";
import type { MailMessage, MailProvider } from "../types";

export function createCaptureProvider(
  dir: string = MAIL_CAPTURE_DIR,
): MailProvider {
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
