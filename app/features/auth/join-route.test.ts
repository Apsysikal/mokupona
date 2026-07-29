// @vitest-environment node
// (happy-dom swaps the fetch primitives; better-auth needs the real ones)

import { afterEach, describe, expect, it } from "vitest";

import { SIGNUP_CLOSED_MESSAGE } from "./signup-settings";
import {
  resetSignupSettings,
  setSignupEnabled,
} from "./signup-settings.server";

import { action } from "~/routes/join";

const VALID_SIGNUP = {
  name: "lena huber",
  email: "closed-signup@example.com",
  password: "correct-horse-battery",
  confirmPassword: "correct-horse-battery",
};

afterEach(() => {
  resetSignupSettings();
});

function submit(body: Record<string, string>) {
  return action({
    request: new Request("http://localhost:3000/join", {
      method: "POST",
      body: new URLSearchParams(body),
    }),
  } as unknown as Parameters<typeof action>[0]);
}

// The action returns either a bare conform reply or one wrapped by `data()`
// to carry a status — read both through the same lens.
function readReply(result: Awaited<ReturnType<typeof action>>) {
  const wrapped = result as {
    init?: ResponseInit | null;
    data?: { error?: Record<string, string[] | null> | null };
    error?: Record<string, string[] | null> | null;
  };
  const reply = wrapped.data ?? wrapped;

  return {
    status: wrapped.init?.status ?? 200,
    formErrors: reply.error?.[""] ?? [],
  };
}

describe("join action", () => {
  it("rejects a direct post with a 403 once email signup is closed", async () => {
    setSignupEnabled("email", false);

    // an otherwise perfectly valid submission — only the toggle stops it
    expect(readReply(await submit(VALID_SIGNUP))).toEqual({
      status: 403,
      formErrors: [SIGNUP_CLOSED_MESSAGE],
    });
  });

  it("leaves account creation alone while email signup is open", async () => {
    // an empty submission fails validation before better-auth is reached, so
    // this proves the gate is open without provisioning a user
    expect(readReply(await submit({}))).toEqual({
      status: 200,
      formErrors: [],
    });
  });

  it("keeps email signup open when only google signup is closed", async () => {
    setSignupEnabled("google", false);

    expect(readReply(await submit({})).status).toBe(200);
  });
});
