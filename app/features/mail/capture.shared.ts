// Shared between the capture provider (server) and the Cypress mail helper —
// keep this module free of node imports so the test bundler can load it.

export const MAIL_CAPTURE_DIR = "tmp/mail-capture";

// One folder per recipient; `latest.json` always holds the newest message so
// tests don't need to list the directory.
export function mailCaptureFolder(to: string, dir: string = MAIL_CAPTURE_DIR) {
  const sanitized = to.toLowerCase().replace(/[^a-z0-9.+-]+/g, "_");
  return `${dir}/${sanitized}`;
}

export function latestMailPath(to: string, dir: string = MAIL_CAPTURE_DIR) {
  return `${mailCaptureFolder(to, dir)}/latest.json`;
}
