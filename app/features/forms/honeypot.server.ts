import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import {
  HONEYPOT_FIELD_NAME,
  HONEYPOT_VALID_FROM_FIELD_NAME,
  type HoneypotInputProps,
} from "./honeypot";

export type HoneypotStampProblem =
  | "missing-timestamp"
  | "malformed-timestamp"
  | "bad-signature"
  | "future-timestamp"
  | "stale-timestamp";

export type HoneypotVerdict =
  | { outcome: "ok" }
  | { outcome: "trapped"; reason: "filled" }
  | { outcome: "unverified"; reason: HoneypotStampProblem };

const FUTURE_TOLERANCE_MS = 60_000;
const MAX_AGE_MS = 60 * 60 * 1000;

let signingKey: Buffer | undefined;

function getSigningKey(): Buffer {
  signingKey ??= randomBytes(32);
  return signingKey;
}

function sign(timestamp: string): string {
  return createHmac("sha256", getSigningKey())
    .update(timestamp)
    .digest("base64url");
}

export function getHoneypotInputProps(): HoneypotInputProps {
  const timestamp = Date.now().toString();

  return { validFrom: `${timestamp}.${sign(timestamp)}` };
}

export function checkHoneypot(formData: FormData): HoneypotVerdict {
  const trap = formData.get(HONEYPOT_FIELD_NAME);

  if (trap !== null && (typeof trap !== "string" || trap.trim() !== "")) {
    return { outcome: "trapped", reason: "filled" };
  }

  const validFrom = formData.get(HONEYPOT_VALID_FROM_FIELD_NAME);
  if (typeof validFrom !== "string") {
    return { outcome: "unverified", reason: "missing-timestamp" };
  }

  const parts = validFrom.split(".");
  if (parts.length !== 2) {
    return { outcome: "unverified", reason: "malformed-timestamp" };
  }

  const [timestamp, signature] = parts;
  if (!/^\d+$/.test(timestamp)) {
    return { outcome: "unverified", reason: "malformed-timestamp" };
  }

  const minted = Number(timestamp);
  if (!Number.isSafeInteger(minted) || minted <= 0) {
    return { outcome: "unverified", reason: "malformed-timestamp" };
  }

  const expected = Buffer.from(sign(timestamp));
  const received = Buffer.from(signature);
  // timingSafeEqual throws on differing lengths, and a length mismatch is
  // already a mismatch.
  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    return { outcome: "unverified", reason: "bad-signature" };
  }

  const now = Date.now();
  if (minted > now + FUTURE_TOLERANCE_MS) {
    return { outcome: "unverified", reason: "future-timestamp" };
  }

  if (minted < now - MAX_AGE_MS) {
    return { outcome: "unverified", reason: "stale-timestamp" };
  }

  return { outcome: "ok" };
}
