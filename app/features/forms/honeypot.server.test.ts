import { createHmac, randomBytes } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  HONEYPOT_FIELD_NAME,
  HONEYPOT_VALID_FROM_FIELD_NAME,
} from "./honeypot";
import { checkHoneypot, getHoneypotInputProps } from "./honeypot.server";

function check(fields: Record<string, string | File>) {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    formData.append(name, value);
  }

  return checkHoneypot(formData);
}

// Stands in for the key another process would hold: same construction, key
// material this module never sees.
function signWithForeignKey(timestamp: string) {
  return createHmac("sha256", randomBytes(32))
    .update(timestamp)
    .digest("base64url");
}

afterEach(() => {
  vi.useRealTimers();
});

describe("checkHoneypot", () => {
  it("accepts a submission carrying freshly minted props", () => {
    const { validFrom } = getHoneypotInputProps();

    expect(check({ [HONEYPOT_VALID_FROM_FIELD_NAME]: validFrom })).toEqual({
      spam: false,
    });
  });

  it("accepts an empty trap field, including whitespace only", () => {
    const { validFrom } = getHoneypotInputProps();

    expect(
      check({
        [HONEYPOT_FIELD_NAME]: "   ",
        [HONEYPOT_VALID_FROM_FIELD_NAME]: validFrom,
      }),
    ).toEqual({ spam: false });
  });

  it("rejects a filled trap field", () => {
    const { validFrom } = getHoneypotInputProps();

    expect(
      check({
        [HONEYPOT_FIELD_NAME]: "https://buy-now.example",
        [HONEYPOT_VALID_FROM_FIELD_NAME]: validFrom,
      }),
    ).toEqual({ spam: true, reason: "filled" });
  });

  it("rejects a trap field holding something other than text", () => {
    const { validFrom } = getHoneypotInputProps();

    expect(
      check({
        [HONEYPOT_FIELD_NAME]: new File([], "payload.txt"),
        [HONEYPOT_VALID_FROM_FIELD_NAME]: validFrom,
      }),
    ).toEqual({ spam: true, reason: "filled" });
  });

  it("rejects a submission without the timestamp field", () => {
    expect(check({})).toEqual({ spam: true, reason: "missing-timestamp" });
  });

  it("rejects a timestamp field that is not text", () => {
    expect(
      check({ [HONEYPOT_VALID_FROM_FIELD_NAME]: new File([], "stamp.txt") }),
    ).toEqual({ spam: true, reason: "missing-timestamp" });
  });

  it.each([
    ["no separator", "1753900000000"],
    ["too many parts", "1753900000000.sig.extra"],
    ["a non-numeric timestamp", "yesterday.sig"],
    ["an empty timestamp", ".sig"],
    ["a zero timestamp", "0.sig"],
  ])("rejects a timestamp with %s", (_case, validFrom) => {
    expect(check({ [HONEYPOT_VALID_FROM_FIELD_NAME]: validFrom })).toEqual({
      spam: true,
      reason: "malformed-timestamp",
    });
  });

  it("rejects a forged signature", () => {
    expect(
      check({
        [HONEYPOT_VALID_FROM_FIELD_NAME]: `${Date.now()}.not-a-real-sig`,
      }),
    ).toEqual({ spam: true, reason: "bad-signature" });
  });

  it("rejects a timestamp swapped under an otherwise valid signature", () => {
    const [, signature] = getHoneypotInputProps().validFrom.split(".");

    expect(
      check({
        [HONEYPOT_VALID_FROM_FIELD_NAME]: `${Date.now() - 60_000}.${signature}`,
      }),
    ).toEqual({ spam: true, reason: "bad-signature" });
  });

  // the same rejection a stamp minted before a restart now gets
  it("rejects a signature minted under a different key", () => {
    const timestamp = Date.now().toString();
    const foreign = signWithForeignKey(timestamp);

    expect(
      check({ [HONEYPOT_VALID_FROM_FIELD_NAME]: `${timestamp}.${foreign}` }),
    ).toEqual({ spam: true, reason: "bad-signature" });
  });

  it("rejects a properly signed timestamp from the future", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T12:02:00Z"));
    const { validFrom } = getHoneypotInputProps();
    vi.setSystemTime(new Date("2026-07-31T12:00:00Z"));

    expect(check({ [HONEYPOT_VALID_FROM_FIELD_NAME]: validFrom })).toEqual({
      spam: true,
      reason: "future-timestamp",
    });
  });

  it("tolerates a timestamp a few seconds ahead of this clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T12:00:30Z"));
    const { validFrom } = getHoneypotInputProps();
    vi.setSystemTime(new Date("2026-07-31T12:00:00Z"));

    expect(check({ [HONEYPOT_VALID_FROM_FIELD_NAME]: validFrom })).toEqual({
      spam: false,
    });
  });

  it("accepts a timestamp from an hour-old tab", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T11:00:00Z"));
    const { validFrom } = getHoneypotInputProps();
    vi.setSystemTime(new Date("2026-07-31T12:00:00Z"));

    expect(check({ [HONEYPOT_VALID_FROM_FIELD_NAME]: validFrom })).toEqual({
      spam: false,
    });
  });
});
