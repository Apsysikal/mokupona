export const MAIL_CAPTURE_DIR = "tmp/mail-capture";

export function mailCaptureFolder(to: string, dir: string = MAIL_CAPTURE_DIR) {
  const sanitized = to.toLowerCase().replace(/[^a-z0-9.+-]+/g, "_");
  return `${dir}/${sanitized}`;
}

export function latestMailPath(to: string, dir: string = MAIL_CAPTURE_DIR) {
  return `${mailCaptureFolder(to, dir)}/latest.json`;
}
