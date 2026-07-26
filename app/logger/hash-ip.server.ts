import { createHmac, randomBytes } from "node:crypto";

const EPOCH_MS = 24 * 60 * 60 * 1000;

let epoch = -1;
let salt: Buffer;

export function hashIp(ip: string): string {
  const current = Math.floor(Date.now() / EPOCH_MS);
  if (current !== epoch) {
    epoch = current;
    salt = randomBytes(32);
  }
  return createHmac("sha256", salt).update(ip).digest("base64url").slice(0, 16);
}
