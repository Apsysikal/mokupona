import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import {
  HONEYPOT_FIELD_NAME,
  HONEYPOT_VALID_FROM_FIELD_NAME,
  type HoneypotInputProps,
} from "./honeypot";

export type HoneypotSpamReason =
  | "filled"
  | "missing-timestamp"
  | "malformed-timestamp"
  | "bad-signature"
  | "future-timestamp";

// The stamp is minted by this process, so anything ahead of now is either a
// forgery or clock drift between workers. A minute absorbs the drift while
// still catching a bot that pre-dates its stamp to skip a minimum-age check.
const FUTURE_TOLERANCE_MS = 60_000;

// Deliberately no maximum age: a tab left open over lunch is not spam.

let signingKey: Buffer | undefined;

// Minted on first use rather than shared with any configured secret: this key
// signs nothing that outlives the process, so it needs no operator handling
// and cannot entangle the honeypot with auth. A restart therefore invalidates
// every stamp still sitting in an open tab.
function getSigningKey(): Buffer {
  signingKey ??= randomBytes(32);
  return signingKey;
}

// The timestamp is not secret, only tamper-evident — an HMAC says that, and
// unlike the AES-GCM remix-utils encrypts it with, it needs no nonce.
function sign(timestamp: string): string {
  return createHmac("sha256", getSigningKey())
    .update(timestamp)
    .digest("base64url");
}

export function getHoneypotInputProps(): HoneypotInputProps {
  const timestamp = Date.now().toString();

  return { validFrom: `${timestamp}.${sign(timestamp)}` };
}

export function checkHoneypot(formData: FormData):
  | { spam: false }
  | {
      spam: true;
      reason: HoneypotSpamReason;
    } {
  const trap = formData.get(HONEYPOT_FIELD_NAME);
  // A File here means something wrote to the field that a hidden text input
  // could never hold, so it counts as filled.
  if (trap !== null && (typeof trap !== "string" || trap.trim() !== "")) {
    return { spam: true, reason: "filled" };
  }

  const validFrom = formData.get(HONEYPOT_VALID_FROM_FIELD_NAME);
  if (typeof validFrom !== "string") {
    return { spam: true, reason: "missing-timestamp" };
  }

  const parts = validFrom.split(".");
  if (parts.length !== 2) return { spam: true, reason: "malformed-timestamp" };

  const [timestamp, signature] = parts;
  if (!/^\d+$/.test(timestamp)) {
    return { spam: true, reason: "malformed-timestamp" };
  }

  const minted = Number(timestamp);
  if (!Number.isSafeInteger(minted) || minted <= 0) {
    return { spam: true, reason: "malformed-timestamp" };
  }

  const expected = Buffer.from(sign(timestamp));
  const received = Buffer.from(signature);
  // timingSafeEqual throws on differing lengths, and a length mismatch is
  // already a mismatch.
  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    return { spam: true, reason: "bad-signature" };
  }

  if (minted > Date.now() + FUTURE_TOLERANCE_MS) {
    return { spam: true, reason: "future-timestamp" };
  }

  return { spam: false };
}
